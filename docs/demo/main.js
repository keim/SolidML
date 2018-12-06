function build(gl) {
  try{
    const code = gl.editor.getValue();
    if (/^\s*$/.test(code)) return;
    window.localStorage.setItem('backup', code);
    gl.mainGeometry = new SolidML.BufferGeometry().build(code, {floor:"#888", sky:"#679", mat:"10,90,30,20"}, true);
    gl.solidML = gl.mainGeometry.solidML;

    message("vertex:"+gl.mainGeometry.vertexCount+"/face:"+gl.mainGeometry.indexCount/3+"/object:"+gl.mainGeometry.objectCount);

    if (gl.mainMesh) 
      gl.scene.remove(gl.mainMesh);

    if (gl.mainGeometry.isCompiled()) {
      const mat = gl.solidML.criteria.getValue("mat", "array");
      if (mat.length > 0) gl.mainMaterial.metalness = parseFloat(mat[0]) / 100;
      if (mat.length > 1) gl.mainMaterial.roughness = parseFloat(mat[1]) / 100;
      if (mat.length > 2) gl.mainMaterial.clearCoat = parseFloat(mat[2]) / 100;
      if (mat.length > 3) gl.mainMaterial.clearCoatRoughness = parseFloat(mat[3]) / 100;

      gl.mainGeometry.computeBoundingBox();
      gl.mainGeometry.computeBoundingSphere();
      const bbox = gl.mainGeometry.boundingBox,
            sphere = gl.mainGeometry.boundingSphere;
      const floorHeight = bbox.min.z - sphere.radius * 0.3;

      gl.controls.target = sphere.center;
      gl.camera.position.sub(sphere.center).normalize().multiplyScalar(sphere.radius*4).add(sphere.center);

      gl.topLight.position.set(0, 0, sphere.center.z + sphere.radius + 1);
      gl.topLight.lookAt(sphere.center);
      gl.calcShadowingRange(gl.topLight, sphere);

      const floorColor = gl.solidML.criteria.background || gl.solidML.criteria.getValue("floor", "color");
      const skyColor   = gl.solidML.criteria.background || gl.solidML.criteria.getValue("sky", "color");
      //gl.floorMaterial.color = new THREE.Color(floorColor);
      gl.floorLight.color = new THREE.Color(floorColor);
      gl.floor.position.z = floorHeight;
      gl.renderer.setClearColor(new THREE.Color(skyColor));

      gl.cubeCamera.position.copy(sphere.center);
      gl.cubeCamera.update(gl.renderer, gl.scene);
      gl.mainMaterial.envMap = gl.cubeCamera.renderTarget.texture;
      gl.mainMaterial.envMapIntensity = 1;
      gl.mainMaterial.needsUpdate = true;

      gl.updateFrame = false;

      gl.mainMesh = new THREE.Mesh(gl.mainGeometry, gl.mainMaterial);
      gl.mainMesh.castShadow = true;
      gl.mainMesh.receiveShadow = true;

      gl.shadowAccumlator.target(gl.mainMesh);

      gl.scene.add(gl.mainMesh);
    }
  } catch(e){
    message(e.message);
    console.error(e);
  }
}

function message(msg) {
  document.getElementById("message").innerText = msg;
}

function restore(gl) {
  const backup = window.localStorage.getItem('backup');
  if (backup) gl.editor.setValue(backup);
}

function capture(gl) {
  try {
    gl.capture("solidml.jpg", "image/jpeg");
  } catch (e) {
    message(e.message);
    console.error(e);
  }
}

