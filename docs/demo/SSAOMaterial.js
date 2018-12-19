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
  }

  static _shaders() {
    const include = libs=>libs.map(lib=>"#include <"+lib+">").join("\n");
    const uniform = unis=>unis.map(uni=>"uniform "+uni+";").join("\n");
    return {
      vert: [
        "#version 300 es",
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
        "in vec4 color;",
        "out vec3 vViewPosition;", 
        "out vec3 vNormal;", 
        "out vec4 vColor;",
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
        "#version 300 es",
        "#define gl_FragColor vFragColor",
        uniform([
          "vec3 diffuse", 
          "vec3 emissive", 
          "float roughness", 
          "float metalness", 
          "float opacity", 
          "float clearCoat", 
          "float clearCoatRoughness"
        ]),
        "in vec3 vViewPosition;", 
        "in vec3 vNormal;", 
        "in vec4 vColor;",
        "layout (location = 0) out vec4 vFragColor;", 
        "layout (location = 1) out vec4 vDepthBuffer;", 
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
          ]),
          /* irradiance calcuration if want */
          //"irradiance += globalIlluminator();",
          include([
            "lights_fragment_maps",
            "lights_fragment_end"
          ]),
          "vec3 outgoingLight",
          " = reflectedLight.directDiffuse",
          " + reflectedLight.indirectDiffuse",
          " + reflectedLight.directSpecular",
          " + reflectedLight.indirectSpecular",
          " + totalEmissiveRadiance;",
          "vFragColor = vec4(outgoingLight, diffuseColor.a);",
          "vDepthBuffer = vec4(outgoingLight, diffuseColor.a);",
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