class BufferAccumlator {
  constructor(gl) {
    const renderTargetConf = {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      generateMipmaps: false,
      stencilBuffer: false,
      depthBuffer: false
    };
    this.renderTarget = gl.newRenderTarget(renderTargetConf);
    this.accumlationBuffer = gl.newRenderTarget(renderTargetConf);
    this.mult  = new RenderTargetOperator(gl.renderer, RenderTargetOperator.multShader);
    this.copy  = new RenderTargetOperator(gl.renderer, RenderTargetOperator.copyShader);
    this.blend = new RenderTargetOperator(gl.renderer, RenderTargetOperator.blendShader);
  }
  clear() {
    this.accumlateCount = 0;
  }
  accumlate(accumRenderTarget, alpha=1) {
    this.accumlateCount++;
    const blend = (this.accumlateCount < 1024) ? this.accumlateCount : 1024;
    this.blend.calc({"tSrc1":this.accumlationBuffer, "tSrc2":accumRenderTarget, "blend":alpha/blend}, this.renderTarget);
    this.copy.calc({"tSrc":this.renderTarget}, this.accumlationBuffer);
  }
  render(renderTarget, scale, add) {
    this.mult.calc({"tSrc1":renderTarget, "tSrc2":this.accumlationBuffer, scale, add});
    //this.copy.calc({"tSrc":this.renderTarget, "scale":1});
  }
}
class ShadowAccumlator {
  constructor(gl) {
    this.accumlator = new BufferAccumlator(gl);
    this.renderer = gl.renderer;
    this.renderTarget = gl.newRenderTarget({generateMipmaps: false});
    this.material = new THREE.MeshLambertMaterial({color:0xffffff});//, vertexColors: THREE.VertexColors
    this.light = new THREE.DirectionalLight(0xffffff, 1);
    this.light.castShadow = true;
    this.light.shadow.radius = 2.5;
    this.light.shadow.mapSize.width = 512;
    this.light.shadow.mapSize.height = 512;
    this.light.shadow.camera.near = 0.01;
    this.light.shadow.camera.far = 10000;
    this.boundingSphere = null;
    this.group = null;
    this.scene = new THREE.Scene();
    this.scene.add(this.light);
    this.scene.add(this.light.target);
    this.pause = false;
  }
  stop() {
    this.accumlator.clear();
    this.pause = true;
  }
  start() {
    this.accumlator.clear();
    this.pause = false;
  }
  setMeshes(meshList, boundingSphere) {
    if (this.group)
      this.scene.remove(this.group);
    this.group = new THREE.Group();
    if (meshList) {
      meshList.forEach(mesh=>{
        const newMesh = mesh.clone(); 
        newMesh.material = this.material;
        this.group.add(newMesh);
      });
      this.boundingSphere = boundingSphere;
      this.light.shadow.camera.bottom = - this.boundingSphere.radius;
      this.light.shadow.camera.top    = + this.boundingSphere.radius;
      this.light.shadow.camera.left   = - this.boundingSphere.radius;
      this.light.shadow.camera.right  = + this.boundingSphere.radius;
      this.light.shadow.camera.near = 0.01;
      this.light.shadow.camera.far = this.boundingSphere.radius*2;
      this.light.shadow.camera.updateProjectionMatrix();
      this.scene.add(this.group);
    }
    this.accumlator.clear();
  }
  render(camera, times) {
    if (!this.group || this.group.children.length == 0 || this.pause) return;
    const tempCamera = camera.clone(), 
          dir = new THREE.Vector3(),
          currentShadowMapType = this.renderer.shadowMap.type;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setClearColor(new THREE.Color(0xffffff));
    this.light.target.position.copy(this.boundingSphere.center);
    this.scene.add(tempCamera);
    if (this.accumlator.accumlateCount > 512) times = 1;
    for (let i=0; i<times; i++) {
      dir.set(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).setLength(this.boundingSphere.radius);
      this.light.position.addVectors(this.boundingSphere.center, dir);
      this.renderer.render(this.scene, tempCamera, this.renderTarget);
      this.accumlator.accumlate(this.renderTarget);
    }
    this.scene.remove(tempCamera);
    this.renderer.shadowMap.type = currentShadowMapType;
  }
  texture() {
    return this.accumlator.renderTarget.texture; 
  }
}

