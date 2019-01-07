function build(gl, stateUpdating) {
  try{
    const code = gl.editor.getValue();
    if (/^\s*$/.test(code)) return;
    window.localStorage.setItem('backup', code);

//*
    gl.mainGeometry = new SolidML.BufferGeometry().build(code, {mat:"10,90,30,20", ao:"2,0"}, true, 0, 0);
    gl.solidML = gl.mainGeometry.solidML;
//*/
/*
    const iarray = new SolidML.InstancedBufferGeometry(code, {mat:"10,90,30,20", ao:"2,0"});
    console.log(iarray);
    gl.mainGeometry = iarray.instancedArrayHash["grid"].instancedGeometry;
    gl.mainGeometry.objectCount = 1;
    gl.mainGeometry.isCompiled = ()=>true;
    gl.solidML = iarray.solidML;
//*/
    message("vertex:"+gl.mainGeometry.vertexCount+"/face:"+gl.mainGeometry.indexCount/3+"/object:"+gl.mainGeometry.objectCount);

    if (gl.mainMesh) 
      gl.scene.remove(gl.mainMesh);

    if (gl.mainGeometry.objectCount == 0) {
      gl.shadowAccumlator.setMeshes(null);
      return;
    }

    if (stateUpdating)
      updateState(code);

    if (gl.mainGeometry.isCompiled()) {
      // read criteria
      const mat = gl.solidML.criteria.getValue("mat", "array");
      if (mat.length > 0) gl.mainMaterial.metalness = parseFloat(mat[0]) / 100;
      if (mat.length > 1) gl.mainMaterial.roughness = parseFloat(mat[1]) / 100;
      if (mat.length > 2) gl.mainMaterial.clearCoat = parseFloat(mat[2]) / 100;
      if (mat.length > 3) gl.mainMaterial.clearCoatRoughness = parseFloat(mat[3]) / 100;
      const ao = gl.solidML.criteria.getValue("ao", "array");
      if (ao.length > 0) updateAOSharpness(gl, parseFloat(ao[0]));
      if (ao.length > 1) gl.AOoffset = parseFloat(ao[1]);
      const bg = gl.solidML.criteria.getValue("bg", "array");
      if (bg || gl.solidML.criteria.background) {
        gl.skyColor   = gl.solidML.criteria.background || bg[0];
        gl.floorColor = gl.solidML.criteria.background || bg[1] || bg[0];
        gl.checkColor = gl.solidML.criteria.background || bg[2] || bg[1] || bg[0];
      }
      updateBackScreen(gl);

      gl.defineControls.forEach(c=>c.remove());
      gl.defineControls = [];
      for (let key in gl.solidML.variables) {
        const val = gl.solidML.variables[key];
        const ctrl = gl.defineGUI.add(gl.solidML.variables, key);
        ctrl.onChange(v=>{
          gl.shadowAccumlator.stop();
          updateGeometry(gl);
        });
        ctrl.onFinishChange(v=>{
          gl.shadowAccumlator.start();
          updateGeometry(gl);
        });
        gl.defineControls.push(ctrl);
      }

      // compute boudings
      gl.mainGeometry.computeBoundingBox();
      gl.mainGeometry.computeBoundingSphere();
      const bbox = gl.mainGeometry.boundingBox,
            sphere = gl.mainGeometry.boundingSphere.clone(),
            zMargin = (gl.autoZPosition) ? - Math.min(bbox.min.z, 0) + bbox.getSize(new THREE.Vector3()).z * 0.1 : 0;
      sphere.center.z += zMargin;

      gl.controls.target = sphere.center;
      if (gl.autoCameraPosition)
        gl.camera.position.sub(sphere.center).normalize().multiplyScalar(sphere.radius*4).add(sphere.center);
      //gl.camera.far = sphere.radius * 5;
      gl.mainMaterial.updateCamera(gl.camera);

      gl.topLight.position.set(sphere.center.x, sphere.center.y, sphere.center.z+sphere.radius+1);
      gl.topLight.target.position.copy(sphere.center);
      gl.calcShadowingRange(gl.topLight, sphere);

      gl.roomMaterial.color = gl.backScreen.skyColor;
      gl.room.position.copy(sphere.center);
      gl.room.scale.setScalar(sphere.radius*4);

      gl.floor.position.set(sphere.center.x, sphere.center.y, 0);
      gl.floor.scale.set(sphere.radius*10, sphere.radius*10, 1);

      gl.floor.visible = gl.visibleFloor;
      gl.room.visible = gl.visibleRoom;
      gl.updateFrame = false;

      gl.cubeCamera.position.copy(sphere.center);
      gl.cubeCamera.update(gl.renderer, gl.scene);
      gl.mainMaterial.envMap = gl.cubeCamera.renderTarget.texture;
      gl.mainMaterial.envMapIntensity = 1;
      gl.mainMaterial.needsUpdate = true;

      gl.mainMesh = new THREE.Mesh(gl.mainGeometry, gl.mainMaterial);
      gl.mainMesh.castShadow = true;
      gl.mainMesh.receiveShadow = true;
      //gl.mainMesh.customDepthMaterial = gl.mainMaterial.customDepthMaterial;
      gl.mainMesh.position.z = zMargin;

      gl.scene.add(gl.mainMesh);

      gl.shadowAccumlator.setMeshes([gl.mainMesh, gl.floor, gl.room], sphere);
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

function updateState(code) {
  const query = (/^\s*$/.test(code)) ? "" : "?s=" + encodeURIComponent(code);
  history.pushState(null, null, location.href.replace(/\?.*$/, "") + query);
}

function updateCodeByURI(gl) {
  if (location.search) {
    location.search.substring(1).split("&").map(s=>s.split("=")).forEach(query=>{
      switch(query[0]) {
        case "s":
          gl.editor.setValue(decodeURIComponent(query[1]));
          build(gl, false);
          break;
      }
    });
  }
}

function updateAOSharpness(gl, sharpness) {
  gl.AOenable = (sharpness > 0);
  gl.AOsharpness = sharpness;
  gl._AOsharpnessFactor = Math.pow(2, gl.AOsharpness);
}

function updateBackScreen(gl) {
  if (gl.visibleFloor) {
    gl.backScreen.skyColor   = new THREE.Color(gl.skyColor);
    gl.backScreen.floorColor = new THREE.Color(gl.floorColor);
    gl.backScreen.checkColor = new THREE.Color(gl.checkColor);
  } else {
    gl.backScreen.skyColor   = new THREE.Color(gl.skyColor);
    gl.backScreen.floorColor = gl.backScreen.skyColor;
    gl.backScreen.checkColor = gl.backScreen.skyColor;
  }
}

function updateGeometry(gl) {
  const camdir = gl.controls.target.clone().sub(gl.camera.position).normalize();
  console.log(gl.solidML.variables);
  gl.mainGeometry.update(camdir);
}


function setup(gl) {
  let initialScript = "20{x0.7h18rx25ry10}R\n#R{grid{s0.5sat0.7}dodeca}";

  gl.editor = ace.edit("texteditor");
  gl.editor.$blockScrolling = Infinity;
  gl.editor.commands.addCommand({
    name : "play",
    bindKey: {win:"Ctrl-Enter", mac:"Command-Enter"},
    exec: ()=>build(gl, true)
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
  document.getElementById("runscript").addEventListener("click", ()=>build(gl, true));
  document.getElementById("capture").addEventListener("click", ()=>capture(gl));
  window.addEventListener("popstate", ()=>updateCodeByURI(gl));

  updateAOSharpness(gl, 2);
  gl.AOoffset = 0;
  gl.autoZPosition = true;
  gl.autoCameraPosition = true;
  gl.visibleFloor = true;
  gl.visibleRoom = false;
  gl.skyColor = "#679";
  gl.floorColor = "#eee";
  gl.checkColor = "#eee";

  gl.stats = new Stats();
  document.getElementById("stats").appendChild(gl.stats.dom);
  gl.stats.dom.style.left = "480px";
  gl.stats.dom.style.top = "50px";

  gl.gui = new dat.GUI({autoPlace: false, closed: false});
  gl.gui.useLocalStorage = true;
  document.getElementById("paramgui").appendChild(gl.gui.domElement);
  const ao = gl.gui.addFolder("Ambient Occlusion");
  ao.closed = false;
  ao.add(gl, 'AOenable');
  ao.add(gl, 'AOsharpness', 0, 5, 0.1).onChange(v=>updateAOSharpness(gl, v));
  ao.add(gl, 'AOoffset',   -1, 1, 0.1);
  const bg = gl.gui.addFolder("Background");
  bg.closed = true;
  bg.add(gl, 'autoZPosition').onChange(v=>build(gl, false));
  bg.add(gl, 'autoCameraPosition').onChange(v=>build(gl, false));
  bg.add(gl, 'visibleFloor').onChange(v=>build(gl, false));
  bg.addColor(gl, 'skyColor').onChange(v=>updateBackScreen(gl));
  bg.addColor(gl, 'floorColor').onChange(v=>updateBackScreen(gl));
  bg.addColor(gl, 'checkColor').onChange(v=>updateBackScreen(gl));
  //bg.add(gl, 'visibleRoom').onChange(v=>{gl.visibleRoom=v;build(gl, false);});
  gl.defineGUI = gl.gui.addFolder("Definitions");
  gl.defineGUI.closed = false;
  gl.defineControls = [];
  
  gl.mainMaterial = new SSAOMaterial();
  gl.mainMaterial.initialize(gl.renderer);
  gl.mainGeometry = null;
  gl.mainMesh = null;
  gl.floorMaterial = new THREE.ShadowMaterial({color:0x000000, opacity:0.4, depthWrite:true});
  gl.floorGeometry = new THREE.PlaneBufferGeometry(1,1);
  gl.floorGeometry.attributes.position.dynamic = true;
  gl.floor = new THREE.Mesh(gl.floorGeometry, gl.floorMaterial);
  gl.floor.renderOrder = -1;
  gl.floor.receiveShadow = true;
  gl.roomMaterial = new THREE.MeshLambertMaterial({color:0xffffff});
  gl.roomGeometry = new THREE.BoxBufferGeometry(1,1,1).scale(-1,-1,-1);
  gl.roomGeometry.attributes.position.dynamic = true;
  gl.room = new THREE.Mesh(gl.roomGeometry, gl.roomMaterial);
  gl.room.receiveShadow = true;
  gl.backScreen = new BackScreen();
  gl.scene.add(gl.floor);
  gl.scene.add(gl.room);
  gl.scene.add(gl.backScreen);

  //gl.renderTarget = gl.newRenderTarget();
  const size = this.renderer.getSize();
  gl.renderTarget = new WebGL2RenderTarget( size.width, size.height, { multipleRenderTargets:true, renderTargetCount:2 } );

  gl.cubeCamera = new THREE.CubeCamera( 0.001, 10000, 256 );
  gl.cubeCamera.renderTarget.texture.generateMipmaps = true;
  gl.cubeCamera.renderTarget.texture.minFilter = THREE.LinearMipMapLinearFilter;
  gl.scene.add(gl.cubeCamera);

  gl.controls = new THREE.TrackballControls(gl.camera, gl.renderer.domElement);
  gl.controls.rotateSpeed = 3.0;
  gl.controls.zoomSpeed = 3.0;
  gl.controls.panSpeed = 0.5;
  gl.controls.noZoom = false;
  gl.controls.noPan = false;
  gl.controls.staticMoving = true;
  gl.controls.addEventListener("start", ()=>{
    gl.shadowAccumlator.stop();
    return true;
  });
  gl.controls.addEventListener("end", ()=>{
    gl.shadowAccumlator.start();
    return true;
  });

  gl.shadowAccumlator = new ShadowAccumlator(gl);

  updateCodeByURI(gl);

  const copyShader = new RenderTargetOperator(gl.renderer, RenderTargetOperator.copyShader);

  gl.renderer.gammaFactor = 2.1;

  gl.render = ()=>{
    gl.stats.begin();
    if (gl.shadowAccumlator.pause || !gl.AOenable) {
      gl.renderer.setClearColor(new THREE.Color(0x000000));
      gl.renderer.render(gl.scene, gl.camera, gl.renderTarget);
      gl.mainMaterial.render(gl.renderTarget);
      //copyShader.calc({tSrc:gl.renderTarget.textures[1]});
    } else {
      gl.renderer.setClearColor(new THREE.Color(0x000000));
      gl.renderer.render(gl.scene, gl.camera, gl.renderTarget);
      gl.shadowAccumlator.render(gl.camera, 16);
      gl.shadowAccumlator.accumlator.render(gl.renderTarget, gl._AOsharpnessFactor, gl.AOoffset-(gl._AOsharpnessFactor*0.125));
    }
    gl.stats.end();
  };
}

function draw(gl) {
  gl.controls.update();
  if (gl.updateFrame) 
    updateGeometry(gl);
}

new Ptolemy({
  containerid: 'screen',
  setup,
  draw
});

class BackScreen extends THREE.Mesh {
  constructor() {
    super(new THREE.PlaneBufferGeometry(2, 2), null);
    this.material = new THREE.ShaderMaterial({
      depthWrite:false,
      uniforms: {
        skyColor:   {value:new THREE.Color()},
        floorColor: {value:new THREE.Color()},
        checkColor: {value:new THREE.Color()}
      },
      vertexShader: [
        BackScreen.inverseMatrix,
        "out vec3 vScreenPos;",
        "void main() {",
          "vec4 screenPos = vec4(position.xy, 1, 1);",
          "mat4 unproject = inverse(projectionMatrix * viewMatrix);",
          "vec4 worldPos = unproject * screenPos;",
          "vScreenPos = worldPos.xyz / worldPos.w;",
          "gl_Position = screenPos.xyww;",
        "}"
      ].join("\n"),
      fragmentShader: [
        "#version 300 es",
        "in vec3 vScreenPos;",
        "out vec4 vFlagColor;",
        "uniform vec3 skyColor;",
        "uniform vec3 floorColor;",
        "uniform vec3 checkColor;",
        "vec3 fcol(vec2 uv) {",
          "return mix(floorColor, checkColor, mod(floor(uv.x)+floor(uv.y), 2.));",
        "}",
        "void main() {",
          "vec3 dir = normalize(vScreenPos - cameraPosition);",
          "if (dir.z<-0.001) {",
            "vec3 fuv = cameraPosition - dir / dir.z * cameraPosition.z;",
            "float len = length(fuv - cameraPosition);",
            "vec2 ipx = vec2(0.001*len, -0.001*len);",
            "vec3 chk = fcol(fuv.xy+ipx.xx) + fcol(fuv.xy+ipx.xy) + fcol(fuv.xy+ipx.yx) + fcol(fuv.xy+ipx.yy);",
            "vFlagColor = mix(vec4(chk/4.,1), vec4(skyColor,1), smoothstep(0.98,1.0,dir.z+1.));",
          "} else {",
            "vFlagColor = vec4(skyColor,1);",
          "}",
        "}"
      ].join("\n")
    });
    this.frustumCulled = false;
  }
  get skyColor() { return this.material.uniforms.skyColor.value; }
  set skyColor(c) { this.material.uniforms.skyColor.value = c; }
  get floorColor() { return this.material.uniforms.floorColor.value; }
  set floorColor(c) { this.material.uniforms.floorColor.value = c; }
  get checkColor() { return this.material.uniforms.checkColor.value; }
  set checkColor(c) { this.material.uniforms.checkColor.value = c; }
  set shader(fragShader) {
    this.material.fragmentShader = fragShader;
  }
}

BackScreen.inverseMatrix = "#version 300 es"; 
/* code for WebGL1 (inverse is not supported)
[
"mat4 inverse(mat4 m) {",
  "float",
      "a00 = m[0][0], a01 = m[0][1], a02 = m[0][2], a03 = m[0][3],",
      "a10 = m[1][0], a11 = m[1][1], a12 = m[1][2], a13 = m[1][3],",
      "a20 = m[2][0], a21 = m[2][1], a22 = m[2][2], a23 = m[2][3],",
      "a30 = m[3][0], a31 = m[3][1], a32 = m[3][2], a33 = m[3][3],",
      "b00 = a00 * a11 - a01 * a10,",
      "b01 = a00 * a12 - a02 * a10,",
      "b02 = a00 * a13 - a03 * a10,",
      "b03 = a01 * a12 - a02 * a11,",
      "b04 = a01 * a13 - a03 * a11,",
      "b05 = a02 * a13 - a03 * a12,",
      "b06 = a20 * a31 - a21 * a30,",
      "b07 = a20 * a32 - a22 * a30,",
      "b08 = a20 * a33 - a23 * a30,",
      "b09 = a21 * a32 - a22 * a31,",
      "b10 = a21 * a33 - a23 * a31,",
      "b11 = a22 * a33 - a23 * a32,",
      "det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;",
  "return mat4(",
      "a11 * b11 - a12 * b10 + a13 * b09,",
      "a02 * b10 - a01 * b11 - a03 * b09,",
      "a31 * b05 - a32 * b04 + a33 * b03,",
      "a22 * b04 - a21 * b05 - a23 * b03,",
      "a12 * b08 - a10 * b11 - a13 * b07,",
      "a00 * b11 - a02 * b08 + a03 * b07,",
      "a32 * b02 - a30 * b05 - a33 * b01,",
      "a20 * b05 - a22 * b02 + a23 * b01,",
      "a10 * b10 - a11 * b08 + a13 * b06,",
      "a01 * b08 - a00 * b10 - a03 * b06,",
      "a30 * b04 - a31 * b02 + a33 * b00,",
      "a21 * b02 - a20 * b04 - a23 * b00,",
      "a11 * b07 - a10 * b09 - a12 * b06,",
      "a00 * b09 - a01 * b07 + a02 * b06,",
      "a31 * b01 - a30 * b03 - a32 * b00,",
      "a20 * b03 - a21 * b01 + a22 * b00) / det;",
"}"
].join("\n")
*/

