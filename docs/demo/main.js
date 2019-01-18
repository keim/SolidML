class MainApp {
  constructor(gl) {
    this.gl = gl;

    // initialize
    this._setupEventListeners();
    this._setupProperties();
    this._setupRenderer();
    this._setupWorld();
    this._setupUI();
  }

  _setupEventListeners() {
    document.getElementById("version").textContent = SolidML.VERSION;
    document.getElementById("runscript").addEventListener("click", ()=>this.build(true));
    document.getElementById("capture").addEventListener("click", ()=>this.capture());
    window.addEventListener("popstate", ()=>this.updateCodeByURI());
  }

  _setupProperties() {
    this.AOenable = true;
    this.AOsharpness = 1;
    this.AOoffset = 0;
    this.GIstrength = 1;
    this.autoZPosition = true;
    this.autoCameraPosition = true;
    this.visibleFloor = true;
    this.visibleRoom = false;
    this.skyColor = "#679";
    this.floorColor = "#eee";
    this.checkColor = "#eee";
    this.updateGeometryByFrame = false;
  }

  _setupRenderer() {
    const size = this.gl.renderer.getSize();
    this.renderTarget = new WebGL2RenderTarget( size.width, size.height, { multipleRenderTargets:true, renderTargetCount:2 } );
    this.ssaoRenderer = new SSAORenderer(this.gl.renderer, { useInstancedMatrix : true } );
    this.customDepthMaterial = new SolidML.InstancedBuffer_DepthMaterial();
    this.accumlator = new GIAccumlator(this.gl, 256);
  }

  _setupWorld() {
    const gl = this.gl;

    gl.mainMaterial = this.ssaoRenderer.physicalMaterial;
    gl.mainGeometry = null;

    gl.backScreen = new BackScreen();
    gl.mainGroup = new THREE.Group();

    gl.floor = (mesh=>{
      mesh.geometry.attributes.position.dynamic = true;
      mesh.renderOrder = -1;
      mesh.receiveShadow = true;
      return mesh;
    })(new THREE.Mesh(
      new THREE.PlaneBufferGeometry(1,1),
      new THREE.ShadowMaterial({color:0x000000, opacity:0.4, depthWrite:true})
    ));

    gl.room = (mesh=>{
      mesh.geometry.attributes.position.dynamic = true;
      mesh.receiveShadow = true;
      return mesh;
    })(new THREE.Mesh(
      new THREE.BoxBufferGeometry(1,1,1).scale(-1,-1,-1),
      new THREE.MeshLambertMaterial({color:0xffffff})
    ));

    gl.cubeCamera = (camera=>{
      camera.renderTarget.texture.generateMipmaps = true;
      camera.renderTarget.texture.minFilter = THREE.LinearMipMapLinearFilter;
      return camera;
    })( new THREE.CubeCamera( 0.001, 10000, 256 ));

    gl.scene.add(gl.floor);
    gl.scene.add(gl.room);
    gl.scene.add(gl.backScreen);
    gl.scene.add(gl.mainGroup);
    gl.scene.add(gl.cubeCamera);
  }

  _setupUI() {
    this.stats = (stats=>{
      document.getElementById("stats").appendChild(stats.dom);
      stats.dom.style.left = "480px";
      stats.dom.style.top = "50px";
      return stats;
    })( new Stats() );

    this.editor = (editor=>{
      editor.$blockScrolling = Infinity;
      editor.commands.addCommand({
        name : "play",
        bindKey: {win:"Ctrl-Enter", mac:"Command-Enter"},
        exec: ()=>this.build(true)
      });
      editor.commands.addCommand({ // Restore last draft from localStorage
        name : "restore",
        bindKey: {win:"Alt-Z", mac:"Alt-Z"},
        exec: ()=>this.restore()
      });
      editor.commands.addCommand({ // Restore last draft from localStorage
        name : "capture",
        bindKey: {win:"Ctrl-S", mac:"Command-S"},
        exec: ()=>this.capture()
      });
      return editor;
    })( ace.edit("texteditor") );

    this.gui = (gui=>{
      document.getElementById("paramgui").appendChild(gui.domElement);
      gui.useLocalStorage = true;
      (ao=>{
        ao.closed = false;
        ao.add(this, 'AOenable');
        ao.add(this, 'AOsharpness', 0, 4, 0.1).onChange(v=>this.updateAOSharpness(v));
        ao.add(this, 'AOoffset',   -1, 1, 0.1);
        ao.add(this, 'GIstrength', 0, 4, 0.1);
      })( gui.addFolder("Ambient Occlusion") );
      (bg=>{
        bg.closed = true;
        bg.add(this, 'autoZPosition').onChange(v=>this.build(false));
        bg.add(this, 'autoCameraPosition').onChange(v=>this.build(false));
        bg.add(this, 'visibleFloor').onChange(v=>this.build(false));
        bg.addColor(this, 'skyColor').onChange(v=>this.updateBackScreen());
        bg.addColor(this, 'floorColor').onChange(v=>this.updateBackScreen());
        bg.addColor(this, 'checkColor').onChange(v=>this.updateBackScreen());
        //bg.add(this, 'visibleRoom').onChange(v=>{this.visibleRoom=v;this.build(false);});
      })( gui.addFolder("Background") );
      this.defineGUI = gui.addFolder("Definitions");
      this.defineGUI.closed = false;
      this.defineControls = [];
      return gui;
    })( new dat.GUI({autoPlace: false, closed: false}) );

    this.controls = (controls=>{
      controls.rotateSpeed = 3.0;
      controls.zoomSpeed = 3.0;
      controls.panSpeed = 0.5;
      controls.noZoom = false;
      controls.noPan = false;
      controls.staticMoving = true;
      controls.addEventListener("start", ()=>{
        this.accumlator.stop();
        return true;
      });
      controls.addEventListener("end", ()=>{
        this.accumlator.start();
        return true;
      });
      return controls;
    })( new THREE.TrackballControls(this.gl.camera, this.gl.renderer.domElement) );
  }


  build(updateURI) {
    const gl = this.gl;
    try{
      const code = this.editor.getValue();
      if (/^\s*$/.test(code)) return;
      window.localStorage.setItem('backup', code);

      gl.mainGeometry = new SolidML.InstancedBufferGeometry().build(code, {mat:"10,90,30,20", ao:"1,0"}, true, 0, 0);
      gl.solidML = gl.mainGeometry.solidML;
      this.message("vertex:"+gl.mainGeometry.vertexCount+"/face:"+gl.mainGeometry.indexCount/3+"/object:"+gl.mainGeometry.objectCount);

      [].concat(gl.mainGroup.children).forEach(child=>{
        gl.mainGroup.remove(child);
        child.geometry.dispose();
      });

      if (gl.mainGeometry.objectCount == 0) {
        this.accumlator.setMeshes(null);
        return;
      }

      if (updateURI)
        this.updateURI(code);

      if (gl.mainGeometry.isCompiled()) {
        // read criteria
        const mat = gl.solidML.criteria.getValue("mat", "array");
        if (mat.length > 0) gl.mainMaterial.metalness = parseFloat(mat[0]) / 100;
        if (mat.length > 1) gl.mainMaterial.roughness = parseFloat(mat[1]) / 100;
        if (mat.length > 2) gl.mainMaterial.clearCoat = parseFloat(mat[2]) / 100;
        if (mat.length > 3) gl.mainMaterial.clearCoatRoughness = parseFloat(mat[3]) / 100;
        const ao = gl.solidML.criteria.getValue("ao", "array");
        if (ao.length > 0) this.updateAOSharpness(parseFloat(ao[0]));
        if (ao.length > 1) this.AOoffset = parseFloat(ao[1]);
        const bg = gl.solidML.criteria.getValue("bg", "array");
        if (bg || gl.solidML.criteria.background) {
          this.skyColor   = gl.solidML.criteria.background || bg[0];
          this.floorColor = gl.solidML.criteria.background || bg[1] || bg[0];
          this.checkColor = gl.solidML.criteria.background || bg[2] || bg[1] || bg[0];
        }
        this.updateBackScreen();

        this.defineControls.forEach(c=>c.remove());
        this.defineControls = [];
        for (let key in gl.solidML.variables) {
          const val = gl.solidML.variables[key];
          const ctrl = this.defineGUI.add(gl.solidML.variables, key);
          ctrl.onChange(v=>{
            this.accumlator.stop();
            this.updateGeometry();
          });
          ctrl.onFinishChange(v=>{
            this.accumlator.start();
            this.updateGeometry();
          });
          this.defineControls.push(ctrl);
        }

        // compute boudings
        gl.mainGeometry.computeBoundingBox();
        gl.mainGeometry.computeBoundingSphere();
        const bbox = gl.mainGeometry.boundingBox,
              sphere = gl.mainGeometry.boundingSphere.clone(),
              zMargin = (this.autoZPosition) ? - Math.min(bbox.min.z, 0) + bbox.getSize(new THREE.Vector3()).z * 0.1 : 0;
        sphere.center.z += zMargin;

        this.controls.target = sphere.center;
        if (this.autoCameraPosition)
          gl.camera.position.sub(sphere.center).normalize().multiplyScalar(sphere.radius*4).add(sphere.center);
        //gl.camera.far = sphere.radius * 5;
        this.ssaoRenderer.updateCamera(gl.camera);

        gl.topLight.position.set(sphere.center.x, sphere.center.y, sphere.center.z+sphere.radius+1);
        gl.topLight.target.position.copy(sphere.center);
        gl.calcShadowingRange(gl.topLight, sphere);

        gl.room.material.color = gl.backScreen.skyColor;
        gl.room.position.copy(sphere.center);
        gl.room.scale.setScalar(sphere.radius*4);

        gl.floor.position.set(sphere.center.x, sphere.center.y, 0);
        gl.floor.scale.set(sphere.radius*10, sphere.radius*10, 1);

        gl.floor.visible = this.visibleFloor;
        gl.room.visible = this.visibleRoom;

        gl.cubeCamera.position.copy(sphere.center);
        gl.cubeCamera.update(gl.renderer, gl.scene);
        gl.mainMaterial.envMap = gl.cubeCamera.renderTarget.texture;
        gl.mainMaterial.envMapIntensity = 1;
        gl.mainMaterial.needsUpdate = true;

        /*
          const mesh = new THREE.Mesh(gl.mainGeometry, gl.mainMaterial);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          gl.mainGroup.add(mesh);
          this.accumlator.setMeshes([mesh, gl.floor, gl.room], sphere);
        */
        
        const aoMesh = [gl.floor, gl.room];
        gl.mainGeometry.instances.forEach(instance=>{
          const mesh = new THREE.Mesh(instance, gl.mainMaterial);
          mesh.customDepthMaterial = this.customDepthMaterial;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.frustumCulled = false;
          mesh.position.z = zMargin;
          aoMesh.push(mesh);
          gl.mainGroup.add(mesh);
        });
        this.accumlator.setMeshes(aoMesh, sphere);
      }
    } catch(e) {
      this.message(e.message, true);
    }
  }

  message(msg, isError) {
    document.getElementById("message").innerText = msg;
    if (isError) console.error(msg);
  }

  restore() {
    const backup = window.localStorage.getItem('backup');
    if (backup) this.editor.setValue(backup);
  }

  capture() {
    try {
      this.gl.capture("solidml.jpg", "image/jpeg");
    } catch (e) {
      this.message(e.message, true);
    }
  }

  updateURI(code) {
    const query = (/^\s*$/.test(code)) ? "" : "?s=" + encodeURIComponent(code);
    history.pushState(null, null, location.href.replace(/\?.*$/, "") + query);
  }

  updateCodeByURI() {
    if (location.search) {
      location.search.substring(1).split("&").map(s=>s.split("=")).forEach(query=>{
        switch(query[0]) {
          case "s":
            this.editor.setValue(decodeURIComponent(query[1]));
            this.build(false);
            break;
        }
      });
    }
  }

  updateAOSharpness(sharpness) {
    this.AOenable = (sharpness > 0);
    this.AOsharpness = sharpness;
  }

  updateBackScreen() {
    const gl = this.gl;
    if (this.visibleFloor) {
      gl.backScreen.skyColor   = new THREE.Color(this.skyColor);
      gl.backScreen.floorColor = new THREE.Color(this.floorColor);
      gl.backScreen.checkColor = new THREE.Color(this.checkColor);
    } else {
      gl.backScreen.skyColor   = new THREE.Color(this.skyColor);
      gl.backScreen.floorColor = gl.backScreen.skyColor;
      gl.backScreen.checkColor = gl.backScreen.skyColor;
    }
  }

  updateGeometry() {
    const gl = this.gl;
    const camdir = this.controls.target.clone().sub(gl.camera.position).normalize();
    gl.mainGeometry.update(camdir);
  }

  update() {
    this.stats.begin();
    this.controls.update();

    if (this.updateGeometryByFrame) 
      this.updateGeometry();

    if (this.accumlator.pause || !this.AOenable) {
      this.gl.render(this.renderTarget);
      this.ssaoRenderer.render(this.renderTarget);
      //copyShader.calc({tSrc:this.renderTarget.textures[1]});
    } else {
      this.gl.render(this.renderTarget);
      this.accumlator.render(this.gl.camera, 1);
      //this.accumlator.shadowAccumlator.mult(this.renderTarget, this.AOsharpness*2, this.AOoffset-(this.AOsharpness-1)/2, this.accumlator.shadowAccumlator.renderTarget);
      this.accumlator.lightAccumlator.add(this.renderTarget, this.GIstrength);
    }

    this.stats.end();
  }
}


new Ptolemy({
  containerid: 'screen',
  setup(gl) {
    gl.mainApp = new MainApp(gl);
    gl.mainApp.editor.setValue("20{x0.7h18rx25ry10}R\n#R{grid{s0.5sat0.7}dodeca}");
    gl.mainApp.updateCodeByURI();
  },
  draw(gl) {
    gl.mainApp.update();
  }
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

