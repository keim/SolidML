/** THREE.BufferGeometry constructed by {@link SolidML}
 */
SolidML.BufferGeometry = class extends THREE.BufferGeometry {
  /** construct THREE.BufferGeometry by {@link SolidML}
   *  @param {string} [eisenScript] script to construct object. call {@link BufferGeometry#build} inside.
   *  @param {Object.<BufferGeometry>} [geometryHash] hash map of original geometries and keys in script.
   *  @param {object} [criteria] default criteria of this structure, specified by "set *" commands in script.
   */
  constructor(eisenScript=null, geometryHash=null, criteria=null) {
    super();
    const indexing = geom=>{
      const indices = new Uint16Array(geom.attributes.position.count);
      for (let i=0; i<indices.length; i++)
        indices[i] = i;
      geom.setIndex(new THREE.BufferAttribute(indices, 1));
      return geom;
    };
    /** hash map of original geometries and keys in script.
     *  @type {Object.<BufferGeometry>}
     */
    this.geometryHash = Object.assign({
      "box": new THREE.BoxBufferGeometry(1,1,1),
      "grid": new THREE.BoxBufferGeometry(1,1,1),
      "sphere": new THREE.SphereBufferGeometry(1,8,6),
      "line": new THREE.BoxBufferGeometry(1,0.02,0.02),
      "point": new THREE.SphereBufferGeometry(0.02,4,4),
      "cylinder": new THREE.CylinderBufferGeometry(1,1,1,8),
      "disc": new THREE.CylinderBufferGeometry(1,1,0.2,8),
      "corn": new THREE.ConeBufferGeometry(1,1,8),
      "torus": new THREE.TorusBufferGeometry(1,0.2,6,8),
      "tetra": indexing(new THREE.TetrahedronBufferGeometry(1)),
      "octa": indexing(new THREE.OctahedronBufferGeometry(1)),
      "dodeca": indexing(new THREE.DodecahedronBufferGeometry(1)),
      "icosa": indexing(new THREE.IcosahedronBufferGeometry(1)),
      "triangle": null,
      "tube": null,
      "mesh": null
    }, geometryHash);
    /** {@link SolidML} instance to construct object.
     *  @type {SolidML}
     */
    this.solidML = null;
    this.build(eisenScript, criteria);
  }
  /** construct object by script. new {@link BufferGeometry.solidML} is created inside.
   *  @param {string} [eisenScript] script to construct object. 
   *  @param {object} [criteria] default criteria of this structure, specified by "set *" commands in script.
   */
  build(eisenScript=null, criteria=null) {
    this.solidML = new SolidML(eisenScript, criteria);
    // some additional criteria
    const crit = this.solidML.criteria;
    if (crit["linewidth"] || crit["lw"]) {
      const w = Number(crit["linewidth"] || crit["lw"]) || 0.02;
      this.geometryHash.line = new THREE.BoxBufferGeometry(1,w,w);
      this.geometryHash.point = new THREE.SphereBufferGeometry(w,4,4);
    }
    this._allocVertexBuffer();
    this.update();
  }
  _allocVertexBuffer() {
    let indexCount=0, vertexCount=0;
    this.solidML.build(stat=>{
      const geom = this.geometryHash[stat.label];
      if (geom) {
        vertexCount += geom.attributes.position.count;
        indexCount += geom.index.array.length;
      }
    });
    this._indices = new Uint32Array(indexCount);
    this._positions = new Float32Array(vertexCount * 3);
    this._normals = new Float32Array(vertexCount * 3);
    this._colors = new Float32Array(vertexCount * 4);
    this.setIndex(new THREE.BufferAttribute(this._indices, 1));
    this.addAttribute('position', new THREE.BufferAttribute(this._positions, 3));
    this.addAttribute('normal', new THREE.BufferAttribute(this._normals, 3));
    this.addAttribute('color', new THREE.BufferAttribute(this._colors, 4));
  }
  update() {
    let indexCount=0, vertexCount=0, indexOffset=0;
    this.solidML.build(stat=>{
      const temp = this.geometryHash[stat.label],
            col  = stat.color.getRGBA(), 
            rgba = [col.r, col.g, col.b, col.a];

      if (temp) {
        const geom  = temp.clone(),
              vcount = temp.attributes.position.count,
              icount = temp.index.array.length;
        geom.applyMatrix(new THREE.Matrix4().copy(stat.matrix));
        this.attributes.position.array.set(geom.attributes.position.array, vertexCount * 3);
        this.attributes.normal.array.set(geom.attributes.normal.array, vertexCount * 3);
        for (let i=0; i<vcount; i++, vertexCount++) 
          this.attributes.color.array.set(rgba, vertexCount * 4);
        for (let i=0; i<icount; i++, indexCount++) 
          this.index.array[indexCount] = geom.index.array[i] + indexOffset;
        indexOffset += vcount;
      }
    });
    this.computeVertexNormals();
  }
  _triangle(param) {
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