function setup(gl) {
  let initialScript = "20{x0.7h18rx25ry10}R\n#R{grid{s0.5sat0.7}dodeca}";
  if (location.search) {
    location.search.substring(1).split("&").map(s=>s.split("=")).forEach(query=>{
      switch(query[0]) {
        case "s":
          initialScript = decodeURIComponent(query[1]);
          break;
      }
    });
  }

  gl.editor = ace.edit("texteditor");
  gl.editor.commands.addCommand({
    name : "play",
    bindKey: {win:"Ctrl-Enter", mac:"Command-Enter"},
    exec: ()=>build(gl)
  });
  gl.editor.commands.addCommand({ // Restore last draft from localStorage
    name : "restore",
    bindKey: {win:"Alt-Z", mac:"Alt-Z"},
    exec: ()=>restore(gl)
  });
  gl.editor.commands.addCommand({ // Restore last draft from localStorage
    name : "capture",
    bindKey: {win:"Ctrl-S", mac:"Command-S"},
    exec: ()=>capture(gl)
  });
  gl.editor.setValue(initialScript);
  document.getElementById("version").textContent = SolidML.VERSION;
  document.getElementById("runscript").addEventListener("click", ()=>build(gl));
  document.getElementById("capture").addEventListener("click", ()=>capture(gl));
  document.getElementById("scripturl").addEventListener("click", ()=>{
    const code = gl.editor.getValue();
    const query = (/^\s*$/.test(code)) ? "" : "?s=" + encodeURIComponent(code);
    history.pushState(null, null, location.href.replace(/\?.*$/, "") + query);
  });

  //gl.mainMaterial = new THREE.MeshPhysicalMaterial({vertexColors:THREE.VertexColors});
  gl.mainMaterial = new SolidML.Material();
  gl.mainGeometry = null;
  gl.mainMesh = null;
  gl.floorMaterial = new THREE.ShadowMaterial({color:0x000000, opacity:0.2});
  gl.floorGeometry = new THREE.PlaneBufferGeometry(50000,50000);
  gl.floorGeometry.attributes.position.dynamic = true;
  gl.floor = new THREE.Mesh(gl.floorGeometry, gl.floorMaterial);
  gl.floor.receiveShadow = true;
  gl.scene.add(gl.floor);

  gl.renderer.setClearColor(new THREE.Color(0x667799));

  gl.cubeCamera = new THREE.CubeCamera( 1, 1000, 256 );
  gl.cubeCamera.renderTarget.texture.generateMipmaps = true;
  gl.cubeCamera.renderTarget.texture.minFilter = THREE.LinearMipMapLinearFilter;
  gl.scene.add(gl.cubeCamera);

  gl.controls = new THREE.TrackballControls(gl.camera, gl.renderer.domElement);
  gl.controls.rotateSpeed = 3.0;
  gl.controls.zoomSpeed = 3.0;
  gl.controls.panSpeed = 0.5;
  gl.controls.noZoom = false;
  gl.controls.noPan = false;
  gl.controls.dynamicDampingFactor = 0.25;

  gl.shadowAccumlator = new ShadowAccumlator(gl);
  gl.shadowAccumlatorMaterial = new ShadowAccumlator.Material(gl);
  gl.shadowAccumlatorMaterial.uniforms.tDiffuse.value = gl.shadowAccumlator.accumBuffer.texture;
  gl.shadowAccumlatorMaterial.uniforms.opacity.value = 1;
  gl.accumLayer = new THREE.Mesh(new THREE.PlaneBufferGeometry(2,2), this.accumMaterial);
  gl.accumLayer.renderOrder = 9999;
  gl.scene.add(gl.accumLayer);
  gl.render = ()=>{
    gl.shadowAccumlator.render(gl);
    gl.renderer.render(gl.scene, gl.camera);
    //gl.renderer.render(gl.postProcess.postScene, gl.postProcess.postCamera);
  };
}

