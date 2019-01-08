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
