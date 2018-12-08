class BufferAccumlator {
  constructor(gl) {
    this.multShader = new THREE.ShaderMaterial({
      "uniforms":  {
        "tSrc1": { value: null },
        "tSrc2": { value: null },
        "mul": { value: null },
        "add": { value: null },
      },
      "vertexShader": [
        "varying vec2 vUv;",
        "void main() { vUv = uv; gl_Position = vec4( position, 1.0 ); }"
      ].join( "\n" ),
      "fragmentShader": [
        "uniform sampler2D tSrc1;",
        "uniform sampler2D tSrc2;",
        "uniform float mul;",
        "uniform float add;",
        "varying vec2 vUv;",
        "void main() {",
          "gl_FragColor = texture2D(tSrc1, vUv) * clamp(texture2D(tSrc2, vUv) * mul + add, vec4(0), vec4(1));",
        "}" 
      ].join( "\n" )
    });
    this.copyShader = new THREE.ShaderMaterial({
      "uniforms":  {
        "tSrc": { value: null },
      },
      "vertexShader": [
        "varying vec2 vUv;",
        "void main() { vUv = uv; gl_Position = vec4( position, 1.0 ); }"
      ].join( "\n" ),
      "fragmentShader": [
        "uniform sampler2D tSrc;",
        "varying vec2 vUv;",
        "void main() {",
          "gl_FragColor = texture2D(tSrc, vUv);",
        "}" 
      ].join( "\n" )
    });
    this.blendShader = new THREE.ShaderMaterial({
      "uniforms":  {
        "tSrc1": { value: null },
        "tSrc2": { value: null },
        "blend": { value: 1.0 }
      },
      "vertexShader": [
        "varying vec2 vUv;",
        "void main() { vUv = uv; gl_Position = vec4( position, 1.0 ); }"
      ].join( "\n" ),
      "fragmentShader": [
        "uniform sampler2D tSrc1;",
        "uniform sampler2D tSrc2;",
        "uniform float blend;",
        "varying vec2 vUv;",
        "void main() {",
          "gl_FragColor = mix(texture2D(tSrc1, vUv), texture2D(tSrc2, vUv), blend);",
        "}" 
      ].join( "\n" )
    });
    const renderTargetConf = {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      generateMipmaps: false,
      stencilBuffer: false,
      depthBuffer: false
    };
    this.renderer = gl.renderer;
    this.renderTarget = gl.newRenderTarget(renderTargetConf);
    this.accumlationBuffer = gl.newRenderTarget(renderTargetConf);
    this.mesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(2,2), this.copyShader);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.scene = new THREE.Scene();
    this.scene.add(this.camera);
    this.scene.add(this.mesh);
  }
  blend(srcRenderTarget1, srcRenderTarget2, blend, dstTargetTarget) {
    this.mesh.material = this.blendShader;
    this.blendShader.uniforms.tSrc1.value = srcRenderTarget1.texture;
    this.blendShader.uniforms.tSrc2.value = srcRenderTarget2.texture;
    this.blendShader.uniforms.blend.value = blend;
    this.renderer.render(this.scene, this.camera, dstTargetTarget);
  }
  copy(srcRenderTarget, dstTargetTarget) {
    this.mesh.material = this.copyShader;
    this.copyShader.uniforms.tSrc.value = srcRenderTarget.texture;
    this.renderer.render(this.scene, this.camera, dstTargetTarget);
  }
  mult(srcRenderTarget1, srcRenderTarget2, mul, add, dstTargetTarget) {
    this.mesh.material = this.multShader;
    this.multShader.uniforms.tSrc1.value = srcRenderTarget1.texture;
    this.multShader.uniforms.tSrc2.value = srcRenderTarget2.texture;
    this.multShader.uniforms.mul.value = mul;
    this.multShader.uniforms.add.value = add;
    this.renderer.render(this.scene, this.camera, dstTargetTarget);
  }
  clear() {
    this.accumlateCount = 0;
  }
  accumlate(accumRenderTarget, alpha=1) {
    this.accumlateCount++;
    const blend = (this.accumlateCount < 1024) ? this.accumlateCount : 1024;
    this.blend(this.accumlationBuffer, accumRenderTarget, alpha/blend, this.renderTarget);
    this.copy(this.renderTarget, this.accumlationBuffer);
  }
  render(renderTarget, alpha) {
    this.mult(renderTarget, this.accumlationBuffer, 2, 0, null);
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
    this.light.shadow.mapSize.width = 512;
    this.light.shadow.mapSize.height = 512;
    this.light.shadow.camera.near = 0.01;
    this.light.shadow.camera.far = 100000;
    this.boundingBoxSize = new THREE.Vector3();
    this.boundingBoxCenter = new THREE.Vector3();
    this.boundingBoxRadius = 0;
    this.scene = new THREE.Scene();
    this.scene.add(this.light);
    this.scene.add(this.light.target);
    this.group = new THREE.Group();
    this.scene.add(this.group);
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
  setMeshes(meshList, boundingBox) {
    this.group.children.forEach(child=>this.group.remove(child));
    meshList.forEach(mesh=>{
      const newMesh = new THREE.Mesh(mesh.geometry, this.material); 
      newMesh.castShadow = true;
      newMesh.receiveShadow = true;
      this.group.add(newMesh);
    });
    this.boundingBox = boundingBox;
    boundingBox.getSize(this.boundingBoxSize);
    boundingBox.getCenter(this.boundingBoxCenter);
    this.boundingBoxRadius = this.boundingBoxSize.length() * 0.5;
    this.light.shadow.camera.bottom = - this.boundingBoxRadius;
    this.light.shadow.camera.top    = + this.boundingBoxRadius;
    this.light.shadow.camera.left   = - this.boundingBoxRadius;
    this.light.shadow.camera.right  = + this.boundingBoxRadius;
    this.light.shadow.camera.updateProjectionMatrix();
    this.accumlator.clear();
  }
  render(camera, times) {
    if (this.group.children.length == 0 || this.pause) return;
    const tempCamera = camera.clone(), 
          dir = new THREE.Vector3();
    this.renderer.setClearColor(new THREE.Color(0xffffff));
    this.light.target.position.copy(this.boundingBoxCenter);
    this.scene.add(tempCamera);
    if (this.accumlator.accumlateCount > 512) times = 1;
    for (let i=0; i<times; i++) {
      dir.set(Math.random()-0.5, Math.random()-0.5, Math.random()-0.2).setLength(this.boundingBoxRadius);
      this.light.position.addVectors(this.boundingBoxCenter, dir);
      this.renderer.render(this.scene, tempCamera, this.renderTarget);
      this.accumlator.accumlate(this.renderTarget);
    }
    this.scene.remove(tempCamera);
  }
  texture() {
    return this.accumlator.renderTarget.texture; 
  }
}

