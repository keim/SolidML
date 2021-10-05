/**
 * @file Extention for three.js. SolidMLMaterial.js depends on three.js and SolidML.js. Import after these dependent files.
 */
/** 
 *  Physical Model Material with vertex alpha
 */
SolidML.Material = class extends THREE.ShaderMaterial {
  constructor(parameters) {
    super();
    // behaives as MeshPhysicalMaterial
    this.isMeshStandardMaterial = true;
    this.isMeshPhysicalMaterial = true;
    this.defines = { 'PHYSICAL': '' };
    // copy from THREE.MeshStandardMaterial
    this.color = new THREE.Color( 0xffffff ); // diffuse
    this.roughness = 0.5;
    this.metalness = 0.5;
    this.map = null;
    this.lightMap = null;
    this.lightMapIntensity = 1.0;
    this.aoMap = null;
    this.aoMapIntensity = 1.0;
    this.emissive = new THREE.Color( 0x000000 );
    this.emissiveIntensity = 0.0;
    this.emissiveMap = null;
    this.bumpMap = null;
    this.bumpScale = 1;
    this.normalMap = null;
    this.normalMapType = THREE.TangentSpaceNormalMap;
    this.normalScale = new THREE.Vector2( 1, 1 );
    this.displacementMap = null;
    this.displacementScale = 1;
    this.displacementBias = 0;
    this.roughnessMap = null;
    this.metalnessMap = null;
    this.alphaMap = null;
    this.envMap = null;
    this.envMapIntensity = 1.0;
    this.refractionRatio = 0.98;
    this.wireframe = false;
    this.wireframeLinewidth = 1;
    this.wireframeLinecap = 'round';
    this.wireframeLinejoin = 'round';
    this.skinning = false;
    this.morphTargets = false;
    this.morphNormals = false;
    // copy from THREE.MeshPhysicalMaterial
    this.reflectivity = 0.25; // maps to F0 = 0.04
    this.clearCoat = 0.3;
    this.clearCoatRoughness = 0.2;
    // set uniforms
    this.uniforms = THREE.UniformsUtils.merge([
      THREE.ShaderLib.standard.uniforms,
      {
        clearCoat: { value: 0.3 },
        clearCoatRoughness: { value: 0.2 },
      }
    ]);
    // set original shader
    const shaders = SolidML.Material._shaders();
    //this.glslVersion = THREE.GLSL3;
    this.vertexShader = shaders.vert;
    this.fragmentShader = shaders.frag;
    // custom depth map for shadowmap
    this.customDepthMaterial = new THREE.ShaderMaterial({
      defines: {
        'INSTANCED': "",
        'DEPTH_PACKING': THREE.RGBADepthPacking
      },
      vertexShader: shaders.depthVert,
      fragmentShader: shaders.depthFrag,
    });
    this.shadowSide = THREE.FrontSide;
    // transparent
    this.fog = true;
    this.lights = true;
    this.opacity = 1;
    this.transparent = true;
    // set values by hash
    this.setValues( parameters );
  }
  copy(source) {
    THREE.MeshPhysicalMaterial.prototype.copy.call(this, source);
    return this;
  }
  static _shaders() {
    // packing functions for reflective shadow map
    const rsm_packing = `
float unpackRGBAToRSMDepth(const in vec4 v) {
  return v.z * 255. / 65536. + v.w;
}
vec4 unpackRGBAToRSMAlbedo(const in vec4 v) {
  vec2 w = v.xy * 255. / 16.;
  return vec4(floor(w.x), fract(w.x)*16., floor(w.y), fract(w.y)*16.) / 15.;
}
vec4 packRSMtoRGBA(const in float depth, const in vec4 albedo, const in float glow){
  vec4 r = vec4(
    (floor(albedo.x * 15.) * 16. + floor(albedo.y * 15.)) / 256.,
    (floor(albedo.z * 15.) * 16. + floor(albedo.w * 15.)) / 256.,
    fract(depth*256.), depth);
  r.w -= r.z * ShiftRight8; // tidy overflow
  return r * PackUpscale;
}`;
    const rsm_pars_fragment = `
#ifdef USE_SHADOWMAP
  #if NUM_DIR_LIGHTS > 0
    uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHTS ];
    varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHTS ];
  #endif
  #if NUM_SPOT_LIGHTS > 0
    uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHTS ];
    varying vec4 vSpotShadowCoord[ NUM_SPOT_LIGHTS ];
  #endif
  #if NUM_POINT_LIGHTS > 0
    uniform sampler2D pointShadowMap[ NUM_POINT_LIGHTS ];
    varying vec4 vPointShadowCoord[ NUM_POINT_LIGHTS ];
  #endif
  float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
    return step( compare, unpackRGBAToRSMDepth( texture2D( depths, uv ) ) );
  }
  float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
    float shadow = 1.0;
    vec4 v;
    shadowCoord.xyz /= shadowCoord.w;
    shadowCoord.z += shadowBias;
    bool inFrustum = all(bvec4(shadowCoord.x >= 0.0, shadowCoord.x <= 1.0, shadowCoord.y >= 0.0, shadowCoord.y <= 1.0));
    if (all(bvec2(inFrustum, shadowCoord.z <= 1.0))) {
      #if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT )
        float texelSize = 1. / shadowMapSize.x;
        vec3 d = vec3(-texelSize, texelSize, 0)*shadowRadius;
        shadow = (
          texture2DCompare( shadowMap, shadowCoord.xy + d.xz, shadowCoord.z ) +
          texture2DCompare( shadowMap, shadowCoord.xy + d.zx, shadowCoord.z ) +
          texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
          texture2DCompare( shadowMap, shadowCoord.xy + d.yz, shadowCoord.z ) +
          texture2DCompare( shadowMap, shadowCoord.xy + d.zy, shadowCoord.z )
        ) * ( 1.0 / 5.0 );
      #else // no percentage-closer filtering:
        shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );
      #endif
    }
    return shadow;
  }
  vec2 cubeToUV( vec3 v, float texelSizeY ) { return vec2(0); }
#endif`;
    return {
      vert: `
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
varying vec3 vViewPosition;
varying vec3 vNormal;
varying vec4 vColor;
attribute vec4 color;
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
      frag: `
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
uniform float clearCoat;
uniform float clearCoatRoughness;
varying vec3 vViewPosition;
varying vec3 vNormal;
varying vec4 vColor;
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
//"shadowmap_pars_fragment", // <= change getShadow() call 
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
${rsm_packing}
${rsm_pars_fragment}
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
  // <= change getShadow() call
  /* insert irradiance caluration here */
  //"irradiance += shadowAlbedo.xyz * (1.-shadowAlbedo.a);"
  #include <lights_fragment_maps>
  #include <lights_fragment_end>
  vec3 outgoingLight
   = reflectedLight.directDiffuse
   + reflectedLight.indirectDiffuse
   + reflectedLight.directSpecular
   + reflectedLight.indirectSpecular
   + totalEmissiveRadiance;
  gl_FragColor = vec4(outgoingLight, diffuseColor.a);
  #include <tonemapping_fragment>
  #include <encodings_fragment>
  #include <fog_fragment>
  #include <premultiplied_alpha_fragment>
  #include <dithering_fragment>
}`,
      depthVert : `
#include <common>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#include <uv_vertex>
#include <skinbase_vertex>
attribute vec4 color;
varying vec4 vColor;
void main() {
  vColor = color;
  #ifdef USE_DISPLACEMENTMAP
    #include <beginnormal_vertex>
    #include <morphnormal_vertex>
    #include <skinnormal_vertex>
  #endif
  #include <begin_vertex>
  #include <morphtarget_vertex>
  #include <skinning_vertex>
  #include <displacementmap_vertex>
  #include <project_vertex>
  #include <logdepthbuf_vertex>
  #include <clipping_planes_vertex>
}`,
      depthFrag : `
#if DEPTH_PACKING == 3200
  uniform float opacity;
#endif
varying vec4 vColor;
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
${rsm_packing}
void main() {
  #include <clipping_planes_fragment>
  vec4 diffuseColor = vec4( 1.0 );
  #if DEPTH_PACKING == 3200
    diffuseColor.a = opacity;
  #endif
  #include <map_fragment>
  #include <alphamap_fragment>
  #include <alphatest_fragment>
  #include <logdepthbuf_fragment>
  #if DEPTH_PACKING == 3200
    gl_FragColor = vec4( vec3( 1.0 - (gl_FragCoord.z) ), opacity );
  #elif DEPTH_PACKING == 3201
    gl_FragColor = packRSMtoRGBA( gl_FragCoord.z, vColor, 0.);
  #endif",
}`
    };
  }
}
