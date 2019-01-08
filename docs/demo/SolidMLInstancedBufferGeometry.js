SolidML.InstancedBufferGeometry = class extends SolidML.BufferGeometry {
  /** THREE.BufferGeometry constructed by {@link SolidML} script.
   *  @param {string} [script] script to construct object. call {@link SolidML.BufferGeometry#build} inside.
   *  @param {object} [criteria] default criteria of this structure, specified by "set *" commands in script.
   *  @param {Object.<BufferGeometry>} [geometryHash] hash map of source geometries and keys like {"box":new THREE.BoxBufferGeometry(1, 1, 1)}. The source geometry should be indexed.
   */
  constructor(script=null, criteria=null, geometryHash=null) {
    super(null, criteria, geometryHash);
    /** 
     * Hash of SolidML.InstancedArray, can be accessed by rule name.
     * @type {Hash.<SolidML.InstancedArray>} 
     */
    this.instancedArrayHash = {};

    if (script) 
      this.build(script, criteria);
  }
  /** 
   * @override
   */
  estimateBufferCount(instanceMargin=0) {
    this._geometryCreator.setup(false);
    this.solidML.build(stat=>{
      if (this.geometryFilter && !this.geometryFilter(stat)) return;
      const geomCreated = this._geometryCreator.create(stat);
      if (geomCreated) {
        stat.color._incrementRandMT();
        const ruleName = stat.getRuleName();
        if (!(ruleName in this.instancedArrayHash)) {
          const iarray = new SolidML.InstancedArray(geomCreated, ["position","normal"], {"color":4, "imatx":4, "imaty":4, "imatz":4, "imatw":4});
          this.instancedArrayHash[ruleName] = iarray;
        }
        this.instancedArrayHash[ruleName].instanceCount++;
      }
    });
    this._geometryCreator.composeMeshes(false).forEach(reference=>{
      const ruleName = reference.name;
      const iarray = new SolidML.InstancedArray(reference, ["position","normal","color"], {"imatx":4, "imaty":4, "imatz":4, "imatw":4});
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
    this.instancedArrayHash[rulaName].updateInstancedAttribute(index, {
      "color": [color.r, color.g, color.b, color.a],
      "imatx": [me[0],  me[1],  me[2],  me[3]],
      "imaty": [me[4],  me[5],  me[6],  me[7]],
      "imatz": [me[8],  me[9],  me[10], me[11]],
      "imatw": [me[12], me[13], me[14], me[15]]
    });
  }
}


/**
 * this class provides WebGL2 Instanced Array 
 */
SolidML.InstancedArray = class {
  /**
   * Instanced Array class 
   * @param  {THREE.BufferGeometry} baseGeometry base geometry for instancing
   * @param  {Array.<string>} baseAttributeList name list of attribute picked from baseGeometry 
   * @param  {Object} instancedAttributeHash hash of instanced attributte, {"attribute_name":attribute_size_bytes}.
   * @return {SolidML.InstancedArray} 
   */
  constructor(baseGeometry, baseAttributeList, instancedAttributeHash=null) {
    this._instancedArrayHash = {};
    this.instanceCount = 0;
    this.instancedGeometry = null;
    this.baseGeometry = null;
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
   * @return {SolidML.InstancedArray} this instance
   */
  setBaseGeometry(baseGeometry) {
    if (this.instancedGeometry)
      this.instancedGeometry.dispose();
    this.instancedGeometry = null;
    this._instancedAttributeHash = {};
    this.baseGeometry = baseGeometry;
    if (baseGeometry) {
      this.instancedGeometry = new THREE.InstancedBufferGeometry();
      this.instancedGeometry.setIndex(baseGeometry.index.clone());
      this.baseAttributeList.forEach(attr=>{
        this.instancedGeometry.addAttribute(attr, baseGeometry.attributes[attr].clone());
      });
    }
    return this;
  }
  /**
   * add instanced attribute, called in constructor
   * @param {string} itemName name of attribute
   * @param {int} itemSize size of attribute
   * @return {SolidML.InstancedArray} this instance
   */
  addInstancedAttribute(itemName, itemSize) {
    this._instancedArrayHash[itemName] = {itemSize, "typedArray":null, "bufferAttr":null};
    return this;
  }
  /**
   * allocate instance arrays
   * @param  {Number} instanceCount number of instances to allocate
   * @return {SolidML.InstancedArray} this instance
   */
  allocate(instanceCount=0) {
    if (instanceCount) 
      this.instanceCount = instanceCount;
    for (let itemName in this._instancedArrayHash) {
      const hash = this._instancedArrayHash[itemName];
      hash.typedArray = new Float32Array(this.instanceCount * hash.itemSize);
      hash.bufferAttr = new THREE.InstancedBufferAttribute(hash.typedArray, hash.itemSize).setDynamic(true);
      this.instancedGeometry.addAttribute(itemName, hash.bufferAttr);
    }
    return this;
  }
  /**
   * set instanced attribute
   * @param {Object} attributes hash of attribute to set, {"attribute_name" : [array of values]}
   * @return {SolidML.InstancedArray} this instance
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
