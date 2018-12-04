function build(gl) {
  try{
    const code = gl.editor.getValue();
    if (/^\s*$/.test(code)) return;
    window.localStorage.setItem('backup', code);
    gl.mainGeometry = new SolidML.BufferGeometry().build(code, {floor:"#888", sky:"#679", mat:"10,90,30,20"}, true);
    gl.solidML = gl.mainGeometry.solidML;

    message("vertex:"+gl.mainGeometry.vertexCount+"/face:"+gl.mainGeometry.indexCount/3+"/object:"+gl.mainGeometry.objectCount);

    if (gl.mainMesh) gl.scene.remove(gl.mainMesh);

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
      const floorHeight = bbox.min.z - 5;

      gl.setCameraDistance(sphere.radius*2, sphere.center, new THREE.Vector3(0,1,-1));
      gl.controls.target = sphere.center;

      gl.light.shadow.camera.bottom = sphere.center.y - sphere.radius;
      gl.light.shadow.camera.top    = sphere.center.y + sphere.radius;
      gl.light.shadow.camera.left   = sphere.center.x - sphere.radius;
      gl.light.shadow.camera.right  = sphere.center.x + sphere.radius;
      gl.light.position.set(0, 0, sphere.center.z+sphere.radius + 1);
      gl.light.shadow.camera.updateProjectionMatrix();

      const floorColor = gl.solidML.criteria.background || gl.solidML.criteria.getValue("floor", "color");
      const skyColor   = gl.solidML.criteria.background || gl.solidML.criteria.getValue("sky", "color");
      gl.floorMaterial.color = new THREE.Color(floorColor);
      gl.floorLight.color = gl.floorMaterial.color;
      gl.floor.position.z = floorHeight;
      gl.scene.fog.near = sphere.radius*20;
      gl.scene.fog.far = sphere.radius*25;
      gl.scene.fog.color = new THREE.Color(skyColor);
      gl.renderer.setClearColor(gl.scene.fog.color);

      /**/
      gl.cubeCamera.position.copy(sphere.center);
      gl.cubeCamera.update(gl.renderer, gl.scene);
      gl.mainMaterial.envMap = gl.cubeCamera.renderTarget.texture;
      gl.mainMaterial.envMapIntensity = 1;
      gl.mainMaterial.needsUpdate = true;

      /**/
      gl.updateFrame = false;

      gl.mainMesh = new THREE.Mesh(gl.mainGeometry, gl.mainMaterial);
      gl.mainMesh.castShadow = true;
      gl.mainMesh.receiveShadow = true;
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
  gl.floorMaterial = new THREE.MeshLambertMaterial({color:0x888888});
  gl.floorGeometry = new THREE.PlaneBufferGeometry(50000,50000);
  gl.floorGeometry.attributes.position.dynamic = true;
  gl.floor = new THREE.Mesh(gl.floorGeometry, gl.floorMaterial);
  gl.floor.receiveShadow = true;
  gl.scene.add(gl.floor);

  gl.scene.fog = new THREE.Fog(new THREE.Color(0x667799), 3000, 5000);
  gl.renderer.setClearColor(gl.scene.fog.color);

  gl.cubeCamera = new THREE.CubeCamera( 1, 1000, 256 );
  gl.cubeCamera.renderTarget.texture.generateMipmaps = true;
  gl.cubeCamera.renderTarget.texture.minFilter = THREE.LinearMipMapLinearFilter;
  gl.scene.add(gl.cubeCamera);

  gl.controls = new THREE.TrackballControls(gl.camera, gl.renderer.domElement);
  gl.controls.rotateSpeed = 4.0;
  gl.controls.zoomSpeed = 4.0;
  gl.controls.panSpeed = 0.6;
  gl.controls.noZoom = false;
  gl.controls.noPan = false;
  gl.controls.staticMoving = true;
  gl.controls.dynamicDampingFactor = 0.8;
  gl.controls.keys = [ 65, 83, 68 ];
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

