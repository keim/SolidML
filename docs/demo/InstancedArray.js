/**
 *  WebGL2 Instanced Array class extends THREE.InstancedBufferGeometry.
 */
class InstancedArray extends THREE.InstancedBufferGeometry {
  /**
   * InstancedArray class provides Instanced Array supported by WebGL2
   * @param  {THREE.BufferGeometry} baseGeometry base geometry for instancing
   * @param  {Array.<string>} baseAttributeList name list of attribute picked from baseGeometry 
   * @param  {Object} instancedAttributeHash hash of instanced attributte, {"attribute_name":attribute_size_bytes}.
   * @return {InstancedArray} 
   */
  constructor(baseGeometry, baseAttributeList, instancedAttributeHash=null) {
    super();
    this._instancedArrayHash = {};
    /** 
     * number of instances
     * @type {Number}
     */
    this.instanceCount = 0;
    /** 
     * number of instances
     * @type {THREE.BufferGeometry} baseGeometry base geometry for instancing
     */
    this.baseGeometry = null;
    /**
     * name list of attribute picked from baseGeometry 
     * @type {Array.<string>}
     */
    this.baseAttributeList = baseAttributeList;

    // set base geometry
    this.setBaseGeometry(baseGeometry);
    // set instanced attributes
    if (instancedAttributeHash) 
      for (let key in instancedAttributeHash) 
        this.addInstancedAttribute(key, instancedAttributeHash[key]);
  }
  /**
   * equals baseGeometry.indexCount * instanceCount
   * @return {int} 
   */
  get indexCount() {
    return this.baseGeometry.index.array.length * this.instanceCount;
  }
  /**
   * equals baseGeometry.vertexCount * instanceCount
   * @return {int} 
   */
  get vertexCount() {
    return this.baseGeometry.attributes.position.count * this.instanceCount;
  }
  /**
   * set base geometry, called in constructor
   * @param  {THREE.BufferGeometry} baseGeometry base geometry for instancing
   * @return {InstancedArray} this instance
   */
  setBaseGeometry(baseGeometry) {
    this.dispose();
    this._instancedAttributeHash = {};
    this.baseGeometry = baseGeometry;
    if (baseGeometry) {
      this.setIndex(baseGeometry.index.clone());
      this.baseAttributeList.forEach(attr=>{
        this.addAttribute(attr, baseGeometry.attributes[attr].clone());
      });
    }
    return this;
  }
  /**
   * add instanced attribute, called in constructor
   * @param {string} itemName name of attribute
   * @param {int} itemSize size of attribute
   * @return {InstancedArray} this instance
   */
  addInstancedAttribute(itemName, itemSize) {
    this._instancedArrayHash[itemName] = {itemSize, "typedArray":null, "bufferAttr":null};
    return this;
  }
  /**
   * allocate instance arrays
   * @param  {Number} instanceCount number of instances to allocate
   * @return {InstancedArray} this instance
   */
  allocate(instanceCount=0) {
    if (instanceCount) 
      this.instanceCount = instanceCount;
    for (let itemName in this._instancedArrayHash) {
      const hash = this._instancedArrayHash[itemName];
      hash.typedArray = new Float32Array(this.instanceCount * hash.itemSize);
      hash.bufferAttr = new THREE.InstancedBufferAttribute(hash.typedArray, hash.itemSize).setDynamic(true);
      this.addAttribute(itemName, hash.bufferAttr);
    }
    return this;
  }
  /**
   * set instanced attribute
   * @param {Object} attributes hash of attribute to set, {"attribute_name" : [array of values]}
   * @return {InstancedArray} this instance
   */
  updateInstancedAttribute(instanceIndex, attributes) {
    for (let key in attributes) {
      const hash = this._instancedArrayHash[key];
      if (hash) {
        hash.typedArray.set(attributes[key], instanceIndex * hash.itemSize);
        hash.bufferAttr.needsUpdate = true;
      }
    }
    return this;
  }
}


class InstancedArray_DepthMaterial extends THREE.ShaderMaterial {
  constructor(paramaters) {
    super(paramaters);
    const shader = InstancedArray_DepthMaterial._shader();
    this.vertexShader = shader.vert;
    this.fragmentShader = shader.frag;
    Object.assign(this.defines, {
      "INSTANCED_MATRIX" : 1, 
      "DEPTH_PACKING": THREE.RGBADepthPacking
    });
  }

  static _shader() {
    return {
vert: `
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

}`,
frag: `
#if DEPTH_PACKING == 3200

  uniform float opacity;

#endif

#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>

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

    gl_FragColor = vec4( vec3( 1.0 - gl_FragCoord.z ), opacity );

  #elif DEPTH_PACKING == 3201

    gl_FragColor = packDepthToRGBA( gl_FragCoord.z );

  #endif

}`
    }
  }
}