class ShadowAccumlator {
  constructor(gl) {
    const size = gl.renderer.getSize();
    this.accumBuffer = new THREE.WebGLRenderTarget(size.width, size.height);
    this.accumBuffer.texture.format = THREE.RGBFormat;
    this.accumBuffer.texture.minFilter = THREE.NearestFilter;
    this.accumBuffer.texture.magFilter = THREE.NearestFilter;
    this.accumBuffer.texture.generateMipmaps = false;
    this.accumBuffer.stencilBuffer = false;
    this.accumBuffer.depthBuffer = false;
    this.accumMaterial = new ShadowAccumlator.Material(this.accumBuffer);
    this.accumLayer = new THREE.Mesh(new THREE.PlaneBufferGeometry(2,2), this.accumMaterial);
    this.accumLayer.renderOrder = 9999;
    this.shadowMaterial = new THREE.ShadowMaterial({color:0x000000, opacity:1});
    this.light = new THREE.DirectionalLight(0xffffff, 1);
    this.light.castShadow = true;
    this.light.shadow.radius = 2;
    this.light.shadow.mapSize.width = 512;
    this.light.shadow.mapSize.height = 512;
    this.light.shadow.camera.near = 0.01;
    this.light.shadow.camera.far = 100000;
    this.light.position.set(0,0,100);
    this.light.lookAt(0,0,0);
    this.renderer = new THREE.WebGLRenderer();
    this.scene = new THREE.Scene();
    this.scene.add(this.light);
    //this.scene.add(this.accumLayer);
  }
  target(targetMesh) {
    if (this.targetMesh)
      this.scene.remove(this.targetMesh);
    this.targetMesh = targetMesh.clone();
    this.targetMesh.material = this.shadowMaterial;
    this.targetMesh.castShadow = true;
    this.targetMesh.receiveShadow = true;
    this.scene.add(this.targetMesh);
  }
  render(gl) {
    if (!this.targetMesh) return;
    const sphere = this.targetMesh.geometry.boundingSphere,
          sp = new THREE.Spherical();
    this.light.shadow.camera.bottom = sphere.center.y - sphere.radius;
    this.light.shadow.camera.top    = sphere.center.y + sphere.radius;
    this.light.shadow.camera.left   = sphere.center.x - sphere.radius;
    this.light.shadow.camera.right  = sphere.center.x + sphere.radius;
    this.light.lookAt(sphere.center);
    this.light.shadow.camera.updateProjectionMatrix();

    const clearColor = gl.renderer.getClearColor();
    gl.renderer.setClearColor(new THREE.Color(0xffffff));
    for (let i=0; i<256; i++) {
      this.accumMaterial.uniforms.opacity.value = 1/(i+1);
      this.light.position.setFromSpherical(sp.set(sphere.radius, Math.random()*Math.PI, Math.random()*Math.PI*2));
      gl.renderer.render(this.scene, gl.camera, this.accumBuffer);
    }

    gl.renderer.setClearColor(clearColor);
  }
}
ShadowAccumlator.Material = class extends THREE.RawShaderMaterial {
  constructor(renderTarget) {
    super({
      uniforms: {
        "tDiffuse": { value: renderTarget.texture },
        "opacity":  { value: 1.0 }
      },
      vertexShader: [
        "attribute vec3 position;",
        "attribute vec3 normal;",
        "attribute vec2 uv;",
        "varying vec2 vUv;",
        "void main() {",
          "vUv = uv;",
          "gl_Position = vec4( position, 1.0 );",
        "}"
      ].join( "\n" ),
      fragmentShader: [
        "uniform float opacity;",
        "uniform sampler2D tDiffuse;",
        "varying vec2 vUv;",
        "void main() {",
          "vec4 pixel = texture2D( tDiffuse, vUv );",
          "pixel.a *= opacity;",
          "gl_FragColor = pixel;",
        "}"
      ].join( "\n" ),
      transparent : true
    });
  }
}

function draw(gl) {
  gl.controls.update();
  if (gl.updateFrame) {
    const camdir = gl.controls.target.clone().sub(gl.camera.position).normalize();
    gl.mainGeometry.update(camdir);
  }
}

      
new Ptolemy({
  containerid: 'screen',
  setup,
  draw
});

