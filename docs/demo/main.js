new Ptolemy({
  containerid: 'screen',
  setup: gl=>{
    const editor = ace.edit("texteditor");
    const build = ()=>{
      try{
        gl.mainGeometry = new SolidML.BufferGeometry(editor.getValue(), null, {floor:"#888", sky:"#679", mat:"10,90"});
        gl.solidML = gl.mainGeometry.solidML;

        message("vertex:"+gl.mainGeometry.attributes.position.count+"/face:"+gl.mainGeometry.index.count/3);

        if (gl.mainMesh) gl.scene.remove(gl.mainMesh);
        const mat = gl.solidML.criteria.getValue("mat", "array");
        if (mat.length > 0) gl.mainMaterial.metalness = parseFloat(mat[0]) / 100;
        if (mat.length > 1) gl.mainMaterial.roughness = parseFloat(mat[1]) / 100;
        gl.mainMesh = new THREE.Mesh(gl.mainGeometry, gl.mainMaterial);
        gl.mainMesh.castShadow = true;
        gl.mainMesh.receiveShadow = true;
        gl.scene.add(gl.mainMesh);

        gl.mainGeometry.computeBoundingBox();
        gl.mainGeometry.computeBoundingSphere();
        const bbox = gl.mainGeometry.boundingBox,
              sphere = gl.mainGeometry.boundingSphere;

        gl.setCameraDistance(sphere.radius*2, sphere.center, new THREE.Vector3(0,1,-1));
        gl.controls.target = sphere.center;

        gl.light.shadow.camera.far = bbox.max.z-bbox.min.z+30;
        gl.light.shadow.camera.bottom = bbox.min.y;
        gl.light.shadow.camera.top = bbox.max.y;
        gl.light.shadow.camera.left = bbox.min.x;
        gl.light.shadow.camera.right = bbox.max.x;
        gl.light.position.set(0, 0, bbox.max.z+10);
        gl.light.shadow.camera.updateProjectionMatrix();

        const floorColor = gl.solidML.criteria.background || gl.solidML.criteria.getValue("floor", "color");
        const skyColor   = gl.solidML.criteria.background || gl.solidML.criteria.getValue("sky", "color");
        gl.floorMaterial.color = new THREE.Color(floorColor);
        gl.floorLight.color = gl.floorMaterial.color;
        gl.floor.position.z = bbox.min.z-5;
        gl.scene.fog.color = new THREE.Color(skyColor);
        gl.renderer.setClearColor(gl.scene.fog.color);
      } catch(e){
        message(e.message);
        console.error(e);
      }
    };
    const message = msg=>{
      document.getElementById("message").innerText = msg;
    }

    editor.commands.addCommand({
      name : "play",
      bindKey: {win:"Ctrl-Enter", mac:"Command-Enter"},
      exec: build
    });
    editor.setValue("@250\n@cp[red,yellow,green]\n{ry90x6}10{rx36}R\n#R{{x4rz-4ry6s0.99}R{s10#?}torus}\n#R@w4{{x4rz4ry6s0.99}R{s8,4,4}cylinder}");
    document.getElementById("runscript").addEventListener("click", build);

    gl.mainMaterial = new THREE.MeshStandardMaterial({vertexColors: THREE.VertexColors, metalness:0.1, roughness:0.9});
    gl.mainGeometry = null;
    gl.mainMesh = null;
    gl.floorMaterial = new THREE.MeshLambertMaterial({color:0x888888});
    gl.floorGeometry = new THREE.PlaneBufferGeometry(10000,10000);
    gl.floorGeometry.attributes.position.dynamic = true;
    gl.floor = new THREE.Mesh(gl.floorGeometry, gl.floorMaterial);
    gl.floor.receiveShadow = true;
    gl.scene.add(gl.floor);

    gl.scene.fog = new THREE.Fog(new THREE.Color(0x667799), 3000, 5000);
    gl.renderer.setClearColor(gl.scene.fog.color);

    gl.controls = new THREE.TrackballControls(gl.camera, gl.renderer.domElement);
    gl.controls.rotateSpeed = 4.0;
    gl.controls.zoomSpeed = 4.0;
    gl.controls.panSpeed = 0.6;
    gl.controls.noZoom = false;
    gl.controls.noPan = false;
    gl.controls.staticMoving = true;
    gl.controls.dynamicDampingFactor = 0.8;
    gl.controls.keys = [ 65, 83, 68 ];
  },
  draw: gl=>{
    gl.controls.update();
  }
});


