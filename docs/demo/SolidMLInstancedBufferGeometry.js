SolidML.InstancedBufferGeometry = class extends SolidML.BufferGeometry {
  /** THREE.BufferGeometry constructed by {@link SolidML} script.
   *  @param {string} [script] script to construct object. call {@link SolidML.BufferGeometry#build} inside.
   *  @param {object} [criteria] default criteria of this structure, specified by "set *" commands in script.
   *  @param {Object.<BufferGeometry>} [geometryHash] hash map of source geometries and keys like {"box":new THREE.BoxBufferGeometry(1, 1, 1)}. The source geometry should be indexed.
   */
  constructor(script=null, criteria=null, geometryHash=null) {
    super(null, criteria, geometryHash);
    /** 
     * Array of InstancedArray.
     * @type {Array.<InstancedArray>} 
     */
    this.instances = [];

    /** 
     * Hash of InstancedArray, can be accessed by rule name.
     * @type {Hash.<InstancedArray>} 
     */
    this.instancedArrayHash = {};

    if (script) 
      this.build(script, criteria);
  }
  /** 
   * @override
   */
  build(script, criteria=null, isDynamic=false, indexMargin=0, vertexMargin=0, filter=null) {
    super.build(script, criteria, isDynamic, indexMargin, vertexMargin, filter);
    super.update();
    return this;
  }
  /** 
   * @override
   */
  estimateBufferCount(instanceMargin=0) {
    this.instances = [];
    this.instancedArrayHash = {};
    this._geometryCreator.setup(false);
    this.solidML.build(stat=>{
      if (this.geometryFilter && !this.geometryFilter(stat)) return;
      const geomCreated = this._geometryCreator.create(stat);
      if (geomCreated) {
        stat.color._incrementRandMT();
        const ruleName = stat.getRuleName();
        if (!(ruleName in this.instancedArrayHash)) {
          const iarray = new InstancedArray(geomCreated, ["position","normal"], {"color":4, "imatx":4, "imaty":4, "imatz":4, "imatw":4});
          iarray.name = ruleName;
          iarray.userData.isTransparent = false;
          iarray.userData.order = this.instances.length;
          this.instancedArrayHash[ruleName] = iarray;
          this.instances.push(iarray);
        }
        this.instancedArrayHash[ruleName].instanceCount++;
      }
    });
    this._geometryCreator.composeMeshes(false).forEach(reference=>{
      const ruleName = reference.name;
      const iarray = new InstancedArray(reference, ["position","normal","color"], {"imatx":4, "imaty":4, "imatz":4, "imatw":4});
      iarray.name = ruleName;
      iarray.allocate(1);
      iarray.updateInstancedAttribute(0, {"imatx":[1,0,0,0], "imaty":[0,1,0,0], "imatz":[0,0,1,0], "imatw":[0,0,0,1]});
      this.instancedArrayHash[ruleName] = iarray;
    });
    // caluclate total counts
    this.indexCount = 0;
    this.vertexCount = 0;
    this.objectCount = 0;
    for (let rulaName in this.instancedArrayHash) {
      const iarray = this.instancedArrayHash[rulaName];
      this.indexCount += iarray.indexCount;
      this.vertexCount += iarray.vertexCount;
      this.objectCount += iarray.instanceCount;
    }
    return this;
  }
  /** 
   * @override
   */
  allocBuffers(isDynamic=true, indexCount=0, vertexCount=0) {
    super.allocBuffers(isDynamic, indexCount, vertexCount)
    for (let rulaName in this.instancedArrayHash) 
      this.instancedArrayHash[rulaName].allocate();
    return this;
  }
  /**
   * @override
   */
  update(sortingDotProduct=null) {
    if (sortingDotProduct) {
      const statLists = {};
      this.solidML.build(stat=>{
        if (this.geometryFilter && !this.geometryFilter(stat)) return;
        const ruleName = stat.getRuleName();
        if (!(ruleName in statLists))
          statLists[ruleName] = [];
        statLists[ruleName].push(stat.reference());
      });
      const vec = sortingDotProduct;
      for (let key in statLists) {
        statLists[key].sort((statA, statB)=>{
          const ma = statA.matrix.elements, mb = statB.matrix.elements,
                da = ma[12]/ma[15]*vec.x + ma[13]/ma[15]*vec.y + ma[14]/ma[15]*vec.z,
                db = mb[12]/mb[15]*vec.x + mb[13]/mb[15]*vec.y + mb[14]/mb[15]*vec.z;
          return db - da;
        }).forEach((stat, index)=>{
          this._copyInstance(index, stat, key);
        });
      }
    } else {
      const instanceIndices = {};
      this.solidML.build(stat=>{
        if (this.geometryFilter && !this.geometryFilter(stat)) return;
        const ruleName = stat.getRuleName();
        if (!(ruleName in instanceIndices))
          instanceIndices[ruleName] = 0;
        this._copyInstance(instanceIndices[ruleName], stat, ruleName);
        instanceIndices[ruleName]++;
      });
    }
    return this;
  }

  _copyInstance(index, stat, rulaName) {
    const color = stat.color.getRGBA();
    const me = stat.matrix.elements;
    if (color.a < 1) 
      this.instancedArrayHash[rulaName].userData.isTransparent = true;
    this.instancedArrayHash[rulaName].updateInstancedAttribute(index, {
      "color": [color.r, color.g, color.b, color.a],
      "imatx": [me[0],  me[1],  me[2],  me[3]],
      "imaty": [me[4],  me[5],  me[6],  me[7]],
      "imatz": [me[8],  me[9],  me[10], me[11]],
      "imatw": [me[12], me[13], me[14], me[15]]
    });
  }
}


