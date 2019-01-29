class RenderTargetOperator {
  constructor(webGLRenderer, shader) {
    RenderTargetOperator._initialize(webGLRenderer);
    const uniforms = {}, frag = ["varying vec2 vUv;"];
    shader.uniforms.forEach(str=>{
      uniforms[str.split(/\s+/)[1]] = {"value": null};
      frag.push("uniform " + str + ";");
    });
    frag.push(shader.frag);
    this.defaultUniforms = shader.default || {};
    this.material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: RenderTargetOperator._vertexShader,
      fragmentShader: frag.join("\n")
    });
  }
  calc(uniforms, target=null) {
    RenderTargetOperator._mesh.material = this.material;
    for (let key in this.material.uniforms) 
      this.material.uniforms[key].value = (key in uniforms) ? 
        (uniforms[key].texture || uniforms[key]) : this.defaultUniforms[key];
    RenderTargetOperator._render(target);
  }
  static _initialize(webGLRenderer) {
    if (!RenderTargetOperator._renderer) {
      RenderTargetOperator._renderer = webGLRenderer;
      RenderTargetOperator._vertexShader = "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4( position, 1.0 ); }";
      RenderTargetOperator._mesh   = new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2), null);
      RenderTargetOperator._camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      RenderTargetOperator._scene  = new THREE.Scene();
      RenderTargetOperator._scene.add(RenderTargetOperator._camera);
      RenderTargetOperator._scene.add(RenderTargetOperator._mesh);
      RenderTargetOperator._render = dstRenderTarget => RenderTargetOperator._renderer.render(
        RenderTargetOperator._scene, 
        RenderTargetOperator._camera, 
        dstRenderTarget
      );
    }
  }
}
RenderTargetOperator.copyShader = {
  "uniforms" : [
    "sampler2D tSrc",
    "float scale",
    "float add"
  ],
  "default" : {
    "scale" : 1,
    "add" : 0
  },
  "frag": "void main() { gl_FragColor = texture2D(tSrc, vUv) * scale + add; }"
};
RenderTargetOperator.blendShader = {
  "uniforms" : [
    "sampler2D tSrc1",
    "sampler2D tSrc2",
    "float blend"
  ],
  "default" : {
    "blend" : 0.5,
  },
  "frag": "void main() { gl_FragColor = mix(texture2D(tSrc1, vUv), texture2D(tSrc2, vUv), blend); }"
};
RenderTargetOperator.multShader = {
  "uniforms" : [
    "sampler2D tSrc1",
    "sampler2D tSrc2",
    "float scale",
    "float add",
  ],
  "default" : {
    "scale" : 1,
    "add" : 0
  },
  "frag": "void main() { gl_FragColor = texture2D(tSrc1, vUv) * clamp(texture2D(tSrc2, vUv) * scale + add, vec4(0), vec4(1)); }"
};
RenderTargetOperator.addShader = {
  "uniforms" : [
    "sampler2D tSrc1",
    "sampler2D tSrc2",
    "float scale",
  ],
  "default" : {
    "scale" : 1,
  },
  "frag": "void main() { gl_FragColor = texture2D(tSrc1, vUv) + texture2D(tSrc2, vUv) * scale; }"
};
RenderTargetOperator.gaussBlurShader = {
  "uniforms" : [
    "sampler2D tSrc",
    "float ustep",
    "float vstep"
  ],
  "default" : {
    "ustep" : 1,
    "vstep" : 0
  },
  "frag": `void main() { 
  gl_FragColor = texture2D(tSrc, vUv) * 0.204
               + texture2D(tSrc, vUv - uvStep * 4.0) * 0.028
               + texture2D(tSrc, vUv - uvStep * 3.0) * 0.066
               + texture2D(tSrc, vUv - uvStep * 2.0) * 0.124
               + texture2D(tSrc, vUv - uvStep * 1.0) * 0.180
               + texture2D(tSrc, vUv + uvStep * 1.0) * 0.180
               + texture2D(tSrc, vUv + uvStep * 2.0) * 0.124
               + texture2D(tSrc, vUv + uvStep * 3.0) * 0.066
               + texture2D(tSrc, vUv + uvStep * 4.0) * 0.028;}`
};