/**
 * @file Extention for three.js. SolidMLBufferGeometry.js depends on three.js and SolidML.js. Import after these dependent files.
 */
/**
 *  THREE.BufferGeometry constructed by {@link SolidML}. SolidMLBUfferGeometry.js depends on three.js and SolidML.js. Import after these dependent files.
 *  @extends {THREE.BufferGeometry}
 */
SolidML.BufferGeometry = class extends THREE.BufferGeometry {
  /** THREE.BufferGeometry constructed by {@link SolidML} script.
   *  @param {string} [script] script to construct object. call {@link SolidML.BufferGeometry#build} inside.
   *  @param {object} [criteria] default criteria of this structure, specified by "set *" commands in script.
   *  @param {Object.<BufferGeometry>} [geometryHash] hash map of source geometries and keys like {"box":new THREE.BoxGeometry(1, 1, 1)}. The source geometry should be indexed.
   */
  constructor(script=null, criteria=null, geometryHash=null) {
    super();
    /** 
     *  vertex count, same as BufferGeometry.attributes.position.count after build()
     *  @type {int}
     */
    this.vertexCount = 0;
    /** 
     *  index count, same as BufferGeometry.index.count after build()
     *  @type {int}
     */
    this.indexCount = 0;
    /** 
     *  object count. one continuous mesh is counted as 1 object. 
     *  @type {int}
     */
    this.objectCount = 0;
    /** 
     *  flag for transparent object (object.alpha < 1) 
     *  @type {boolean}
     */
    this.isTransparent = false;
    /** 
     *  {@link SolidML} instance to construct object.
     *  @type {SolidML}
     */
    this.solidML = null;
    /**
     *  filtering function(SolidML.BuildStatus)=>boolean.
     *  @type {function}
     */
    this.geometryFilter = null;
    // private
    this._vertexIndex = 0;
    this._indexIndex = 0;
    this._geometryCreator = new SolidML.GeometryCreator(geometryHash);
    if (script) 
      this.build(script, criteria);
  }
  /**
   * returns true when the script is already compiled
   * @return {boolean} 
   */
  isCompiled() {
    return !!this.solidML;
  }
  /** construct object by script. execute {@link SolidML.BufferGeometry#compile}=>{@link SolidML.BufferGeometry#estimateBufferCount}=>{@link SolidML.BufferGeometry#allocBuffers}=>{@link SolidML.BufferGeometry#update} inside
   *  @param {string} script script to construct object. 
   *  @param {object} [criteria] default criteria of this structure, specified by "set *" commands in script.
   *  @param {boolean} [isDynamic] set THREE.BufferAttribute.dynamic
   *  @param {int} [indexMargin] margin for index buffer, added to requierd index buffer count
   *  @param {int} [vertexMargin] margin for vertex buffer, added to requierd vertex buffer count
   *  @param {function} [filter] filter filtering function(SolidML.BuildStatus)=>boolean.
   *  @return {SolidML.BufferGeometry} this instance
   */
  build(script, criteria=null, isDynamic=false, indexMargin=0, vertexMargin=0, filter=null) {
    this.geometryFilter = filter;
    this.compile(script, criteria);
    this.estimateBufferCount(indexMargin, vertexMargin);
    this.allocBuffers(isDynamic);
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
  /** estimate index, vertex and object count with some margins. Counted values are set at {@link SolidML.BufferGeometry.indexCount}, {@link SolidML.BufferGeometry.vertexCount} and {@link SolidML.BufferGeometry.objectCount}.
   *  @param {int} [indexMargin] margin for index buffer, added to requierd index buffer count
   *  @param {int} [vertexMargin] margin for vertex buffer, added to requierd vertex buffer count
   *  @return {SolidML.BufferGeometry} this instance
   */
  estimateBufferCount(indexMargin=0, vertexMargin=0) {
    this.indexCount = indexMargin;
    this.vertexCount = vertexMargin;
    this.objectCount = 0;
    this._geometryCreator.setup(true);
    this.solidML.build(stat=>{
      if (this.geometryFilter && !this.geometryFilter(stat)) return;
      const geomCreated = this._geometryCreator.create(stat);
      if (geomCreated) {
        stat.color._incrementRandMT();
        this.indexCount += geomCreated.index.array.length;
        this.vertexCount += geomCreated.attributes.position.count;
        this.objectCount++;
      }
    });
    this._geometryCreator.composeMeshes(true).forEach(reference=>{
      this.indexCount += reference.indexCount;
      this.vertexCount += reference.vertexCount;
      this.objectCount++;
    });
    return this;
  }
  /** allocate index buffer and vertex buffer
   *  @param {boolean} [isDynamic] set THREE.BufferAttribute.dynamic
   *  @param {int} [indexCount] index buffer size. pass 0 to allocate by {@link SolidML.BufferGeometry.indexCount} estimated by {@link SolidML.BufferGeometry#estimateBufferCount}
   *  @param {int} [vertexCount] vertex buffer size. pass 0 to allocate by {@link SolidML.BufferGeometry.vertexCount} estimated by {@link SolidML.BufferGeometry#estimateBufferCount}
   *  @return {SolidML.BufferGeometry} this instance
   */
  allocBuffers(isDynamic=true, indexCount=0, vertexCount=0) {
    if (indexCount  > 0) this.indexCount  = indexCount;
    if (vertexCount > 0) this.vertexCount = vertexCount;
    this._indices = new Uint32Array(this.indexCount);
    this._positions = new Float32Array(this.vertexCount * 3);
    this._normals = new Float32Array(this.vertexCount * 3);
    this._colors = new Float32Array(this.vertexCount * 4);
    const usage = isDynamic ? THREE.DynamicDrawUsage : THREE.StaticDrawUsage;
    this.setIndex(new THREE.BufferAttribute(this._indices, 1).setUsage(usage));
    this.setAttribute('position', new THREE.BufferAttribute(this._positions, 3).setUsage(usage));
    this.setAttribute('normal', new THREE.BufferAttribute(this._normals, 3).setUsage(usage));
    this.setAttribute('color', new THREE.BufferAttribute(this._colors, 4).setUsage(usage));
    return this;
  }
  /** update vertex buffer and send data to gpu.
   *  @param {THREE.Vector3} [sortingDotProduct] sort geometries by dot product with specified vector. pass null to sort by generated order. meshes are not sorted.
   *  @return {SolidML.BufferGeometry} this instance
   */
  update(sortingDotProduct=null) {
    this._indexIndex = 0;
    this._vertexIndex = 0;
    this.isTransparent = false;
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
  _copyGeometry(stat, geom) {
    if (!geom) return;
    const vcount = geom.attributes.position.count,
          icount = geom.index.array.length;
    let invertFace = false;
    if (stat) {
      stat.matrix._applyToSrc_copyToDst(
        geom.attributes.position.array, vcount, 
        this.attributes.position.array, this._vertexIndex, 3);
      stat.color._fillArray(this.attributes.color.array, this._vertexIndex, vcount);
      if (stat.color.a < 1)
        this.isTransparent = true;
      invertFace = (stat.matrix.signed_det3() < 0);
    } else {
      this.attributes.position.array.set(geom.attributes.position.array, this._vertexIndex*3);
      this.attributes.color   .array.set(geom.attributes.color   .array, this._vertexIndex*4);
    }
    if (invertFace) {
      for (let i=0; i<icount; i+=3, this._indexIndex+=3) {
        this.index.array[this._indexIndex]   = geom.index.array[i]   + this._vertexIndex;
        this.index.array[this._indexIndex+1] = geom.index.array[i+2] + this._vertexIndex;
        this.index.array[this._indexIndex+2] = geom.index.array[i+1] + this._vertexIndex;
      }
    } else {
      for (let i=0; i<icount; i++, this._indexIndex++) 
        this.index.array[this._indexIndex] = geom.index.array[i] + this._vertexIndex;
    }
    this._vertexIndex += vcount;
  }
}
// 
SolidML.GeometryCreator = class {
  constructor(geometryHash) {
    this.rotz = new THREE.Matrix4().makeRotationZ(-Math.PI/2),
    this.roty = new THREE.Matrix4().makeRotationY(Math.PI/2);
    // geometry hash
    this._geometryHash = Object.assign({
      "box":      new THREE.BoxGeometry(1, 1, 1), 
      "sphere":   new THREE.SphereGeometry(0.5, 8, 6), 
      "cylinder": new THREE.CylinderGeometry(0.5, 0.5, 1, 8).applyMatrix4(this.rotz), 
      "cone":     new THREE.ConeGeometry(0.5, 1, 8).applyMatrix4(this.rotz), 
      "torus":    new THREE.TorusGeometry(0.5, 0.1, 4, 8).applyMatrix4(this.roty), 
      "tetra":    this._indexing(new THREE.TetrahedronGeometry(0.5)), 
      "octa":     this._indexing(new THREE.OctahedronGeometry(0.5)), 
      "dodeca":   this._indexing(new THREE.DodecahedronGeometry(0.5)), 
      "icosa":    this._indexing(new THREE.IcosahedronGeometry(0.5)), 
      "grid":     new SolidML.GridGeometry(1, 0.1), 
      "line":     new THREE.BoxGeometry(1, 0.1, 0.1),
      "triangle": this.__triangleGeom([1,0,0,0,1,0,0,0,1]),
    }, geometryHash);
    // cahce area
    this._cache = {
      "sphere":   [],
      "cylinder": [],
      "cone":     [],
      "grid":     [],
      "line":     [],
      "torus":    {},
      "triangle": {},
      "path"    : {}
    };
    // creator functions
    this._creatorFunctions = {
      "sphere":   this._sphereCreator.bind(this),
      "cylinder": this._cylinderCreator.bind(this),
      "cone":     this._coneCreator.bind(this),
      "grid":     this._gridCreator.bind(this),
      "line":     this._lineCreator.bind(this),
      "torus":    this._torusCreator.bind(this),
      "triangle": this._triangleCreator.bind(this),
      "path":     this._pathCreator.bind(this),
      "mesh":     this._meshCreator.bind(this),
      "cmesh":    this._cmeshCreator.bind(this),
      "tube":     this._tubeCreator.bind(this),
      "ctube":    this._ctubeCreator.bind(this),
    };
  }
  setup(isEstimationOnly) {
    // tempolaly area
    this._composers = {};
    this._isEstimationOnly = isEstimationOnly;
  }
  create(stat) {
    return (stat.label in this._creatorFunctions && (!(stat.label in this._geometryHash) || stat.param || stat.options)) ?
           this._creatorFunctions[stat.label](stat) : this._geometryHash[stat.label];
  }
  composeMeshes(isEstimationOnly) {
    if (isEstimationOnly != this._isEstimationOnly)
      throw Error("fatal error : MeshComposer");
    return Object.keys(this._composers).map(key=>{
      const geom = this._composers[key].create(isEstimationOnly);
      geom.name = "mesh[" + key + "]";
      return geom;
    });
  }
  _sphereCreator(stat) {
    let segment = Number(stat.options[0])>>0;
    if (!segment || segment<3) segment = 8;
    if (!this._cache.sphere[segment]) 
      this._cache.sphere[segment] = new THREE.SphereGeometry(0.5, segment, segment);
    return this._cache.sphere[segment];
  }
  _cylinderCreator(stat) {
    let segment = Number(stat.options[0])>>0;
    if (!segment || segment<3) segment = 8;
    if (!this._cache.cylinder[segment]) 
      this._cache.cylinder[segment] = new THREE.CylinderGeometry(0.5, 0.5, 1, segment).applyMatrix4(this.rotz);
    return this._cache.cylinder[segment];
  }
  _coneCreator(stat) {
    let segment = Number(stat.options[0])>>0;
    if (!segment || segment<3) segment = 8;
    if (!this._cache.cone[segment]) 
      this._cache.cone[segment] = new THREE.ConeGeometry(0.5, 1, segment).applyMatrix4(this.rotz);
    return this._cache.cone[segment];
  }
  _gridCreator(stat) {
    let edgeWidth = Number(stat.options[0])>>0;
    if (!edgeWidth) edgeWidth = 10;
    if (!this._cache.grid[edgeWidth]) 
      this._cache.grid[edgeWidth] = new SolidML.GridGeometry(1, edgeWidth/100);
    return this._cache.grid[edgeWidth];
  }
  _lineCreator(stat) {
    let lineWidth = Number(stat.options[0])>>0;
    if (!lineWidth) lineWidth = 10;
    if (!this._cache.line[lineWidth]) 
      this._cache.line[lineWidth] = new THREE.BoxGeometry(1, lineWidth/100, lineWidth/100);
    return this._cache.line[lineWidth];
  }
  _torusCreator(stat) {
    const param = stat.param || '[10,4,8]';
    if (param in this._cache.torus) 
      return this._cache.torus[param];
    const p = param.split(/[\s,;:]/).map(s=>Number(s)||0);
    const tube = p[0]/100 || 0.1;
    const radseg = (!p[1] || p[1]<3) ? 4 : p[1];
    const tubseg = (!p[2] || p[2]<3) ? 8 : p[2];
    const geom = new THREE.TorusGeometry(0.5, tube, radseg, tubseg).applyMatrix4(this.roty);
    this._cache.torus[param] = geom;
    return geom;
  }
  _triangleCreator(stat) {
    if (!stat.param) throw new Error('triangle geometry requires parameters as "triangle[...]"');
    if (stat.param in this._cache.triangle) 
      return this._cache.triangle[stat.param];
    const p = stat.param.split(/[\s,;:]/).map(s=>Number(s)||0);
    if (p.length > 9) p.length = 9;
    const geom = this.__triangleGeom(p);
    this._cache.triangle[stat.param] = geom;
    return geom;
  }
    // generate hash map
  _indexing(geom) {
    const indices = new Uint16Array(geom.attributes.position.count);
    for (let i=0; i<indices.length; i++)
      indices[i] = i;
    geom.setIndex(new THREE.BufferAttribute(indices, 1));
    return geom;
  }
  _pathCreator(stat) {
    if (!stat.param) throw new Error('path geometry requires parameters as "path:5:0:1[...]"');
    if (stat.param in this._cache.path) 
      return this._cache.path[stat.param];
    const opt = stat.options || [];
    const p = stat.param.split(/[\s,;:]/).map(s=>Number(s)||0);
    return this._cache.path[stat.param] = this.__pathGeom(p, ((opt[0]||5)/100), ((opt[1]||0)/100), ((opt[2]||1)/100));
  }
  _meshCreator(stat) {
    if (!(stat.referenceID in this._composers)) {
      this._composers[stat.referenceID] = new SolidML.MeshComposer(stat, true, 0);
      if (stat.lastContinuousMesh)
        this._composers[stat.referenceID].compose(stat.lastContinuousMesh, this._isEstimationOnly);
    }
    this._composers[stat.referenceID].compose(stat, this._isEstimationOnly);
    return null;
  }
  _cmeshCreator(stat) {
    if (!(stat.referenceID in this._composers)) {
      this._composers[stat.referenceID] = new SolidML.MeshComposer(stat, false, 0);
      if (stat.lastContinuousMesh)
        this._composers[stat.referenceID].compose(stat.lastContinuousMesh, this._isEstimationOnly);
    }
    this._composers[stat.referenceID].compose(stat, this._isEstimationOnly);
    return null;
  }
  _tubeCreator(stat) {
    if (!(stat.referenceID in this._composers)) {
      const tubeWidth = (stat.lastContinuousMesh) ? this._composers[stat.lastContinuousMesh.referenceID]._tubeWidth : Math.pow(stat.matrix.det3(), 1/3);
      this._composers[stat.referenceID] = new SolidML.MeshComposer(stat, true, tubeWidth);
      if (stat.lastContinuousMesh)
        this._composers[stat.referenceID].compose(stat.lastContinuousMesh, this._isEstimationOnly);
    }
    this._composers[stat.referenceID].compose(stat, this._isEstimationOnly);
    return null;
  }
  _ctubeCreator(stat) {
    if (!(stat.referenceID in this._composers)) {
      const tubeWidth = (stat.lastContinuousMesh) ? this._composers[stat.lastContinuousMesh.referenceID]._tubeWidth : Math.pow(stat.matrix.det3(), 1/3);
      this._composers[stat.referenceID] = new SolidML.MeshComposer(stat, false, tubeWidth);
      if (stat.lastContinuousMesh)
        this._composers[stat.referenceID].compose(stat.lastContinuousMesh, this._isEstimationOnly);
    }
    this._composers[stat.referenceID].compose(stat, this._isEstimationOnly);
    return null;
  }
  __triangleGeom(p) {
    const vertex = new Float32Array(9);
    vertex.set(p);
    const geom = new THREE.BufferGeometry();
    geom.setIndex(new THREE.Uint16BufferAttribute([0,1,2], 1));
    geom.setAttribute('position', new THREE.BufferAttribute(vertex, 3));
    return geom;
  }
  __pathGeom(p, depth, bevelThickness, bevelSize) {
    if (p.length < 6)
      return null;
    const path = new THREE.Shape();
    path.moveTo(p[0], p[1]);
    for (let i=2; i<p.length; i+=2) 
      path.lineTo(p[i], p[i+1]);
    path.lineTo(p[0], p[1]);
    return this._indexing(new THREE.ExtrudeGeometry( path, {
      steps: 1,
      bevelSegments: 1,
      bevelEnabled: (bevelThickness>0),
      bevelThickness,
      bevelSize,
      depth
    }));
  }
}
SolidML.MeshComposer = class {
  constructor(stat, isFlat, tubeWidth) {
    // for composition
    this._isFlat = isFlat;
    this._tubeWidth = tubeWidth;
    this._vertexStac = [];
    this._colorStac = [];
    this._vertexEstimation = 0;
    // for caluculation
    this._matrix = null;
    this._qrt = new THREE.Quaternion();
    this._dir = new THREE.Vector3();
    this._v0 = new THREE.Vector3();
    this._vx = new THREE.Vector3();
    this._vy = new THREE.Vector3();
    this._vz = new THREE.Vector3();
    // cross section points Array.<THREE.Vector2>
    let segment = Number(stat.options[0]) || 0;
    if (segment < 3) segment = (this._isFlat) ? 4 : 6;
    this._crossSection = [];
    for (let i=0; i<segment; i++) {
      const rad = (i+0.5)/segment * Math.PI * 2;
      this._crossSection.push(new THREE.Vector2(Math.cos(rad)*0.707, Math.sin(rad)*0.707));
    }
  }
  compose(stat, isEstimationOnly) {
    if (isEstimationOnly) {
      this._vertexEstimation += this._crossSection.length;
      stat.color._incrementRandMT();
    } else {
      if (this._matrix) 
        this._extendMesh(stat);
      else 
        this._matrix = new THREE.Matrix4();
      this._matrix.copy(stat.matrix);
      this._colorStac.push(stat.color.getRGBA());
    }
  }
  create(isEstimationOnly) {
    if (isEstimationOnly) {
      const vmax = this._vertexEstimation,
            seg = this._crossSection.length,
            sidefaceCount = vmax - seg,
            capfaceCount = seg - 2,
            vertexCount = vmax * ((this._isFlat) ? 2 : 1) + seg * 2;
      return {
        name: null,
        vertexCount,
        indexCount: sidefaceCount * 6 + capfaceCount * 6
      };
    }
    // last extention
    this._extendMesh(null);
    // face indexing
    let i,j;
    let vmax = this._vertexStac.length;
    const seg = this._crossSection.length,
          sidefaceCount = vmax - seg,
          capfaceCount = seg - 2,
          vertexCount = vmax * ((this._isFlat) ? 2 : 1) + seg * 2,
          indexBuffer = new Uint16Array(sidefaceCount * 6 + capfaceCount * 6),
          colorBuffer = new Float32Array(vertexCount * 4);
    // sideface
    const createSideface = (iface, ivertex, ioff)=>{
      const ioff2 = (ioff + 1) % seg;
      indexBuffer[iface * 6]     = ivertex + ioff;
      indexBuffer[iface * 6 + 1] = ivertex + ioff2;
      indexBuffer[iface * 6 + 2] = ivertex + ioff2 + seg;
      indexBuffer[iface * 6 + 3] = ivertex + ioff;
      indexBuffer[iface * 6 + 4] = ivertex + ioff2 + seg;
      indexBuffer[iface * 6 + 5] = ivertex + ioff + seg;
    };
    if (this._isFlat) {
      // flat shadeing requires vertices twice 
      for (i=0; i<sidefaceCount; i+=seg)
        for (j=0; j<seg; j++)
          createSideface(i+j, i+(j&1)*vmax, j);
      // color buffer
      for (i=0; i<this._colorStac.length; i++) 
        for (j=0; j<seg; j++) {
          let col = this._colorStac[i];
          colorBuffer[(i*seg+j+vmax)*4]   = colorBuffer[(i*seg+j)*4]   = col.r;
          colorBuffer[(i*seg+j+vmax)*4+1] = colorBuffer[(i*seg+j)*4+1] = col.g;
          colorBuffer[(i*seg+j+vmax)*4+2] = colorBuffer[(i*seg+j)*4+2] = col.b;
          colorBuffer[(i*seg+j+vmax)*4+3] = colorBuffer[(i*seg+j)*4+3] = col.a;
        }
      this._vertexStac = this._vertexStac.concat(this._vertexStac);
      vmax = this._vertexStac.length;
    } else {
      // smooth shading
      for (i=0; i<sidefaceCount; i+=seg)
        for (j=0; j<seg; j++)
          createSideface(i+j, i, j);
      // color buffer
      for (i=0; i<this._colorStac.length; i++) 
        for (j=0; j<seg; j++) {
          let col = this._colorStac[i];
          colorBuffer[(i*seg+j)*4]   = col.r;
          colorBuffer[(i*seg+j)*4+1] = col.g;
          colorBuffer[(i*seg+j)*4+2] = col.b;
          colorBuffer[(i*seg+j)*4+3] = col.a;
        }
    }
    // cap face
    for (i=0; i<seg; i++) {
      this._vertexStac.push(this._vertexStac[i]);
      colorBuffer[(vmax+i)*4] = colorBuffer[i*4];
      colorBuffer[(vmax+i)*4+1] = colorBuffer[i*4+1];
      colorBuffer[(vmax+i)*4+2] = colorBuffer[i*4+2];
      colorBuffer[(vmax+i)*4+3] = colorBuffer[i*4+3];
    }
    for (i=0; i<seg; i++) {
      this._vertexStac.push(this._vertexStac[vmax-seg+i]);
      colorBuffer[(vmax+seg+i)*4] = colorBuffer[(vmax-seg+i)*4];
      colorBuffer[(vmax+seg+i)*4+1] = colorBuffer[(vmax-seg+i)*4+1];
      colorBuffer[(vmax+seg+i)*4+2] = colorBuffer[(vmax-seg+i)*4+2];
      colorBuffer[(vmax+seg+i)*4+3] = colorBuffer[(vmax-seg+i)*4+3];
    }
    for (i=0; i<capfaceCount; i++) {
      indexBuffer[(sidefaceCount * 2 + i) * 3] = vmax;
      indexBuffer[(sidefaceCount * 2 + i) * 3 + 1] = vmax + i + 2;
      indexBuffer[(sidefaceCount * 2 + i) * 3 + 2] = vmax + i + 1;
      indexBuffer[(sidefaceCount * 2 + capfaceCount + i) * 3] = vmax + seg;
      indexBuffer[(sidefaceCount * 2 + capfaceCount + i) * 3 + 1] = vmax + seg + i + 1;
      indexBuffer[(sidefaceCount * 2 + capfaceCount + i) * 3 + 2] = vmax + seg + i + 2;
    }
    // create geometry
    const geom = new THREE.BufferGeometry(),
          positions = new Float32Array(this._vertexStac.length*3);
    geom.setIndex(new THREE.BufferAttribute(indexBuffer, 1));
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3).copyVector3sArray(this._vertexStac));
    geom.setAttribute('color',    new THREE.BufferAttribute(colorBuffer, 4));
    return geom;
  }
  _extendMesh(stat) {
    const pme = this._matrix.elements;
    this._v0.set(pme[12]/pme[15], pme[13]/pme[15], pme[14]/pme[15]);
    if (stat) {
      // update extending directions quarternion
      const me = stat.matrix.elements;
      this._dir.set(me[12]/me[15], me[13]/me[15], me[14]/me[15]).sub(this._v0).normalize();
      this._qrt.setFromUnitVectors(this._vx.set(pme[0], pme[1], pme[2]).normalize(), this._dir);
    }
    if (this._tubeWidth > 0) {
      // keep constant width
      this._vy.set(pme[4], pme[5], pme[6]).normalize().multiplyScalar(this._tubeWidth).applyQuaternion(this._qrt);
      this._vz.set(pme[8], pme[9], pme[10]).normalize().multiplyScalar(this._tubeWidth).applyQuaternion(this._qrt);
    } else {
      // rotate
      this._vy.set(pme[4], pme[5], pme[6]).applyQuaternion(this._qrt);
      this._vz.set(pme[8], pme[9], pme[10]).applyQuaternion(this._qrt);
    }
    for (let i=0; i<this._crossSection.length; i++) {
      const v2 = this._crossSection[i];
      this._vertexStac.push(this._vy.clone().multiplyScalar(v2.x).addScaledVector(this._vz, v2.y).add(this._v0));
    }
  }
}
SolidML.GridGeometry = class extends THREE.BufferGeometry {
  constructor(size, edgeWidth) {
    super();
    const l = size / 2, s = l - edgeWidth;
    const positions = new Float32Array(24*6*3), indices = new Uint16Array(48*6);
    const srcv = [new THREE.Vector3(-l,-l,l), new THREE.Vector3(l,-l,l), new THREE.Vector3(l,l,l), new THREE.Vector3(-l,l,l),
                  new THREE.Vector3(-s,-s,l), new THREE.Vector3(s,-s,l), new THREE.Vector3(s,s,l), new THREE.Vector3(-s,s,l),
                  new THREE.Vector3(-s,-s,l), new THREE.Vector3(s,-s,l), new THREE.Vector3(s,s,l), new THREE.Vector3(-s,s,l),
                  new THREE.Vector3(-s,-s,s), new THREE.Vector3(s,-s,s), new THREE.Vector3(s,s,s), new THREE.Vector3(-s,s,s),
                  new THREE.Vector3(-s,-s,l), new THREE.Vector3(s,-s,l), new THREE.Vector3(s,s,l), new THREE.Vector3(-s,s,l),
                  new THREE.Vector3(-s,-s,s), new THREE.Vector3(s,-s,s), new THREE.Vector3(s,s,s), new THREE.Vector3(-s,s,s)];
    const srci = [0,1,4,4,1,5, 1,2,5,5,2,6, 2,3,6,6,3,7, 3,0,7,7,0,4, 8,9,12,12,9,13, 17,18,21,21,18,22, 10,11,14,14,11,15, 19,16,23,23,16,20];
    let vidx = 0, iidx = 0;
    const face = (fidx,xx,xy,xz,yx,yy,yz,zx,zy,zz)=>{
      for (let i=0; i<24; i++, vidx+=3) {
        positions[vidx]   = srcv[i].x * xx + srcv[i].y * yx + srcv[i].z * zx;
        positions[vidx+1] = srcv[i].x * xy + srcv[i].y * yy + srcv[i].z * zy;
        positions[vidx+2] = srcv[i].x * xz + srcv[i].y * yz + srcv[i].z * zz;
      }
      for (let j=0; j<48; j++)
        indices[iidx++] = srci[j]+fidx*24;
    };
    face(0,  1, 0, 0,  0, 1, 0,  0, 0, 1);
    face(1,  0, 1, 0,  0, 0, 1,  1, 0, 0);
    face(2,  0, 0, 1,  1, 0, 0,  0, 1, 0);
    face(3,  1, 0, 0,  0,-1, 0,  0, 0,-1);
    face(4,  0, 1, 0,  0, 0,-1, -1, 0, 0);
    face(5,  0, 0, 1, -1, 0, 0,  0,-1, 0);
    this.setIndex(new THREE.BufferAttribute(indices, 1));
    this.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.computeVertexNormals();
  }
}
