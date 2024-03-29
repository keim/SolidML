class SSAORenderer {
  constructor(webGLRenderer, materialParameters) {
    const size = webGLRenderer.getSize(new THREE.Vector2());
    this.physicalMaterial = new SSAORenderer.PhysicalMaterial(materialParameters);

    let shadowSize = 3;
    this.operator1 = new RenderTargetOperator(webGLRenderer, {
      "uniforms": [
        "sampler2D tDepthNormal",
        "float ustep",
      ],
      "default": {
        "tDepthNormal": null,
        "ustep": shadowSize/size.width,
      },
      "frag": this.physicalMaterial.ssaoFrag1
    });
    this.operator2 = new RenderTargetOperator(webGLRenderer, {
      "uniforms": [
        "sampler2D tFragColor",
        "sampler2D tDepthNormal",
        "sampler2D tDepthNormalSmooth",
        "float vstep"
      ],
      "default": {
        "tFragColor": null,
        "tDepthNormal": null,
        "tDepthNormalSmooth": null,
        "vstep": shadowSize/size.height
      },
      "frag": this.physicalMaterial.ssaoFrag2
    });
    this.tempRenderTarget = new THREE.WebGLRenderTarget( size.width, size.height ); //, { multipleRenderTargets:true, renderTargetCount:2 }
    this.ssaoUniforms1 = {"tDepthNormal": null};
    this.ssaoUniforms2 = {"tDepthNormal": null, "tDepthNormalSmooth":null, "tFragColor":null};
  }

  updateCamera(camera) {
    //https://www.khronos.org/opengl/wiki/Compute_eye_space_from_window_space
    const tanhfov = Math.tan(camera.fov*Math.PI/180/2);
    this.physicalMaterial.uniforms.cameraNear.value = camera.near;
    this.physicalMaterial.uniforms.cameraFar.value = camera.far;
  }

  render(srcTarget, dstTarget=null) {
    this.ssaoUniforms1.tDepthNormal = srcTarget.textures[1];
    this.ssaoUniforms2.tFragColor = srcTarget.textures[0];
    this.ssaoUniforms2.tDepthNormal = srcTarget.textures[1];
    this.ssaoUniforms2.tDepthNormalSmooth = this.tempRenderTarget.texture;
    this.operator1.calc(this.ssaoUniforms1, this.tempRenderTarget);
    this.operator2.calc(this.ssaoUniforms2, dstTarget);
  }
}


