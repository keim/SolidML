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
          this.instancedArrayHash[ruleName] = new SolidML.InstancedArray(geomCreated, ["position","normal"], 0);
          this.instancedArrayHash[ruleName].addInstancedAttribute('color', 4);
          this.instancedArrayHash[ruleName].addInstancedAttribute('instanced_matrix', 16);
        }
        this.instancedArrayHash[ruleName].instanceCount++;
      }
    });
    this._geometryCreator.composeMeshes(false).forEach(reference=>{
      this.instancedArrayHash[reference.name] = new SolidML.InstancedArray(reference, ["position","normal","color"], 0);
      this.instancedArrayHash[reference.name].addInstancedAttribute('instanced_matrix', 16);
      this.instancedArrayHash[reference.name].allocate(1);
      this.instancedArrayHash[reference.name].setInstanceAttribute(0, "instanced_matrix", [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
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
    this.instancedArrayHash[rulaName].setInstanceAttribute(index, "color", [color.r, color.g, color.b, color.a]);
    this.instancedArrayHash[rulaName].setInstanceAttribute(index, "instanced_matrix", stat.matrix.elements);
  }
}


SolidML.InstancedArray = class {
  constructor(originalGeometry, originalAttributeList, instanceCount=0) {
    this._instanceHash = {};
    this.instanceCount = instanceCount;
    this.instancedGeometry = null;
    this.originalGeometry = null;
    this.originalAttributeList = originalAttributeList;
    this.setOriginalGeometry(originalGeometry);
  }
  get indexCount() {
    return this.originalGeometry.index.array.length * this.instanceCount;
  }
  get vertexCount() {
    return this.originalGeometry.attributes.position.count * this.instanceCount;
  }
  setOriginalGeometry(originalGeometry) {
    if (this.instancedGeometry)
      this.instancedGeometry.dispose();
    this.instancedGeometry = null;
    this._instancedAttributeHash = {};
    this.originalGeometry = originalGeometry;
    if (originalGeometry) {
      this.instancedGeometry = new THREE.InstancedBufferGeometry();
      this.instancedGeometry.setIndex(originalGeometry.index.clone());
      this.originalAttributeList.forEach(attr=>{
        this.instancedGeometry.addAttribute(attr, originalGeometry.attributes[attr].clone());
      });
    }
    return this;
  }
  addInstancedAttribute(itemName, itemSize) {
    this._instanceHash[itemName] = {itemSize};
    return this;
  }
  allocate(instanceCount=0) {
    if (instanceCount) 
      this.instanceCount = instanceCount;
    for (let itemName in this._instanceHash) {
      const hash = this._instanceHash[itemName];
      hash.floatArray = new Float32Array(this.instanceCount * hash.itemSize);
      hash.bufferAttr = new THREE.InstancedBufferAttribute(hash.floatArray, hash.itemSize).setDynamic(true);
      this.instancedGeometry.addAttribute(itemName, hash.bufferAttr);
    }
    return this;
  }
  setInstanceAttribute(instanceIndex, itemName, array) {
    const hash = this._instanceHash[itemName];
    if (hash) {
      hash.floatArray.set(array, instanceIndex * hash.itemSize);
      hash.bufferAttr.needsUpdate = true;
    }
  }
}
