class SSAORenderer {
  constructor(webGLRenderer, parameters) {
    if (!parameters) parameters = {};

    const shaders = SSAORenderer._shaders();
    const useInstancedMatrix = (parameters && parameters["useInstancedMatrix"]);
    delete parameters["useInstancedMatrix"];

    this.physicalMaterial = new THREE.ShaderMaterial(Object.assign(parameters, {
      uniforms: THREE.UniformsUtils.merge([
        THREE.ShaderLib.standard.uniforms, {
          clearCoat: { value: 0.3 },
          clearCoatRoughness: { value: 0.2 },
          cameraNear: { value: 1 },
          cameraFar: { value: 1000 }
        },
      ]),
      vertexShader : shaders.vert,
      fragmentShader : shaders.frag,
      lights: true,
      opacity: 1,
      transparent: true
    }));
    SolidML.Material._initializeParameters(this.physicalMaterial);

    if (useInstancedMatrix)
      Object.assign(this.physicalMaterial.defines, {"INSTANCED_MATRIX" : 1});

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
      "frag": SSAORenderer._shaders().ssao
    });
    this.ssaoUniforms = this.operator.defaultUniforms;
  }

  updateCamera(camera) {
    //https://www.khronos.org/opengl/wiki/Compute_eye_space_from_window_space
    const tanhfov = Math.tan(camera.fov*Math.PI/180/2);
    this.physicalMaterial.uniforms.cameraNear.value = camera.near;
    this.physicalMaterial.uniforms.cameraFar.value = camera.far;
    this.ssaoUniforms.tFragColor = null;
    this.ssaoUniforms.tDepthNormal = null;
    this.ssaoUniforms.cameraNear = camera.near;
    this.ssaoUniforms.cameraFar = camera.far;
    this.ssaoUniforms.projectionMatrix = camera.projectionMatrix;
    this.ssaoUniforms.halfSizeNearPlane = new THREE.Vector2(tanhfov * camera.aspect, tanhfov);
  }

  render(srcTarget, dstTarget=null) {
    this.ssaoUniforms.tFragColor = srcTarget.textures[0];
    this.ssaoUniforms.tDepthNormal = srcTarget.textures[1];
    this.operator.calc(this.ssaoUniforms, dstTarget);
  }

  static _shaders() {
const depthnormal_packing = `
float unpackDepth16(const in vec4 v) {
  return v.z * 255. / 65536. + v.w;
}
vec3 unpackNormal16(const in vec4 v) {
  vec2 xy = v.xy * UnpackDownscale * 2.0 - 1.0;
  return vec3( xy, sqrt(1. - (xy.x * xy.x + xy.y * xy.y)) );
}
vec4 packDepth16Normal16(const in float depth, const in vec3 normal) {
  vec4 r = vec4(normal.xy * 0.5 + 0.5, fract(depth*256.), depth);
  r.w -= r.z * ShiftRight8; // tidy overflow
  return r * PackUpscale;
}`;

const lights_physical_pars_fragment_DirectOnly = ""; /*`
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
}`;*/

const frag_view_conversion = `
vec4 depthToPosition(in float depth, in float cameraNear, in float cameraFar) {
  float viewZ = orthographicDepthToViewZ(depth, cameraNear, cameraFar);
  return vec4(vec3((vUv * 2.0 - 1.0) * -halfSizeNearPlane, -1) * viewZ, 1);
}`;

    return {
      vert: `#version 300 es
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
//-- modify <project_vertex>
  vec4 mvPosition = modelViewMatrix * vec4( transformed, 1.0 );
  gl_Position = projectionMatrix * mvPosition;
//--
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
#include <lights_physical_pars_fragment>
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
  vec4 position = depthToPosition(unpackDepth16(dat), cameraNear, cameraFar);
  gl_FragColor = texture2D(tFragColor, vUv);
}`
    }
  }
}
