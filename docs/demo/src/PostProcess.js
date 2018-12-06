class PostProcess {
  constructor(gl, accumMap) {
    const size = gl.renderer.getSize();
    this.renderTarget = new THREE.WebGLRenderTarget(size.width, size.height);
    this.renderTarget.texture.format = THREE.RGBFormat;
    this.renderTarget.texture.minFilter = THREE.NearestFilter;
    this.renderTarget.texture.magFilter = THREE.NearestFilter;
    this.renderTarget.texture.generateMipmaps = false;
    this.renderTarget.stencilBuffer = false;
    this.renderTarget.depthBuffer = true;
    this.renderTarget.depthTexture = new THREE.DepthTexture();
    this.renderTarget.depthTexture.type = THREE.UnsignedShortType;

    const shader = this._shader();
    this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.postMaterial = new THREE.ShaderMaterial( {
      vertexShader: shader.vert,
      fragmentShader: shader.frag,
      uniforms: {
        cameraNear: { value: gl.camera.near },
        cameraFar: { value: gl.camera.far },
        tDiffuse: { value: this.renderTarget.texture },
        tDepth: { value: this.renderTarget.depthTexture },
        tAccum: { value: accumMap }
      }
    });
    this.postScene = new THREE.Scene();
    this.postScene.add(new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2), this.postMaterial));
  }
  _shader() {
    const include = libs=>libs.map(lib=>"#include <"+lib+">").join("\n");
    const varying = vars=>vars.map(v  =>"varying "+v+";").join("\n");
    const uniform = unis=>unis.map(uni=>"uniform "+uni+";").join("\n");
    return {
      vert: "varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position,1.); }",
      frag: [
        include(["packing"]),
        varying(["vec2 vUv"]),
        uniform(["sampler2D tDiffuse", "sampler2D tDepth", "sampler2D tAccum", "float cameraNear", "float cameraFar"]),
        "float readDepth( sampler2D depthSampler, vec2 coord ) {",
          "float fragCoordZ = texture2D( depthSampler, coord ).x;",
          "float viewZ = perspectiveDepthToViewZ( fragCoordZ, cameraNear, cameraFar );",
          "return viewZToOrthographicDepth( viewZ, cameraNear, cameraFar );",
        "}",
        "void main() {",
          "vec3 diffuse = texture2D( tDiffuse, vUv ).rgb;",
          "vec3 accum = texture2D( tAccum, vUv ).rgb;",
          "float depth = readDepth( tDepth, vUv );",
          "gl_FragColor.rgb = diffuse;//*accum",
          "gl_FragColor.a = 1.0;",
        "}"
      ].join("\n")
    };
  }
}