SSAORenderer.PhysicalMaterial = class extends THREE.ShaderMaterial {
  constructor(parameters) {
    super();
    this.uniforms = THREE.UniformsUtils.merge([
      THREE.ShaderLib.physical.uniforms, {
        cameraNear: { value: 1 },
        cameraFar: { value: 1000 }
    }]);
    this._initShader();
    this.lights = true;

    this.glslVersion = THREE.GLSL3;
    this.opacity = 1;
		this.clearcoat = 0;
		this.ior = 1.5;
		this.sheen = 0;
		this.transmission = 0;
		this.specularIntensity = 0;
		this.specularTint = new THREE.Color();
    this.useInstancedMatrix = parameters["useInstancedMatrix"];
    delete parameters["useInstancedMatrix"];

    this.setValues(parameters);
    SolidML.Material._initializeParameters(this);
    Object.assign(this.defines, {
      "DEPTH_PACKING": THREE.RGBADepthPacking}, 
      this.useInstancedMatrix ? {"INSTANCED_MATRIX" : 1} : {}
    );
  }

  _initShader() {
const depthnormal_packing = `
float unpackDepth16(const in vec4 v) {
  return v.z * 255. / 65536. + v.w;
}
vec3 unpackNormal16(const in vec4 v) {
  vec2 xy = v.xy * (255. / 256.) * 2.0 - 1.0;
  return vec3( xy, sqrt(1. - (xy.x * xy.x + xy.y * xy.y)) );
}
vec4 packDepth16Normal16(const in float depth, const in vec3 normal) {
  vec4 r = vec4(normal.xy * 0.5 + 0.5, fract(depth*256.), depth);
  r.w -= r.z * (1. / 256.); // tidy overflow
  return r * (256. / 255.);
}`;
const position_unpacking = `
float orthographicDepthToViewZ( const in float linearClipZ, const in float near, const in float far ) {
  return linearClipZ * ( near - far ) - near;
}
vec4 depthToviewZ(in vec2 uv, in float near, in float far) {
  return orthographicDepthToViewZ(unpackDepth16(texture2D(tDepthNormal, uv)), near, far);
}
vec4 depthToPosition(in vec2 uv, in float near, in float far) {
  return vec4(vec3((uv * 2.0 - 1.0) * -halfSizeNearPlane, -1) * depthToviewZ(uv, near, far), 1);
}`;
    this.ssaoFrag1 = `
${depthnormal_packing}
void main() {
  vec2 uvStep = vec2(ustep,0);
  vec4 p = texture2D(tDepthNormal, vUv);
  vec3 n = unpackNormal16(p);
  float d = unpackDepth16(p) * 0.204
          + unpackDepth16(texture2D(tDepthNormal, vUv - uvStep * 4.0)) * 0.028
          + unpackDepth16(texture2D(tDepthNormal, vUv - uvStep * 3.0)) * 0.066
          + unpackDepth16(texture2D(tDepthNormal, vUv - uvStep * 2.0)) * 0.124
          + unpackDepth16(texture2D(tDepthNormal, vUv - uvStep * 1.0)) * 0.180
          + unpackDepth16(texture2D(tDepthNormal, vUv + uvStep * 1.0)) * 0.180
          + unpackDepth16(texture2D(tDepthNormal, vUv + uvStep * 2.0)) * 0.124
          + unpackDepth16(texture2D(tDepthNormal, vUv + uvStep * 3.0)) * 0.066
          + unpackDepth16(texture2D(tDepthNormal, vUv + uvStep * 4.0)) * 0.028;
  gl_FragColor = packDepth16Normal16(d, n);
}`;
    this.ssaoFrag2 = `
${depthnormal_packing}
void main() {
  vec2 uvStep = vec2(0,vstep);
  float depth = unpackDepth16(texture2D(tDepthNormal, vUv));
  vec4 p = texture2D(tDepthNormalSmooth, vUv);
  vec3 n = unpackNormal16(p);
  float d = unpackDepth16(p) * 0.204
          + unpackDepth16(texture2D(tDepthNormalSmooth, vUv - uvStep * 4.0)) * 0.028
          + unpackDepth16(texture2D(tDepthNormalSmooth, vUv - uvStep * 3.0)) * 0.066
          + unpackDepth16(texture2D(tDepthNormalSmooth, vUv - uvStep * 2.0)) * 0.124
          + unpackDepth16(texture2D(tDepthNormalSmooth, vUv - uvStep * 1.0)) * 0.180
          + unpackDepth16(texture2D(tDepthNormalSmooth, vUv + uvStep * 1.0)) * 0.180
          + unpackDepth16(texture2D(tDepthNormalSmooth, vUv + uvStep * 2.0)) * 0.124
          + unpackDepth16(texture2D(tDepthNormalSmooth, vUv + uvStep * 3.0)) * 0.066
          + unpackDepth16(texture2D(tDepthNormalSmooth, vUv + uvStep * 4.0)) * 0.028;
  float shadow = clamp(((depth-d) - 0.5)*2.0, 0., 1.);
  vec4 color = texture2D(tFragColor, vUv);
  gl_FragColor = vec4(color.xyz - vec3(shadow), color.w);
}`;

    this.vertexShader = `
in vec4 color;
#ifdef INSTANCED_MATRIX
  in vec4 imatx;
  in vec4 imaty;
  in vec4 imatz;
  in vec4 imatw;
#endif
out vec3 vViewPosition;
out vec3 vNormal;
out vec4 vColor;
#include <common>
#include <uv_pars_vertex>
#include <uv2_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
  #include <uv_vertex>
  #include <uv2_vertex>
//-- modify <color_vertex>
  vColor = color;
//-- modify <beginnormal_vertex>
#ifdef INSTANCED_MATRIX
  mat4 imat = mat4(imatx, imaty, imatz, imatw);
  vec3 transformed  = ( imat * vec4(position.xyz, 1) ).xyz;
  vec3 objectNormal = ( imat * vec4(normal.xyz,   0) ).xyz;
#else
  vec3 transformed = vec3( position );
  vec3 objectNormal = vec3( normal );
#endif
//-- 
  #include <morphnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <defaultnormal_vertex>
  vNormal = normalize(transformedNormal);
  #include <morphtarget_vertex>
  #include <skinning_vertex>
  #include <displacementmap_vertex>
  #include <project_vertex>
  #include <logdepthbuf_vertex>
  #include <clipping_planes_vertex>
  vViewPosition = -mvPosition.xyz;
  #include <worldpos_vertex> 
  #include <shadowmap_vertex> 
  #include <fog_vertex>
}`;

    this.fragmentShader = `
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
uniform float clearCoat;
uniform float clearCoatRoughness;
uniform float cameraNear;
uniform float cameraFar;
in vec3 vViewPosition; 
in vec3 vNormal;
in vec4 vColor;
layout (location = 0) out vec4 vFragColor;
layout (location = 1) out vec4 vDepthNormal;
#define gl_FragColor vFragColor
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <uv_pars_fragment>
#include <uv2_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <bsdfs>
#include <cube_uv_reflection_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <lights_physical_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
${depthnormal_packing}
void main() {
  #include <clipping_planes_fragment>
  vec4 diffuseColor = vec4(diffuse, opacity);
  ReflectedLight reflectedLight = ReflectedLight(vec3(0), vec3(0), vec3(0), vec3(0));
  vec3 totalEmissiveRadiance = emissive;
  #include <logdepthbuf_fragment>
  #include <map_fragment>
  diffuseColor.rgba *= vColor;
  float metalnessFactor = metalness;
  float roughnessFactor = roughness;
  #include <alphamap_fragment>
  #include <alphatest_fragment>
  #include <normal_fragment_begin>
  #include <normal_fragment_maps>
  #include <emissivemap_fragment>
  #include <lights_physical_fragment>
  #include <lights_fragment_begin>
  #include <lights_fragment_maps>
  #include <lights_fragment_end>
  vec3 outgoingLight = reflectedLight.directDiffuse
                     + reflectedLight.indirectDiffuse
                     + reflectedLight.directSpecular
                     + reflectedLight.indirectSpecular
                     + totalEmissiveRadiance;
  vFragColor = vec4(outgoingLight, diffuseColor.a);
  float depth = viewZToOrthographicDepth(-vViewPosition.z, cameraNear, cameraFar);
  vDepthNormal = packDepth16Normal16(depth, vNormal);
  #include <tonemapping_fragment> 
  #include <encodings_fragment> 
  #include <fog_fragment> 
  #include <premultiplied_alpha_fragment> 
  #include <dithering_fragment>
}`;
  }
}
