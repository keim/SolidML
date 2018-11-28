/**
 * @file Extention for three.js. SolidMLBUfferGeometry.js depends on three.js and SolidML.js. Import after these dependent files.
 */
/**
 *  TRHEE.BufferGeometry constructed by {@link SolidML}. SolidMLBUfferGeometry.js depends on three.js and SolidML.js. Import after these dependent files.
 *  @extends {TRHEE.BufferGeometry}
 */
SolidML.BufferGeometry = class extends THREE.BufferGeometry {
  /** THREE.BufferGeometry constructed by {@link SolidML} script.
   *  @param {string} [script] script to construct object. call {@link SolidML.BufferGeometry#build} inside.
   *  @param {Object.<BufferGeometry>} [geometryHash] hash map of original geometries and keys in script.
   *  @param {object} [criteria] default criteria of this structure, specified by "set *" commands in script.
   */
  constructor(script=null, geometryHash=null, criteria=null) {
    super();
    const indexing = geom=>{
      const indices = new Uint16Array(geom.attributes.position.count);
      for (let i=0; i<indices.length; i++)
        indices[i] = i;
      geom.setIndex(new THREE.BufferAttribute(indices, 1));
      return geom;
    };
    const rotz = new THREE.Matrix4().makeRotationZ(-Math.PI/2),
          roty = new THREE.Matrix4().makeRotationY(Math.PI/2);
    /** 
     * hash map of original geometries and keys in script.
     *  @type {Object.<BufferGeometry>}
     */
    this.geometryHash = Object.assign({
      "box": new THREE.BoxBufferGeometry(1,1,1),
      "sphere": new THREE.SphereBufferGeometry(0.5,8,6),
      "cylinder": new THREE.CylinderBufferGeometry(0.5,0.5,1,8).applyMatrix(rotz),
      "disc": new THREE.CylinderBufferGeometry(0.5,0.5,0.1,8).applyMatrix(rotz),
      "corn": new THREE.ConeBufferGeometry(0.5,1,8).applyMatrix(rotz),
      "torus": new THREE.TorusBufferGeometry(0.5,0.1,4,8).applyMatrix(roty),
      "tetra": indexing(new THREE.TetrahedronBufferGeometry(0.5)),
      "octa": indexing(new THREE.OctahedronBufferGeometry(0.5)),
      "dodeca": indexing(new THREE.DodecahedronBufferGeometry(0.5)),
      "icosa": indexing(new THREE.IcosahedronBufferGeometry(0.5)),
      "grid": null,
      "line": null,
      "point": null,
      "tube": null,
      "mesh": null
    }, geometryHash);
    /** 
     * hash map of functions return the geometry gemerated by parameter (written as "label[param]") and option (written as "label:option") 
     * @type {object.<Function>}
     */
    this.geometryCreators = {
      "triangle": this._triangle,
    };
    /** {@link SolidML} instance to construct object.
     *  @type {SolidML}
     */
    this.solidML = null;
    this.build(script, criteria);
  }
  /** construct object by script. execute {@link SolidML.BufferGeometry#compile}=>{@link SolidML.BufferGeometry#estimateBufferCount}=>{@link SolidML.BufferGeometry#allocVertexBuffer}=>{@link SolidML.BufferGeometry#update} inside
   *  @param {string} script script to construct object. 
   *  @param {object} [criteria] default criteria of this structure, specified by "set *" commands in script.
   *  @param {boolean} [isDynamic] set THREE.BufferAttribute.dynamic
   *  @return {SolidML.BufferGeometry} this instance
   */
  build(script, criteria=null, isDynamic=false) {
    this.compile(script, criteria);
    const r = this.estimateBufferCount();
    this.allocVertexBuffer(r.indexCount, r.vertexCount, isDynamic);
    this.update();
    return this;
  }
  /** Parse script, make a structure of recursive calls inside.
   *  @param {string} script script to construct object. 
   *  @param {object} [criteria] default criteria of this structure, specified by "set *" commands in script.
   *  @return {SolidML.BufferGeometry} this instance
   */
  compile(script, criteria=null) {
    this.solidML = new SolidML(script, criteria);
    return this;
  }
  /** estimate index and vertex buffer count. 
   *  @return {object} object contains {indexCount, vertexCount}
   */
  estimateBufferCount() {
    const ret = {indexCount:0, vertexCount:0};
    this.solidML.build(stat=>{
      const geom = this._getReferedGeom(stat);
      if (geom) {
        stat.color._incrementRandMT();
        ret.indexCount += geom.index.array.length;
        ret.vertexCount += geom.attributes.position.count;
      }
    });
    return ret;
  }
  /** allocate vertex buffer with some margins.
   *  @param {int} indexCount index buffer size
   *  @param {int} vertexCount vertex buffer size
   *  @param {boolean} [isDynamic] set THREE.BufferAttribute.dynamic
   *  @return {SolidML.BufferGeometry} this instance
   */
  allocVertexBuffer(indexCount, vertexCount, isDynamic=true) {
    this._indices = new Uint32Array(indexCount);
    this._positions = new Float32Array(vertexCount * 3);
    this._normals = new Float32Array(vertexCount * 3);
    this._colors = new Float32Array(vertexCount * 4);
    this.setIndex(new THREE.BufferAttribute(this._indices, 1).setDynamic(isDynamic));
    this.addAttribute('position', new THREE.BufferAttribute(this._positions, 3).setDynamic(isDynamic));
    this.addAttribute('normal', new THREE.BufferAttribute(this._normals, 3).setDynamic(isDynamic));
    this.addAttribute('color', new THREE.BufferAttribute(this._colors, 4).setDynamic(isDynamic));
    return this;
  }
  /** update vertex buffer and send data to gpu.
   *  @return {SolidML.BufferGeometry} this instance
   */
  update() {
    let indexCount=0, vertexCount=0;
    this.solidML.build(stat=>{
      const geom = this._getReferedGeom(stat);
      if (geom) {
        const vcount = geom.attributes.position.count,
              icount = geom.index.array.length;
        stat.matrix._applyToSrc_copyToDst(
          geom.attributes.position.array, vcount, 
          this.attributes.position.array, vertexCount, 3);
        stat.matrix._applyToSrc_copyToDst(
          geom.attributes.normal.array, vcount,
          this.attributes.normal.array, vertexCount, 3);
        stat.color._fillArray(this.attributes.color.array, vertexCount, vcount);
        for (let i=0; i<icount; i++, indexCount++) 
          this.index.array[indexCount] = geom.index.array[i] + vertexCount;
        vertexCount += vcount;
      }
    });
    this.computeVertexNormals();
    return this;
  }
  _getReferedGeom(stat) {
    return ((stat.param || stat.option) && stat.label in this.geometryCreators) ? 
           this.geometryCreators[stat.label](stat.param, stat.option) : this.geometryHash[stat.label];
  }
  _triangle(param, option) {
    const p = param.split(/,\s/).map(n=>Number(n));
    p.length = 9;
    const nml = new THREE.Vector3().set(p[3]-p[0], p[4]-p[1], p[5]-p[2]);
    nml.cross(new THREE.Vector3().set(p[6]-p[0], p[7]-p[1], p[8]-p[2])).normalize();
    const n = [nml.x, nml.y, nml.z, nml.x, nml.y, nml.z, nml.x, nml.y, nml.z];
    const geom = new THREE.BufferGeometry();
    geom.addAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    geom.addAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
    return geom;
  }
}