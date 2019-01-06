SolidML.InstancedBufferGeometryList = class extends SolidML.BufferGeometry {
  /** THREE.BufferGeometry constructed by {@link SolidML} script.
   *  @param {string} [script] script to construct object. call {@link SolidML.BufferGeometry#build} inside.
   *  @param {object} [criteria] default criteria of this structure, specified by "set *" commands in script.
   *  @param {Object.<BufferGeometry>} [geometryHash] hash map of source geometries and keys like {"box":new THREE.BoxBufferGeometry(1, 1, 1)}. The source geometry should be indexed.
   */
  constructor(script=null, criteria=null, geometryHash=null) {
    super(null, criteria, geometryHash);

    /** 
     * Hash of THREE.InstancedBufferGeometry, can be accessed by rule name.
     * @type {Hash.<>} 
     */
    this.geometries = {};

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
        if (!(ruleName in this.geometries)) {
          this.geometries[ruleName] = {
            instance: null,
            original: geomCreated, 
            indexCount: geomCreated.index.array.length,
            vertexCount: geomCreated.attributes.position.count,
            instanceCount: instanceMargin,
            _instanceIndex: 0
          };
        }
        this.geometries[ruleName].instanceCount++;
      }
    });
    this._geometryCreator.composeMeshes(false).forEach(reference=>{
      this.geometries[reference.name] = {
        instance: null,
        original: reference, 
        indexCount: reference.index.array.length,
        vertexCount: reference.attributes.position.count,
        instanceCount: 1
      };
    });
    // caluclate total counts
    this.indexCount = 0;
    this.vertexCount = 0;
    this.objectCount = 0;
    for (let rulaName in this.geometries) {
      const iarray = this.geometries[rulaName];
      this.indexCount += iarray.indexCount * iarray.instanceCount;
      this.vertexCount += iarray.vertexCount * iarray.instanceCount;
      this.objectCount += iarray.instanceCount;
    }
    return this;
  }
  /** 
   * @override
   */
  allocBuffers(isDynamic=true, indexCount=0, vertexCount=0) {
    for (let rulaName in this.geometries) {
      const iarray = this.geometries[rulaName];
      const instance = new THREE.InstancedBufferGeometry();
      iarray.instance = instance;
      iarray._colors = new Float32Array(iarray.instanceCount * 4);
      iarray._matrices = new Float32Array(iarray.instanceCount * 16);
      instance.setIndex(iarray.original.index.clone().setDynamic(isDynamic));
      instance.addAttribute('position', iarray.original.attributes.position.clone().setDynamic(isDynamic));
      instance.addAttribute('normal', iarray.original.attributes.normals.clone().setDynamic(isDynamic));
      instance.addAttribute('color', new THREE.InstancedBufferAttribute(iarray._colors, 4).setDynamic(isDynamic));
      instance.addAttribute('matrix', new THREE.InstancedBufferAttribute(iarray._matrices, 16).setDynamic(isDynamic));
    }
    return this;
  }
  /**
   * @override
   */
  update(sortingDotProduct=null) {
    for (let ruleName in this.geometries) 
      this.geometries[ruleName]._instanceIndex = 0;
    if (sortingDotProduct) {
      const statLists = {}, vec = sortingDotProduct;
      this.solidML.build(stat=>{
        if (this.geometryFilter && !this.geometryFilter(stat)) return;
        const ruleName = stat.getRuleName();
        if (!(ruleName in statLists)) statLists[ruleName] = [];
        statLists[ruleName].push(stat.reference());
      });
      for (let key in statLists) {
        statLists[key].sort((statA, statB)=>{
          const ma = statA.matrix.elements, mb = statB.matrix.elements,
                da = ma[12]/ma[15]*vec.x + ma[13]/ma[15]*vec.y + ma[14]/ma[15]*vec.z,
                db = mb[12]/mb[15]*vec.x + mb[13]/mb[15]*vec.y + mb[14]/mb[15]*vec.z;
          return db - da;
        }).forEach(stat=>{
          this._copyInstance(stat, key);
        });
      }
    } else {
      this.solidML.build(stat=>{
        if (this.geometryFilter && !this.geometryFilter(stat)) return;
        this._copyInstance(stat, stat.getRuleName());
      });
    }
    /**/ // meshes ... ?, updateNormals...?
    return this;
  }

  _copyInstance(stat, rulaName) {
    const iarray = this.geometries[kerulaNamey];
    const color = stat.color.getRGBA();
    iarray._colors.set([color.r, color.g, color.b, color.a], iarray._instanceIndex*4);
    iarray._matrices.set((stat.matrix.elements), iarray._instanceIndex*16);
    iarray._instanceIndex++;
  }
}
