/**
 * @file Extention for three.js. SolidMLMaterial.js depends on three.js and SolidML.js. Import after these dependent files.
 */
/** 
 *  Physical Model Material with vertex alpha
 */
SolidML.Material = class extends THREE.ShaderMaterial {
  /**
   * Physical Model Material with vertex alpha
   * @param  {object} parameters initial Material paramaters
   */
  constructor(parameters) {
    super();
    // initialize parameters
    SolidML.Material._initializeParameters(this);
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
    this.vertexShader = shaders.vert;
    this.fragmentShader = shaders.frag;
    // transparent
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
  static _initializeParameters(material) {
    // behaives as MeshPhysicalMaterial
    material.isMeshStandardMaterial = true;
    material.isMeshPhysicalMaterial = true;
    material.defines = { 'PHYSICAL': '' };
    // copy from THREE.MeshStandardMaterial
    material.color = new THREE.Color( 0xffffff ); // diffuse
    material.roughness = 0.5;
    material.metalness = 0.5;
    material.map = null;
    material.lightMap = null;
    material.lightMapIntensity = 1.0;
    material.aoMap = null;
    material.aoMapIntensity = 1.0;
    material.emissive = new THREE.Color( 0x000000 );
    material.emissiveIntensity = 0.0;
    material.emissiveMap = null;
    material.bumpMap = null;
    material.bumpScale = 1;
    material.normalMap = null;
    material.normalMapType = THREE.TangentSpaceNormalMap;
    material.normalScale = new THREE.Vector2( 1, 1 );
    material.displacementMap = null;
    material.displacementScale = 1;
    material.displacementBias = 0;
    material.roughnessMap = null;
    material.metalnessMap = null;
    material.alphaMap = null;
    material.envMap = null;
    material.envMapIntensity = 1.0;
    material.refractionRatio = 0.98;
    material.wireframe = false;
    material.wireframeLinewidth = 1;
    material.wireframeLinecap = 'round';
    material.wireframeLinejoin = 'round';
    material.skinning = false;
    material.morphTargets = false;
    material.morphNormals = false;
    // copy from THREE.MeshPhysicalMaterial
    material.reflectivity = 0.25; // maps to F0 = 0.04
    material.clearCoat = 0.3;
    material.clearCoatRoughness = 0.2;
    return material;
  }
  static _shaders() {
    const include = libs=>libs.map(lib=>"#include <"+lib+">").join("\n");
    const uniform = unis=>unis.map(uni=>"uniform "+uni+";").join("\n");
    return {
      vert: [
        include([
          "common",
          "uv_pars_vertex",
          "uv2_pars_vertex",
          "displacementmap_pars_vertex",
          "fog_pars_vertex",
          "morphtarget_pars_vertex",
          "skinning_pars_vertex",
          "shadowmap_pars_vertex",
          "logdepthbuf_pars_vertex",
          "clipping_planes_pars_vertex"
        ]),
        "attribute vec4 color;",
        "varying vec3 vViewPosition;", 
        "varying vec3 vNormal;", 
        "varying vec4 vColor;",
        "void main() {",
          include([
            "uv_vertex", 
            "uv2_vertex"
          ]),
          "vColor = color;",
          include([
            "beginnormal_vertex", 
            "morphnormal_vertex", 
            "skinbase_vertex", 
            "skinnormal_vertex", 
            "defaultnormal_vertex"
          ]),
          "vNormal = normalize(transformedNormal);",
          include([
            "begin_vertex",
            "morphtarget_vertex",
            "skinning_vertex",
            "displacementmap_vertex",
            "project_vertex",
            "logdepthbuf_vertex",
            "clipping_planes_vertex"
          ]),
          "vViewPosition = -mvPosition.xyz;",
          include([
            "worldpos_vertex", 
            "shadowmap_vertex", 
            "fog_vertex"
          ]),
        "}"
      ].join("\n"),
      frag: [
        uniform([
          "vec3 diffuse", 
          "vec3 emissive", 
          "float roughness", 
          "float metalness", 
          "float opacity", 
          "float clearCoat", 
          "float clearCoatRoughness"
        ]),
        "varying vec3 vViewPosition;", 
        "varying vec3 vNormal;", 
        "varying vec4 vColor;",
        include([
          "common",
          "packing",
          "dithering_pars_fragment",
          "uv_pars_fragment",
          "uv2_pars_fragment",
          "map_pars_fragment",
          "alphamap_pars_fragment",
          "aomap_pars_fragment",
          "lightmap_pars_fragment",
          "emissivemap_pars_fragment",
          "bsdfs",
          "cube_uv_reflection_fragment",
          "envmap_pars_fragment",
          "envmap_physical_pars_fragment",
          "fog_pars_fragment",
          "lights_pars_begin",
          "lights_physical_pars_fragment",
          "shadowmap_pars_fragment", // <= getShadow() call 
          "bumpmap_pars_fragment",
          "normalmap_pars_fragment",
          "roughnessmap_pars_fragment",
          "metalnessmap_pars_fragment",
          "logdepthbuf_pars_fragment",
          "clipping_planes_pars_fragment"
        ]),
        "void main() {",
          include(["clipping_planes_fragment"]),
          "vec4 diffuseColor = vec4(diffuse, opacity);",
          "ReflectedLight reflectedLight = ReflectedLight(vec3(0), vec3(0), vec3(0), vec3(0));",
          "vec3 totalEmissiveRadiance = emissive;",
          include([
            "logdepthbuf_fragment",
            "map_fragment"
          ]),
          "diffuseColor.rgba *= vColor;",
          "float metalnessFactor = metalness;",
          "float roughnessFactor = roughness;",
          include([
            "alphamap_fragment",
            "alphatest_fragment",
            "normal_fragment_begin",
            "normal_fragment_maps",
            "emissivemap_fragment",
            "lights_physical_fragment",
            "lights_fragment_begin", // <= getShadow() call 
            "lights_fragment_maps",
            "lights_fragment_end"
          ]),
          "vec3 outgoingLight",
          " = reflectedLight.directDiffuse",
          " + reflectedLight.indirectDiffuse",
          " + reflectedLight.directSpecular",
          " + reflectedLight.indirectSpecular",
          " + totalEmissiveRadiance;",
          "gl_FragColor = vec4(outgoingLight, diffuseColor.a);",
          include([
            "tonemapping_fragment", 
            "encodings_fragment", 
            "fog_fragment", 
            "premultiplied_alpha_fragment", 
            "dithering_fragment"
          ]),
        "}"
      ].join("\n")
    };
  }
}
