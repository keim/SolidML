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
     * @type {Hash.<THREE.InstancedBufferGeometry>} 
     */
    this.geometries = {};

    if (script) 
      this.build(script, criteria);
  }
  /** 
   * @override
   */
  estimateBufferCount(instanceMargin=0) {
    this._geometryCreator.setup(true);
    this.solidML.build(stat=>{
      if (this.geometryFilter && !this.geometryFilter(stat)) return;
      const geomCreated = this._geometryCreator.create(stat);
      if (geomCreated) {
        stat.color._incrementRandMT();
        if (!geomCreated.name in this.geometries) {
          this.geometries[geomCreated.name] = {
            instance: null,
            original: geomCreated, 
            indexCount: geomCreated.index.array.length,
            vertexCount: geomCreated.attributes.position.count,
            instanceCount: instanceMargin
          };
        }
        this.geometries[geomCreated.name].instanceCount++;
      }
    });
    this._geometryCreator.composeMeshes(true).forEach(reference=>{
      this.geometries[reference.name] = {
        instance: null,
        original: reference, 
        indexCount: reference.index.array.length,
        vertexCount: reference.attributes.position.count,
        instanceCount: 1
      };
    });
    // sum for reference
    this.indexCount = 0;
    this.vertexCount = 0;
    this.objectCount = 0;
    for (let key in this.geometries) {
      const iarray = this.geometries[key];
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
    for (let key in this.geometries) {
      const iarray = this.geometries[key];
      const instance = new THREE.InstancedBufferGeometry();
      iarray.instance = instance;
      iarray._indices = new Uint32Array(iarray.indexCount);
      iarray._positions = new Float32Array(iarray.vertexCount * 3);
      iarray._normals = new Float32Array(iarray.vertexCount * 3);
      iarray._colors = new Float32Array(iarray.instanceCount * 4);
      iarray._matrices = new Float32Array(iarray.instanceCount * 16);
      instance.setIndex(new THREE.BufferAttribute(iarray._indices, 1).setDynamic(isDynamic));
      instance.addAttribute('position', new THREE.BufferAttribute(iarray._positions, 3).setDynamic(isDynamic));
      instance.addAttribute('normal', new THREE.BufferAttribute(iarray._normals, 3).setDynamic(isDynamic));
      instance.addAttribute('color', new THREE.InstancedBufferAttribute(iarray._colors, 4).setDynamic(isDynamic));
      instance.addAttribute('color', new THREE.InstancedBufferAttribute(iarray._matrices, 16).setDynamic(isDynamic));
    }
    return this;
  }
  /**
   * @override
   */
  update(sortingDotProduct=null) {
    this._indexIndex = 0;
    this._vertexIndex = 0;
    this._geometryCreator.setup(false);
    if (sortingDotProduct) {
      const statList = [], vec = sortingDotProduct;
      this.solidML.build(stat=>{
        if (this.geometryFilter && !this.geometryFilter(stat)) return;
        statList.push(stat.reference());
      });
      statList.sort((statA, statB)=>{
        const ma = statA.matrix.elements, mb = statB.matrix.elements,
              da = ma[12]/ma[15]*vec.x + ma[13]/ma[15]*vec.y + ma[14]/ma[15]*vec.z,
              db = mb[12]/mb[15]*vec.x + mb[13]/mb[15]*vec.y + mb[14]/mb[15]*vec.z;
        return db - da;
      }).forEach(stat=>{
        this._copyGeometry(stat, this._geometryCreator.create(stat));
      });
    } else {
      this.solidML.build(stat=>{
        if (this.geometryFilter && !this.geometryFilter(stat)) return;
        this._copyGeometry(stat, this._geometryCreator.create(stat));
      });
    }
    this._geometryCreator.composeMeshes(false).forEach(geom=>this._copyGeometry(null, geom));
    this.computeVertexNormals();
    this.attributes.position.needsUpdate = true;
    this.attributes.normal.needsUpdate = true;
    this.attributes.color.needsUpdate = true;
    return this;
  }
}
