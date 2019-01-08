SolidML.InstancedBufferGeometry = class extends SolidML.BufferGeometry {
  /** THREE.BufferGeometry constructed by {@link SolidML} script.
   *  @param {string} [script] script to construct object. call {@link SolidML.BufferGeometry#build} inside.
   *  @param {object} [criteria] default criteria of this structure, specified by "set *" commands in script.
   *  @param {Object.<BufferGeometry>} [geometryHash] hash map of source geometries and keys like {"box":new THREE.BoxBufferGeometry(1, 1, 1)}. The source geometry should be indexed.
   */
  constructor(script=null, criteria=null, geometryHash=null) {
    super(null, criteria, geometryHash);
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
    let order = 0;
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
          iarray.userData.isTranparent = false;
          iarray.userData.order = order++;
          this.instancedArrayHash[ruleName] = iarray;
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
      this.instancedArrayHash[rulaName].userData.isTranparent = true;
    this.instancedArrayHash[rulaName].updateInstancedAttribute(index, {
      "color": [color.r, color.g, color.b, color.a],
      "imatx": [me[0],  me[1],  me[2],  me[3]],
      "imaty": [me[4],  me[5],  me[6],  me[7]],
      "imatz": [me[8],  me[9],  me[10], me[11]],
      "imatw": [me[12], me[13], me[14], me[15]]
    });
  }
}