SolidML.InstancedBuffer_DepthMaterial = class extends THREE.ShaderMaterial {
  constructor(paramaters) {
    super(paramaters);
    Object.assign(this.defines, {
      "INSTANCED_MATRIX" : 1, 
      "DEPTH_PACKING": THREE.RGBADepthPacking
    });
    this.uniforms = THREE.UniformsUtils.clone(THREE.ShaderLib.depth.uniforms);
    this.vertexShader = SolidML.InstancedBuffer_DepthMaterial.vertexShader();
    this.fragmentShader = THREE.ShaderLib.depth.fragmentShader;
  }

  static vertexShader() {
    return `
#include <common>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef INSTANCED_MATRIX
  attribute vec4 imatx;
  attribute vec4 imaty;
  attribute vec4 imatz;
  attribute vec4 imatw;
#endif
void main() {
  #include <uv_vertex>
  #include <skinbase_vertex>
  #ifdef USE_DISPLACEMENTMAP
    #include <beginnormal_vertex>
    #include <morphnormal_vertex>
    #include <skinnormal_vertex>
  #endif
  #include <begin_vertex>
  #include <morphtarget_vertex>
  #include <skinning_vertex>
  #include <displacementmap_vertex>
  //#include <project_vertex>
#ifdef INSTANCED_MATRIX
  mat4 imat = mat4(imatx, imaty, imatz, imatw);
  vec4 mvPosition = modelViewMatrix * imat * vec4( transformed, 1.0 );
#else
  vec4 mvPosition = modelViewMatrix * vec4( transformed, 1.0 );
#endif
  gl_Position = projectionMatrix * mvPosition;
  #include <logdepthbuf_vertex>
  #include <clipping_planes_vertex>
}` 
  }
}


SolidML.InstancedBuffer_PhysicalMaterial = class extends THREE.ShaderMaterial {
  constructor(paramaters) {
    super();
    this.uniforms = THREE.UniformsUtils.merge([
      THREE.ShaderLib.physical.uniforms, {
        cameraNear: { value: 1 },
        cameraFar: { value: 1000 }
    }]);
    this._initShader();
    this.lights = true;
    this.opacity = 1;
    this.setValues(paramaters);
    SolidML.Material._initializeParameters(this);
    Object.assign(this.defines, {
      "INSTANCED_MATRIX" : 1, 
      "DEPTH_PACKING": THREE.RGBADepthPacking
    });
  }

  _initShader() {
    this.vertexShader = `#version 300 es
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

    this.fragmentShader = `#version 300 es
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
//layout (location = 1) out vec4 vDepthNormal;
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
  //float depth = viewZToOrthographicDepth(-vViewPosition.z, cameraNear, cameraFar);
  //vDepthNormal = packDepth16Normal16(depth, vNormal);
  #include <tonemapping_fragment> 
  #include <encodings_fragment> 
  #include <fog_fragment> 
  #include <premultiplied_alpha_fragment> 
  #include <dithering_fragment>
}`;
  }
}
