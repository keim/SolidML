/**
 * @file Extention for three.js. SolidMLMaterial.js depends on three.js and SolidML.js. Import after these dependent files.
 */
/** 
 *  Physical Model Material with vertex alpha
 */
SolidML.Material = class extends THREE.ShaderMaterial {
  constructor() {
    super();
    this.isShaderMaterial = false;
    this.MeshPhysicalMaterial = true;
    this.defines = {'PHYSICAL': ''};
    this.uniforms = THREE.UniformsUtils.merge([
      THREE.UniformsLib.common,
      THREE.UniformsLib.fog,
      THREE.UniformsLib.lights,
      {
        emissive: { value: new THREE.Color( 0x000000 ) },
        roughness: { value: 0.9 },
        metalness: { value: 0.1 },
        clearCoat: { value: 0.0 },
        clearCoatRoughness: { value: 0.0 },
        envMapIntensity: { value: 1 }
      }
    ]);
    const shaders = SolidML.Material._crateShaders()
    this.vertexShader = shaders.vert;
    this.fragmentShader = shaders.frag;
    this.lights = true;
    this.fog = true;
    this.opacity = 1;
    this.transparent = true;
    this.envMap = null;
    this.envMapIntensity = 1.0;
    this.refractionRatio = 0.98;
    this.reflectivity = 0.5;
    this.color = new THREE.Color(0xffffff);
  }
  /** metalness (0-1)
   *  @type {number} 
   */
  get metalness(){
    return this.uniforms.metalness.value;
  }
  set metalness(v){
    this.uniforms.metalness.value = v;
  }
  /** roughness (0-1)
   *  @type {number} 
   */
  get roughness(){
    return this.uniforms.roughness.value;
  }
  set roughness(v){
    this.uniforms.roughness.value = v;
  }
  /** clearCoat (0-1)
   *  @type {number}
   */
  get clearCoat(){
    return this.uniforms.clearCoat.value;
  }
  set clearCoat(v){
    this.uniforms.clearCoat.value = v;
  }
  /** clearCoatRoughness (0-1)
   *  @type {number}
   */
  get clearCoatRoughness(){
    return this.uniforms.clearCoatRoughness.value;
  }
  set clearCoatRoughness(v){
    this.uniforms.clearCoatRoughness.value = v;
  }
  static _crateShaders() {
    const include = libs=>libs.map(lib=>"#include <"+lib+">\n").join("");
    const varying = vars=>vars.map(v  =>"varying "+v+";\n").join("");
    const uniform = unis=>unis.map(uni=>"uniform "+uni+";\n").join("");
    let vert = "", frag = "";
    vert += include(["common", "fog_pars_vertex", "shadowmap_pars_vertex", "logdepthbuf_pars_vertex"]);
    vert += varying(["vec3 vViewPosition", "vec3 vNormal", "vec4 vColor"]);
    vert += "attribute vec4 color;\n";
    vert += "void main() {\n";
    vert += "vColor = color;\n";
    vert += include(["beginnormal_vertex", "defaultnormal_vertex"]);
    vert += "vNormal=normalize(transformedNormal);\n";
    vert += include(["begin_vertex", "project_vertex", "logdepthbuf_vertex"]);
    vert += "vViewPosition=-mvPosition.xyz;\n";
    vert += include(["worldpos_vertex", "shadowmap_vertex", "fog_vertex"]);
    vert += "}";
    frag += uniform([
      "vec3 diffuse", 
      "vec3 emissive", 
      "float roughness", 
      "float metalness", 
      "float opacity", 
      "float clearCoat", 
      "float clearCoatRoughness"
    ]);
    frag += include([
      "common", 
      "packing", 
      "dithering_pars_fragment", 
      "bsdfs", 
      "cube_uv_reflection_fragment",
      "envmap_pars_fragment", 
      "envmap_physical_pars_fragment", 
      "fog_pars_fragment", 
      "lights_pars_begin",
      "lights_physical_pars_fragment",
      "shadowmap_pars_fragment", 
      "logdepthbuf_pars_fragment"
    ]);
    frag += varying(["vec3 vViewPosition", "vec3 vNormal", "vec4 vColor"]);
    frag += "void main() {\n";
    frag += "vec4 diffuseColor = vec4(diffuse, opacity);\n"
    frag += "ReflectedLight reflectedLight = ReflectedLight(vec3(0), vec3(0), vec3(0), vec3(0));\n"
    frag += "vec3 totalEmissiveRadiance = emissive;\n"
    frag += include(["logdepthbuf_fragment"]);
    frag += "diffuseColor.rgba *= vColor;\n"
    frag += "float metalnessFactor = metalness;\n";
    frag += "float roughnessFactor = roughness;\n";
    frag += include([
      "normal_fragment_begin",
      "lights_physical_fragment",
      "lights_fragment_begin",
      "lights_fragment_maps",
      "lights_fragment_end",
    ]);
    frag += "vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;\n";
    frag += "gl_FragColor = vec4(outgoingLight, diffuseColor.a);\n"
    frag += include(["encodings_fragment", "fog_fragment", "premultiplied_alpha_fragment", "dithering_fragment"]);
    frag += "}";
    return {vert, frag};
  }
}
