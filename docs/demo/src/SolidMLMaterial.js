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
    this.vertexShader = shaders.vert;
    this.fragmentShader = shaders.frag;
    // custom depth map for shadowmap
    this.customDepthMaterial = new THREE.ShaderMaterial({
      defines: {
        'INSTANCED': "",
        'DEPTH_PACKING': THREE.RGBADepthPacking
      },
      vertexShader: shaders.depthVert,
      fragmentShader: shaders.depthFrag
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
    const include = libs=>libs.map(lib=>"#include <"+lib+">").join("\n");
    const varying = vars=>vars.map(v  =>"varying "+v+";").join("\n");
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
        varying([
          "vec3 vViewPosition", 
          "vec3 vNormal", 
          "vec4 vColor"
        ]),
        "attribute vec4 color;",
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
        varying([
          "vec3 vViewPosition", 
          "vec3 vNormal", 
          "vec4 vColor"
        ]),
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
          "shadowmap_pars_fragment",
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
            "lights_fragment_begin",
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
      ].join("\n"),
      "depthVert" : [
        include([
          "common",
          "uv_pars_vertex",
          "displacementmap_pars_vertex",
          "morphtarget_pars_vertex",
          "skinning_pars_vertex",
          "logdepthbuf_pars_vertex",
          "clipping_planes_pars_vertex",
          "uv_vertex",
          "skinbase_vertex"
        ]),
        "void main() {",
          "#ifdef USE_DISPLACEMENTMAP",
          include([
            "beginnormal_vertex",
            "morphnormal_vertex",
            "skinnormal_vertex"
          ]),
          "#endif",
          include([
            "begin_vertex",
            "morphtarget_vertex",
            "skinning_vertex",
            "displacementmap_vertex",
            "project_vertex",
            "logdepthbuf_vertex",
            "clipping_planes_vertex"
          ]),
        "}"
      ].join("\n"), 
      "depthFrag" : [
        "#if DEPTH_PACKING == 3200",
          "uniform float opacity;",
        "#endif",
        include([
          "common",
          "packing",
          "uv_pars_fragment",
          "map_pars_fragment",
          "alphamap_pars_fragment",
          "logdepthbuf_pars_fragment",
          "clipping_planes_pars_fragment"
        ]),
        "void main() {",
          include([
            "clipping_planes_fragment"
          ]),
          "vec4 diffuseColor = vec4( 1.0 );",
          "#if DEPTH_PACKING == 3200",
            "diffuseColor.a = opacity;",
          "#endif",
          include([
            "map_fragment",
            "alphamap_fragment",
            "alphatest_fragment",
            "logdepthbuf_fragment"
          ]),
          "#if DEPTH_PACKING == 3200",
            "gl_FragColor = vec4( vec3( 1.0 - (gl_FragCoord.z + 1./256.) ), opacity );",
          "#elif DEPTH_PACKING == 3201",
            "gl_FragColor = packDepthToRGBA( gl_FragCoord.z + 1./256.);",
          "#endif",
        "}"
      ].join("\n")
    };
  }
}
