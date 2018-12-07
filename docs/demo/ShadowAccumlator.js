class BufferAccumlator {
  constructor(gl) {
    const blendingShader = {
      "uniforms":  {
        "tAccum": { value: null },
        "tSource": { value: null },
        "blend": { value: 1.0 },
        "mul": { value: 1 },
        "add": { value: 0 },
      },
      "vertexShader": [
        "varying vec2 vUv;",
        "void main() { vUv = uv; gl_Position = vec4( position, 1.0 ); }"
      ].join( "\n" ),
      "fragmentShader": [
        "uniform sampler2D tAccum;",
        "uniform sampler2D tSource;",
        "uniform float blend;",
        "uniform float mul;",
        "uniform float add;",
        "varying vec2 vUv;",
        "void main() {",
          "vec4 acc = texture2D(tAccum, vUv);",
          "vec4 src = texture2D(tSource, vUv);",
          "gl_FragColor = mix(acc, src, blend) * mul + add;",
        "}" 
      ].join( "\n" ),
      transparent : true
      //blending : THREE.AdditiveBlending
    };
    this.renderer = gl.renderer;
    this.renderTarget = gl.newRenderTarget({
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      generateMipmaps: false,
      stencilBuffer: false,
      depthBuffer: false
    });
    this.accumlationBuffer = gl.newRenderTarget({
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      generateMipmaps: false,
      stencilBuffer: false,
      depthBuffer: false
    });
    this.blendingMaterial = new THREE.ShaderMaterial(blendingShader);
    this.blendingMaterial.uniforms.tAccum.value = this.accumlationBuffer.texture;
    this.mesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(2,2), this.blendingMaterial);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.scene = new THREE.Scene();
    this.scene.add(this.camera);
    this.scene.add(this.mesh);
  }
  clear() {
    this.accumlateCount = 0;
  }
  accumlate(tex2d, alpha=1) {
    this.accumlateCount++;
    const blend = (this.accumlateCount < 512) ? this.accumlateCount : 512;
    this.blendingMaterial.uniforms.mul.value = 1;
    this.blendingMaterial.uniforms.add.value = 0;
    this.blendingMaterial.uniforms.tAccum.value = this.accumlationBuffer.texture;
    this.blendingMaterial.uniforms.tSource.value = tex2d;
    this.blendingMaterial.uniforms.blend.value = alpha/blend;
    this.renderer.render(this.scene, this.camera, this.renderTarget);
    this.blendingMaterial.uniforms.tAccum.value = this.renderTarget.texture;
    this.blendingMaterial.uniforms.tSource.value = this.renderTarget.texture;
    this.blendingMaterial.uniforms.blend.value = 0;
    this.renderer.render(this.scene, this.camera, this.accumlationBuffer);
  }
  render(source, alpha) {
    this.blendingMaterial.uniforms.mul.value = 2.4;
    this.blendingMaterial.uniforms.add.value = -0.2;
    this.blendingMaterial.uniforms.tAccum.value = this.accumlationBuffer.texture;
    this.blendingMaterial.uniforms.tSource.value = source;
    this.blendingMaterial.uniforms.blend.value = alpha;
    this.renderer.render(this.scene, this.camera);
  }
}
class ShadowAccumlator {
  constructor(gl) {
    this.accumlator = new BufferAccumlator(gl);
    this.renderer = gl.renderer;
    this.renderTarget = gl.newRenderTarget({generateMipmaps: false});
    this.material = new THREE.MeshLambertMaterial({color:0xffffff});
    this.light = new THREE.DirectionalLight(0xffffff, 1);
    this.light.castShadow = true;
    this.light.shadow.mapSize.width = 512;
    this.light.shadow.mapSize.height = 512;
    this.light.shadow.camera.near = 0.01;
    this.light.shadow.camera.far = 100000;
    this.scene = new THREE.Scene();
    this.scene.add(this.light);
    this.scene.add(this.light.target);
    this.pause = false;
  }
  clear() {
    this.accumlator.clear();
  }
  stop() {
    this.accumlator.clear();
    this.pause = true;    
  }
  start() {
    this.accumlator.clear();
    this.pause = false;    
  }
  target(targetMesh) {
    if (this.targetMesh)
      this.scene.remove(this.targetMesh);
    this.targetMesh = new THREE.Mesh(targetMesh.geometry, this.material);
    this.targetMesh.geometry.computeBoundingSphere();
    this.targetMesh.castShadow = true;
    this.targetMesh.receiveShadow = true;
    const sphere = targetMesh.geometry.boundingSphere;
    this.light.shadow.camera.bottom = - sphere.radius;
    this.light.shadow.camera.top    = + sphere.radius;
    this.light.shadow.camera.left   = - sphere.radius;
    this.light.shadow.camera.right  = + sphere.radius;
    this.light.shadow.camera.updateProjectionMatrix();
    this.scene.add(this.targetMesh);
    this.accumlator.clear();
  }
  render(camera, times) {
    if (!this.targetMesh || this.pause) return;
    if (this.accumlator.accumlateCount > 256) times = 1;
    const sphere = this.targetMesh.geometry.boundingSphere, tempCamera = camera.clone(), dir = new THREE.Vector3();
    this.renderer.setClearColor(new THREE.Color(0xffffff));
    this.light.target.position.copy(sphere.center);
    this.scene.add(tempCamera);
    for (let i=0; i<times; i++) {
      dir.set(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).normalize().multiplyScalar(sphere.radius);
      this.light.position.addVectors(sphere.center, dir);
      this.renderer.render(this.scene, tempCamera, this.renderTarget);
      this.accumlator.accumlate(this.renderTarget.texture);
    }
    this.scene.remove(tempCamera);
  }
  texture() {
    return this.accumlator.renderTarget.texture; 
  }
}

