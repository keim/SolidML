class SSAOMaterial extends THREE.ShaderMaterial {
  constructor() {
    super();
    SolidML.Material._initializeParameters(this);
    // set uniforms
    this.uniforms = THREE.UniformsUtils.merge([
      THREE.ShaderLib.standard.uniforms,
      {
        clearCoat: { value: 0.3 },
        clearCoatRoughness: { value: 0.2 },
        cameraNear: { value: 1 },
        cameraFar: { value: 1000 }
      }
    ]);
    // set original shader
    const shaders = SSAOMaterial._shaders();
    this.vertexShader = shaders.vert;
    this.fragmentShader = shaders.frag;
    // transparent
    this.lights = true;
    this.opacity = 1;
    this.transparent = true;

    this.ssaoUniforms = {};
  }

  initialize(webGLRenderer) {
    this.operator = new RenderTargetOperator(webGLRenderer, {
      "uniforms": [
        "sampler2D tFragColor",
        "sampler2D tDepthNormal",
        "mat4 projectionMatrix",
        "vec2 halfSizeNearPlane",
        "float cameraNear",
        "float cameraFar",
      ],
      "default": {
        "tFragColor": null,
        "tDepthNormal": null,
        "projectionMatrix": new THREE.Matrix4(),
        "halfSizeNearPlane": new THREE.Vector2(),
        "cameraNear": 1,
        "cameraFar": 1000
      },
      "frag": SSAOMaterial._shaders().ssao
    });
    this.ssaoUniforms = this.operator.defaultUniforms;
  }

  updateCamera(camera) {
    //https://www.khronos.org/opengl/wiki/Compute_eye_space_from_window_space
    const tanhfov = Math.tan(camera.fov/2.0);
    this.uniforms.cameraNear.value = camera.near;
    this.uniforms.cameraFar.value = camera.near;
    this.ssaoUniforms.tFragColor = null;
    this.ssaoUniforms.tDepthNormal = null;
    this.ssaoUniforms.cameraNear = camera.near;
    this.ssaoUniforms.cameraFar = camera.near;
    this.ssaoUniforms.projectionMatrix = camera.projectionMatrix;
    this.ssaoUniforms.halfSizeNearPlane = new THREE.Vector2(tanhfov * camera.aspect, tanhfov);
  }

  static _shaders() {
const depthnormal_packing = `
float unpackDepth16(const in vec4 v) {
  return v.z * 255. / 65536. + v.w;
}
vec3 unpackNormal16(const in vec4 v) {
  return vec3( v.xy, sqrt(1. - (v.x * v.x + v.y * v.y)) );
}
vec4 packDepth16Normal16(const in float depth, const in vec3 normal) {
  vec4 r = vec4(normal.xy, fract(depth*256.), depth);
  r.w -= r.z * ShiftRight8; // tidy overflow
  return r * PackUpscale;
}`;

const lights_physical_pars_fragment_DirectOnly = `
struct PhysicalMaterial {
  vec3  diffuseColor;
  float specularRoughness;
  vec3  specularColor;
  float clearCoat;
  float clearCoatRoughness;
};
#define MAXIMUM_SPECULAR_COEFFICIENT 0.16
#define DEFAULT_SPECULAR_COEFFICIENT 0.04
float clearCoatDHRApprox( const in float roughness, const in float dotNL ) {
  return DEFAULT_SPECULAR_COEFFICIENT + ( 1.0 - DEFAULT_SPECULAR_COEFFICIENT ) * ( pow( 1.0 - dotNL, 5.0 ) * pow( 1.0 - roughness, 2.0 ) );
}
void RE_Direct_Physical( const in IncidentLight directLight, const in GeometricContext geometry, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
  float dotNL = saturate( dot( geometry.normal, directLight.direction ) );
  vec3 irradiance = dotNL * directLight.color;
  irradiance *= PI; // punctual light
  float clearCoatDHR = material.clearCoat * clearCoatDHRApprox( material.clearCoatRoughness, dotNL );
  reflectedLight.directSpecular += ( 1.0 - clearCoatDHR ) * irradiance * BRDF_Specular_GGX( directLight, geometry, material.specularColor, material.specularRoughness );
  reflectedLight.directDiffuse += ( 1.0 - clearCoatDHR ) * irradiance * BRDF_Diffuse_Lambert( material.diffuseColor );
  reflectedLight.directSpecular += irradiance * material.clearCoat * BRDF_Specular_GGX( directLight, geometry, vec3( DEFAULT_SPECULAR_COEFFICIENT ), material.clearCoatRoughness );
}
#define RE_Direct RE_Direct_Physical
#define Material_BlinnShininessExponent( material )   GGXRoughnessToBlinnExponent( material.specularRoughness )
#define Material_ClearCoat_BlinnShininessExponent( material )   GGXRoughnessToBlinnExponent( material.clearCoatRoughness )
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
  return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`;

const frag_view_conversion = `
vec4 fragToView(in float viewZ) {
  float ndcZ = (2.0 * viewZ - cameraNear - cameraFar) / (cameraFar - cameraNear);
  float eyeZ = projectionMatrix[3][2] / ((projectionMatrix[2][3] * ndcZ) - projectionMatrix[2][2]);
  return vec4(vec3((2.0 * halfSizeNearPlane * vUv) - halfSizeNearPlane , -1) * eyeZ, 1);
}`;

    return {
      vert: `#version 300 es
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
in vec4 color;
out vec3 vViewPosition;
out vec3 vNormal;
out vec4 vColor;
void main() {
  #include <uv_vertex>
  #include <uv2_vertex>
  vColor = color;
  #include <beginnormal_vertex>
  #include <morphnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <defaultnormal_vertex>
  vNormal = normalize(transformedNormal);
  #include <begin_vertex>
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
}`,
      frag: `#version 300 es
#define gl_FragColor vFragColor
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
//#include <lights_physical_pars_fragment>
${lights_physical_pars_fragment_DirectOnly}
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
}`,
      ssao: `
#include <packing>
${depthnormal_packing}
${frag_view_conversion}
void main() {
  vec4 dat = texture2D(tDepthNormal, vUv);
  vec3 normal = unpackNormal16(dat);
  float viewZ = orthographicDepthToViewZ(unpackDepth16(dat), cameraNear, cameraFar);
  vec4 position = fragToView(viewZ);
  gl_FragColor = texture2D(tFragColor, vUv);
}`
    }
  }
}
