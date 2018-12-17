/** @file Core module. SolidML.js does not depend on any other libraries. */
/**
 * Construct fractal-like 3D models by cryptic script based on [Structure Synth]{@link http://structuresynth.sourceforge.net/}'s' Eisen Script.
 * SolidML.js does not depend on any other libraries. If you want to import model into three.js, see {@link SolidML.BufferGeometry}.
 */
class SolidML {
  /** Basically one instance for one script. 
   *  @param {string} [script] SolidML script to compile, calls {@link SolidML#compile} inside.
   *  @param {object} [criteria] default criteria of this structure, specified by "set *" commands in script.
   */
  constructor(script=null, criteria=null) {
    SolidML.ScriptParser._initialize();
    /** random number generator for constuct model.
     *  @type {SolidML.randMT}
     */
    this.randMT = new SolidML.randMT();
    /** criteria of this structure, specified by "set *" commands in script
     *  @type {SolidML.Criteria}
     */
    this.criteria = new SolidML.Criteria(this.randMT, criteria);
    /** hash map of defined variables, specified by "#define *" commands in script
     *  @type {object}
     */
    this.variables = {};
    if (script)
      this.compile(script);
  }
  /** Parse script, make a structure of recursive calls inside.
   *  @param  {string} script SolidML script to compile
   *  @param  {int} [seed] seed number for MT-random number calculations, pass null to set by time. this value is overwritten by "set seed" command in the script.
   *  @return {SolidML} this instance
   */
  compile(script, seed=null) {
    // translate #define and comment out
    script = SolidML.ScriptParser._normalizeScript(script);
    this._root = new SolidML.Rule(this, null, null, null);
    this._root._parse(script, 0);
    this._randMTSeed = seed || new Date().getTime();
    return this;
  }
  /** Build object structure. This function has to be called after calling {@link SolidML#compile}.
   *  @param {SolidML~buildCallback} [callback] function called back when new object has created. Call passed {@link SolidML.BuildStatus#stopBuilding} to stop building immediatly.
   *  @return {any} returned value of callback. when callback is undefined, returns the array of cloned {@link SolidML.BuildStatus}.
   */
  build(callback=null) {
    if (!this._root)
      throw Error("SolidML.complie() should be called before calling SolidML.build()");
    this.randMT.seed = this.criteria.seed || this._randMTSeed;
    const status = this._root._build(new SolidML.BuildStatus(callback || this.defaultBuildCallback));
    return status.result;
  }
  defaultBuildCallback(stat) {
    stat.result = stat.result || [];
    stat.result.push(stat.reference());
  }
}
/** callback function passed to {@link SolidML#build}
 *  @callback SolidML~buildCallback
 *  @param {SolidML.BuildStatus} status the status while building structure
 *  @return {any} value of {@link SolidML.BuildStatus.result}.
 */
/** current version number 
 *  @type {String}
 */
SolidML.VERSION = "0.3.0";
/** Represents a criteria of the structure, specified as "set [key] [value]" in script. Keep any user-defined criteria for your own purpose. {@link SolidML.Criteria#getValue} method refers them. */
SolidML.Criteria = class {
  /** SolidML.Criteria is created in the constructor of {@link SolidML}.  */
  constructor(randMT, hash) {
    /** the maximum limit of {@link SolidML.Criteria.maxdepth}. default is 5000 
     *  @type {int}
     */
    this.systemMaxDepth = 5000;
    /** the maximum limit of {@link SolidML.Criteria.maxobjects}. default is 5000000
     *  @type {int}
     */
    this.systemMaxObjects = 5000000;
    /** maximum depth to terminate recursive rule calls. default is 2000 
     *  @type {int}
     */
    this.maxdepth = 2000;
    /** maximum object count to terminate constuction. default is 1000000
     *  @type {int}
     */
    this.maxobjects = 1000000;
    /** minimun size to create object, check [the 3dim-determinant of matrix] < [minsize] ^ 3. default is 0
     *  @type {number}
     */
    this.minsize = 0;
    /** maximun size to create object, check [the 3dim-determinant of matrix] > [maxsize] ^ 3. default is 10000
     *  @type {number}
     */
    this.maxsize = 10000;
    /** seed number for Mersenne Twister random number generator. set null to seed by time. detfault is null
     *  @type {int}
     */
    this.seed =  null;
    /** background color in #HEX type string. set null to use system defined background. default is null
     *  @type {string}
     */
    this.background = null;
    // private color pool instance
    this._colorpoolInstance = new SolidML.ColorPool((hash&&hash["colorpool"]) || "randomrgb", randMT);
    if (hash && ("colorpool" in hash))
      delete hash["colorpool"];
    // copy hash to this
    Object.assign(this, hash);
  }
  /** colorpool referd from "color rondom" command.  default is "randomrgb"
   *  @type {string}
   */
  get colorpool() {
    return this._colorpoolInstance.scheme;
  }
  set colorpool(scheme) {
    this._colorpoolInstance.scheme = scheme;
  }
  _set(key, value) {
    switch(key) {
      case "maxdepth": case "":
        this.maxdepth = this._getNumber(value, this.maxdepth);
        if (this.maxdepth > this.systemMaxDepth) this.maxdepth = this.systemMaxDepth;
        break;
      case "maxobjects": case "mo":
        this.maxobjects = this._getNumber(value, this.maxobjects);
        if (this.maxobjects > this.systemMaxObjects) this.maxobjects = this.systemMaxObjects;
        break;
      case "minsize": case "min":
        this.minsize = this._getNumber(value, this.minsize);
        break;
      case "maxsize": case "max":
        this.maxsize = this._getNumber(value, this.maxsize);
        break;
      case "seed": case "s":
        this.seed = this._getNumber(value, null);
        break;
      case "background": 
        this.background = this._getColor(value);
        break;
      case "colorpool": case "cp":
        this.colorpool = value;
        break;
      case "cp:g":
        this.colorpool = "grayscale:"+value;
        break;
      case "cp:h":
        this.colorpool = "randomhue:"+value;
        break;
      default:
        this[key] = value;
        break;
    }
  }
  /** get criterla by key and type
   *  @param {string} key criteria name 
   *  @param {string} type criteria value type "number", "int", "color", "array" or "string" is available. the "string" type returns the raw string data in script.
   *  @return {any} value for specified criteria
   */
  getValue(key, type) {
    if (key in this) {
      switch(type) {
        case "number":
          return this._getNumber(this[key], 0);
        case "int":
          return (this._getNumber(this[key], 0)>>0);
        case "color":
          return this._getColor(this[key], "#000");
        case "array":
          return this._getArray(this[key]);
        case "hash":
          return this._getHash(key);
        default:
          return this[key] || "";
      }
    }
    return null;
  }
  _getNumber(value, numFailure) {
    const n = Number(value);
    return isNaN(n) ? numFailure : n;
  }
  _getColor(value, strFailure) {
    if (value in SolidML.ColorTable) return SolidML.ColorTable[value];
    if (/^#[0-9a-fA-F]+$/.test(value)) return value;
    const n = Number(value);
    if (isNaN(n)) return strFailure;
    const f = (Math.min(Math.max(n*2.56, 0), 255)).toString(16);
    return "#" + f + f + f;
  }
  _getArray(value) {
    return value.replace(/\[|\]/g, "").split(",");
  }
  _getHash(key) {
    return Object.keys(this).filter(name=>(name.indexOf(key)==0)).reduce((accum,name)=>{
      const k = name.substring(key.length+2);
      accum[k] = this[name];
      return accum;
    }, {});
  }
}
/** Represents 4dim-matrix inside, compatible for THREE.Matrix4.copy() method. */
SolidML.Matrix4 = class {
  /** SolidML.Matrix4 passed by collback function of {@link SolidML#build}. you can convert for three.js by THREE.Matrix4.copy(SolidML.Matrix4). */
  constructor() { this.elements = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]); }
  fromArray(a) { this.elements.set(a); return this; }
  identity() { return this.fromArray([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);}
  copy(m) { return this.fromArray(m.elements); }
  clone() { return new SolidML.Matrix4().copy(this); }
  makeTranslation(x, y, z) { return this.fromArray([1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]); }
  makeScale(x, y, z) { return this.fromArray([x,0,0,0, 0,y,0,0, 0,0,z,0, 0,0,0,1]); }
  makeRotationX(theta) { const c=Math.cos(theta), s=Math.sin(theta); return this.fromArray([1,0,0,0, 0,c,-s,0, 0,s,c,0, 0,0,0,1]); }
  makeRotationY(theta) { const c=Math.cos(theta), s=Math.sin(theta); return this.fromArray([c,0,s,0, 0,1,0,0, -s,0,c,0, 0,0,0,1]); }
  makeRotationZ(theta) { const c=Math.cos(theta), s=Math.sin(theta); return this.fromArray([c,-s,0,0, s,c,0,0, 0,0,1,0, 0,0,0,1]); }
  multiply(m) { return this.multiplyMatrices(this, m); }
  premultiply(m) { return this.multiplyMatrices(m, this); }
  /** @return {number} 3dim-determinant calclate for size checking. */
  det3() {
    return Math.abs(this.signed_det3());
  }
  signed_det3() {
    const te = this.elements;
    return (te[0]*te[5]*te[10] - te[0]* te[6]*te[9] - te[1]*te[4]*te[10] + te[1]* te[6]*te[8] + te[2]*te[4]* te[9] - te[2]*te[5]*te[8]);
  }
  multiplyMatrices(a, b) {
    const ae = a.elements, be = b.elements;
    const a11 = ae[0], a12 = ae[4], a13 = ae[8],  a14 = ae[12];
    const a21 = ae[1], a22 = ae[5], a23 = ae[9],  a24 = ae[13];
    const a31 = ae[2], a32 = ae[6], a33 = ae[10], a34 = ae[14];
    const a41 = ae[3], a42 = ae[7], a43 = ae[11], a44 = ae[15];
    const b11 = be[0], b12 = be[4], b13 = be[8],  b14 = be[12];
    const b21 = be[1], b22 = be[5], b23 = be[9],  b24 = be[13];
    const b31 = be[2], b32 = be[6], b33 = be[10], b34 = be[14];
    const b41 = be[3], b42 = be[7], b43 = be[11], b44 = be[15];
    this.elements[0]  = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41;
    this.elements[4]  = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42;
    this.elements[8]  = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43;
    this.elements[12] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44;
    this.elements[1]  = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41;
    this.elements[5]  = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42;
    this.elements[9]  = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43;
    this.elements[13] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44;
    this.elements[2]  = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41;
    this.elements[6]  = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42;
    this.elements[10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43;
    this.elements[14] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44;
    this.elements[3]  = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41;
    this.elements[7]  = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42;
    this.elements[11] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43;
    this.elements[15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44;
    return this;
  }
  _applyToSrc_copyToDst(src, srcLength, dst, dstIndex, itemSize) {
    const te = this.elements;
    for (let i=0,j=dstIndex; i<srcLength; i++, j++) {
      const x = src[i*itemSize], y = src[i*itemSize+1], z = src[i*itemSize+2];
      const dx = te[0] * x + te[4] * y + te[8]  * z + te[12];
      const dy = te[1] * x + te[5] * y + te[9]  * z + te[13];
      const dz = te[2] * x + te[6] * y + te[10] * z + te[14];
      const iw = 1/(te[3] * x + te[7] * y + te[11] * z + te[15]);
      dst[j*itemSize]   = dx * iw;
      dst[j*itemSize+1] = dy * iw;
      dst[j*itemSize+2] = dz * iw;
    }
  }
}
/** Keep color infomations as (hue, saturation, brightness, alpha) */
SolidML.ColorHSBA = class {
  /** 
   * @param {number} [h] hue in degree (0-360)
   * @param {number} [s] satulation between 0 and 1
   * @param {number} [b] brightness between 0 and 1
   * @param {number} [a] alpha between 0 and 1
   */
  constructor(h=0,s=0,b=0,a=1) { 
    /** hue in degree (0-360)
     *  @type {number}
     */
    this.h = h; 
    /** satulation between 0 and 1
     *  @type {number}
     */
    this.s = s; 
    /** brightness between 0 and 1
     *  @type {number}
     */
    this.b = b; 
    /** alpha between 0 and 1
     *  @type {number}
     */
    this.a = a; 
    /** colorpool scheme for random generation, null for constant value
     *  @type {SolidML.ColorPool}
     */
    this.cp = null; 
  }
  /** set
   * @param {number} h hue in degree (0-360)
   * @param {number} s satulation between 0 and 1
   * @param {number} b brightness between 0 and 1
   * @param {number} a alpha between 0 and 1
   * @return {SolidML.ColorHSBA} this instance
   */
  set(h,s,b,a) {
    this.h = h;
    this.s = s;
    this.b = b;
    this.a = a;
    this.cp = null;
    return this;
  }
  /** copy from
   *  @param {SolidML.ColorHSBA} c source color copy from
   *  @return {SolidML.ColorHSBA} this instance
   */
  copy(c) {
    this.h = c.h;
    this.s = c.s;
    this.b = c.b;
    this.a = c.a;
    this.cp = c.cp;
    return this;
  }
  /** create clone
   * @return {SolidML.ColorHSBA} new instance
   */
  clone() {
    return new SolidML.ColorHSBA().copy(this);
  }
  /** update color by another color
   *  @param {SolidML.ColorHSBA} c color to multiply
   *  @return {SolidML.ColorHSBA} this instance
   */
  multiply(c) { 
    this.cp = null;
    this.h += c.h;
    this.s *= c.s;
    this.b *= c.b;
    this.a *= c.a;
    return this;
  }
  /** blend color with another SolidML.ColorHSBA 
   *  @param {SolidML.ColorHSBA} dst color to blend with
   *  @param {number} ratio blending ratio
   *  @return {SolidML.ColorHSBA} this instance
   */
  blend(dst, ratio) {
    this.cp = null; 
  	if (this.s > 0) {
	    let hdif = (dst.s == 0) ? 0 : dst.h - this.h;
	    hdif += (hdif<-180) ? 360 : ((hdif>180) ? -360 : 0);
	    this.h += hdif * ratio.h * dst.a;
  	} else 
  	  this.h = dst.h;
    this.s += (dst.s-this.s)*ratio.s*dst.a;
    this.b += (dst.b-this.b)*ratio.b*dst.a;
    return this;
  }
  /** set color by {r,g,b}
   *  @param {object} col object that has keys {r, g, b}
   *  @return {SolidML.ColorHSBA} this instance
   */
  setRGB(col) {
    const min = (col.g<=col.r)?((col.b<=col.g)?col.b:col.g):((col.b<=col.r)?col.b:col.r),
          max = (col.g>=col.r)?((col.b>=col.g)?col.b:col.g):((col.b>=col.r)?col.b:col.r);
    this.h = max-min;
    this.s = max?(this.h/max):0;
    this.b = max;
    if (this.h > 0) {
      if (max == col.r) 
        this.h = 60 * (col.g-col.b)/this.h + ((col.g>=col.b)?0:360);
      else if (max == col.g) 
        this.h = 60 * (col.b-col.r)/this.h + 120;
      else if (max == col.b) 
        this.h = 60 * (col.r-col.g)/this.h + 240;
    }
    return this;
  }
  /** set color by "#HEX" string
   *  @param {string} hexString color string stating with "#" and 3 or 6 hex.
   *  @return {SolidML.ColorHSBA} this instance
   */
  setHex(hexString) {
    const dig6 = (hexString.length > 6), 
          m = hexString.match(dig6 ? /#(..)(..)(..)/ : /#(.)(.)(.)/) || ["#fff"], 
          scale = dig6 ? 255 : 15;
    this.setRGB({r:parseInt(m[1],16)/scale, g:parseInt(m[2],16)/scale, b:parseInt(m[3],16)/scale});
    return this;
  }
  /** set random color generator 
   *  @param {SolidML.ColorPool} colorpoolInstance colorpool instance to generate random color
   */
  setColorPool(colorpoolInstance) {
    this.cp = colorpoolInstance;
    return this;
  }
  /** get color as {r,g,b,a}
   *  @return {object} object has keys {r,g,b,a}.
   */
  getRGBA() {
    if (this.cp) 
    	return this.cp.getRGBA();
    const hp = (this.h - Math.floor(this.h/360)*360) / 60, 
          c  = this.b * this.s, 
          x  = c * (1 - Math.abs(hp%2-1)), 
          m  = this.b - c, 
          a  = this.a;
    return (hp<1) ? {r:c+m,g:x+m,b:m,a} : (hp<2) ? {r:x+m,g:c+m,b:m,a} : (hp<3) ? {r:m,g:c+m,b:x+m,a} : 
           (hp<4) ? {r:m,g:x+m,b:c+m,a} : (hp<5) ? {r:x+m,g:m,b:c+m,a} : {r:c+m,g:m,b:x+m,a};
  }
  _incrementRandMT() {
  	if (this.cp) 
      this.cp._incrementRandMT();
  }
  _fillArray(dst, startat, count) {
    const col = this.getRGBA();
    for (let index=startat*4, c=0; c<count; c++) {
      dst[index++] = col.r;
      dst[index++] = col.g;
      dst[index++] = col.b;
      dst[index++] = col.a;
    }
  }
}
/** Represents various status while building structure, passed by the callback of {@link SolidML#build} */
SolidML.BuildStatus = class {
  /** [SHOULD NOT CREATE new instance] SolidML.BuildStatus instance is created by {@link SolidML}  */
  constructor(funcNewObject) {
    /** matrix to transform the object. convert for three.js by pass this to THREE.Matrix4.copy(). this instance has been updated in the building computation. Use {@link SolidML.Matrix4#clone} to remember and reuse the status.
     *  @type {SolidML.Matrix4}
     */
    this.matrix = new SolidML.Matrix4();
    /** color for the object. get RGBA values by {@link SolidML.ColorHSBA#getRGBA}. this instance has been updated in the building computation. Use {@link SolidML.ColorHSBA#clone} to remember and reuse the status.
     *  @type {SolidML.ColorHSBA}
     */
    this.color  = new SolidML.ColorHSBA(0,1,1,1);
    /** name of the object
     *  @type {string}
     */
    this.label = null;
    /** Array of options of the object written as "name:option"
     *  @type {string}
     */
    this.option = null;
    /** parameters of the object written as "name[param]"
     *  @type {string}
     */
    this.param = null;
    /** increment when the rule is called. used in composing contnuous mesh
     *  @type {int}
     */
    this.referenceID = 0;
    /** current object count
     *  @type {int}
     */
    this.objectCount = 0;
    /** parent rule's last called contnuous mesh ("mesh", "cmesh", "tube" and "ctube")
     *  @type {SolidML.BuildStatus}
     */
    this.lastContinuousMesh = null;
    /** current rule
     *  @type {SolidML.Rule}
     */
    this.rule = null;
    /** return value of {@link SolidML#build}
     *  @type {object}
     */
    this.result = null;
    // private
    this._stacMatrix = [];
    this._stacRule = [];
    this._referCounter = 0;
    this._continuousMesh = null;
    this._ruleDepth = {};
    this._rule_min3 = 0;
    this._rule_max3 = 0;
    this._newObjectStatus = true;
    this._funcNewObject = funcNewObject;
  }
  /** create new Object including clones of current status
   *  @return {Object} typeof {matrix, color, label, option, param, referenceID, objectCount}. rule, lastContinuousMesh and result are not cloned. 
   */
  reference() {
    return {"matrix": this.matrix.clone(),
            "color":  this.color.clone(),
            "label":  this.label,
            "option": this.option,
            "param":  this.param,
            "referenceID" : this.referenceID,
            "objectCount" : this.objectCount};
  }
  /** call this method to stop building immediately */
  stopBuilding() {
    this._newObjectStatus = false;
  }
  _push() {
    this._stacMatrix.push({"matrix":this.matrix.clone(), "color":this.color.clone()});
  }
  _pop() {
    const copyFrom = this._stacMatrix.pop();
    this.matrix.copy(copyFrom.matrix);
    this.color.copy(copyFrom.color);
  }
  _pushRule(rule) {
    if (++this._referCounter > 1)
      this.referenceID++;
    this._stacRule.push({
      "rule": this.rule, 
      "referCounter": this._referCounter, 
      "continuousMesh": this._continuousMesh
    });
    this.rule = rule;
    this._referCounter = 0;
    this.lastContinuousMesh = this._continuousMesh;
    this._continuousMesh = null;
    if (!(rule.name in this._ruleDepth))
      this._ruleDepth[rule.name] = 0;
    let imin = this.rule.minsize,
        imax = this.rule.maxsize;
    this._rule_min3 = imin * imin * imin;
    this._rule_max3 = imax * imax * imax;
    return (++this._ruleDepth[rule.name] <= rule.maxdepth);
  }
  _popRule() {
    this._ruleDepth[this.rule.name]--;
    const refCall = this._stacRule.pop();
    this.rule = refCall.rule;
    this._referCounter = refCall.referCounter;
    this._continuousMesh = refCall.continuousMesh;
    this.lastContinuousMesh = (this._stacRule.length > 0) ? this._stacRule[this._stacRule.length-1].continuousMesh : null;
  }
  _newObject(reference) {
    if (!this._checkCriteria())
      return false;
    this.label = reference.label;
    this.param = reference.param;
    this.option = reference.option;
    if (this.label in SolidML.ScriptParser._continuousMeshLabel) 
      this._continuousMesh = this.reference();
    this.objectCount++;
    this._funcNewObject(this);
    return this._newObjectStatus;
  }
  _checkCriteria() {
    const det3 = this.matrix.det3();
    return (this.objectCount < this.rule.rootInstance.criteria.maxobjects && this._rule_min3 < det3 && det3 < this._rule_max3);
  }
}
/** Represents rules in Eisen Script.  */
SolidML.Rule = class {
  /** [SHOULD NOT CREATE new instance] SolidML.Rule is create by {@link SolidML} */
  constructor(rootInstance, parentRule, name, option) {
    /** name of this rule. "$root" is set for top most rule 
     *  @type {string}
     */
    this.name = name || "$root";
    /** weight value of the rule set by weight option in Eisen Script. default is 1
     *  @type {number}
     */
    this.weight = 1;
    /** maxdepth value of the rule set by maxdepth option in Eisen Script. default is same as the {@link Criteria.maxdepth}
     *  @type {number}
     */
    this.maxdepth = rootInstance.criteria.maxdepth;
    /** termination rule name set by ">" option in Eisen Script. default is null
     *  @type {string}
     */
    this.maxdepthLabel = null;
    /** parent rule. null for top most rule
     *  @type {SolidML.Rule}
     */
    this.parent = parentRule;
    // private
    this._minsize = null;
    this._maxsize = null;
    this._colorpoolInstance = null;
    this.rootInstance = rootInstance;
    this.childRules = {};
    this.sequence = new SolidML.Reference(null, null);
    this._parser = new SolidML.ScriptParser(this);
    if (option) this._parser.ruleOption(option);
  }
  /** [read only] minimum size for this rule. 
   *  @type {number}
   */
  get minsize() {
    return this._minsize || (this.parent) ? this.parent.minsize : this.rootInstance.criteria.minsize;
  }
  /** [read only] maximum size for this rule. 
   *  @type {number}
   */
  get maxsize() {
    return this._maxsize || (this.parent) ? this.parent.maxsize : this.rootInstance.criteria.maxsize;
  }
  /** [read only] colorpool instance for this rule. 
   *  @type {SolidML.ColorPool}
   */
  get colorpoolInstance() {
    return this._colorpoolInstance || (this.parent) ? this.parent.colorpoolInstance : this.rootInstance.criteria._colorpoolInstance;
  }
  /** @return Returns true when there are no operation inside */
  isEmpty() {
    return (!this.sequence.next);
  }
  /** search rules by label
   *  @param {string} label label to search. search child rules first, then search ancestor rules.
   *  @return {SolidML.Rule} returns rule insatnce found by the label
   */
  find(label) {
    if (label in this.childRules) {
      const list = this.childRules[label],
            total = list.reduce((acm, rule)=>acm+rule.weight, 0),
            randnum = this.rootInstance.randMT.next() * total;
      for (let i=0, acm=0; i<list.length; i++) {
        acm += list[i].weight;
        if (randnum < acm) 
          return list[i];
      }
      return list[list.length-1];
    }
    return this.parent && this.parent.find(label);
  }
  _appendChild(rule) {
    if (!(rule.name in this.childRules)) this.childRules[rule.name] = [];
    this.childRules[rule.name].push(rule);
    return rule
  }
  _parse(script, lastIndex) {
    return this._parser.parse(script, lastIndex);
  }
  _build(stat) {
    if (this.isEmpty())
      return stat;
    if (stat._pushRule(this)) {
      let operator = this.sequence.next;
      while (operator) 
        operator = operator._build(stat);
    }
    else if (this.maxdepthLabel) {
      const rule = this.find(this.maxdepthLabel);
      if (rule) 
        rule._build(stat);
      else 
        throw Error("label [" + this.maxdepthLabel + "] not found in rule " + this.name);
    }
    stat._popRule();
    return stat;
  }
}
// private 
SolidML.Reference = class {
  constructor(prev, label, param) {
    if (prev) prev.next = this;
    if (label) {
      const s = label.split(":");
      this.label = s.shift();
      this.option = (s.length>0) ? s[0] : null;
    } else {
      this.label = null;
      this.option = null;
    }
    this.param = param;
    this.next = null;
  }
  _build(stat) {
    const rule = stat.rule.find(this.label);
    if (rule) {
      if (++stat._ruleDepth[rule.parent.name] <= rule.parent.maxdepth) 
        rule._build(stat);
      stat._ruleDepth[rule.parent.name]--;
    } else 
      if (!stat._newObject(this)) 
        return null;
    return this.next;
  }
}
// private 
SolidML.Operator = class {
  constructor(rule, prev, repeat, opeString) {
    this.parentRule = rule;
    this.repeat = Number(repeat) || 1;
    prev.next = this;
    this.next = null;
    this.opeString = null;
    this._parse(opeString);
  }
  clear() {
    this.matrix = new SolidML.Matrix4();
    this.color = null;
    this.dcolor = null;
    this.blend = new SolidML.ColorHSBA(0,1,1,0);
    this.ratio = new SolidML.ColorHSBA(0,0,0,0);
  }
  _hasVariable() {
    return Boolean(this.opeString);
  }
  _build(stat) {
    if (this._hasVariable()) 
      this._parse(this.opeString);
    let reference_next = null;
    stat._push();
    for (let i=this.repeat; i>0; i--) {
      stat.matrix.multiply(this.matrix);
      if (this.color) 
        stat.color.copy(this.color);
      if (this.dcolor)
        stat.color.multiply(this.dcolor);
      if (this.blend.a) 
        stat.color.blend(this.blend, this.ratio);
      if (this.next)
        reference_next = this.next._build(stat);
    }
    stat._pop();
    return reference_next;
  }
  _parse(opeString) {
    let m;
    const mat = new SolidML.Matrix4();
    const rex = SolidML.ScriptParser.operatorRex;
    const getNumber = (failThrough=false)=>{
      const li = rex.lastIndex, m = rex.exec(opeString);
      if (m) {
        if (m[2]) 
          return Number(m[2]);
        if (m[5]) {
          this.opeString = opeString;
          return this.parentRule.rootInstance.variables[m[5]] || 0;
        } 
      }
      if (!failThrough) 
        throw Error("parameter not defined : "+opeString);
      rex.lastIndex = li;
      return null; 
    };
    const getColor = (failThrough=false)=>{
      const li = rex.lastIndex, m = rex.exec(opeString);
      if (!m)
        throw Error("color not defined : "+opeString);
      if (m[1] in SolidML.ColorTable)
        return SolidML.ColorTable[m[1]];
      if (m[3])
        return m[3];
      if (m[5]) {
        this.opeString = opeString;
        return this.parentRule.rootInstance.variables[m[5]] || "#000";
      } 
      if (!failThrough)
        throw Error("color not defined : "+opeString);
      rex.lastIndex = li;
      return null;
    };
    this.clear();
    
    while (m = rex.exec(opeString)) {
      // direct color name
      if (m[1] in SolidML.ColorTable)
        this.color = new SolidML.ColorHSBA().setHex(SolidML.ColorTable[m[1]]);
      // direct color hex
      else if (m[3])
        this.color = new SolidML.ColorHSBA().setHex(m[3]);
      // blending by "*" command
      else if (m[4]) { 
        const nextColor = getColor(true);
        if (nextColor) {
          this.blend.setHex(nextColor);
          this.blend.a = getNumber();
          this.ratio.set(1,1,1,1);
        } else {
          m = rex.exec(opeString);
          switch (m[1]) {
            case "h":
              this.blend.a = 1;
              this.blend.h = getNumber();
              this.ratio.h = getNumber();
              break;
            case "s": 
              this.blend.a = 1;
              this.blend.s = getNumber();
              this.ratio.s = getNumber();
              break;
            case "b": 
              this.blend.a = 1;
              this.blend.b = getNumber();
              this.ratio.b = getNumber();
              break;
            default:
              throw Error("syntax error: " + opeString);
          }
        }
      } else {
        switch(m[1]) {
          case "hue":case "h":
            this.dcolor = this.dcolor || new SolidML.ColorHSBA(0,1,1,1);
            this.dcolor.h = getNumber();
            break;
          case "sat":
            this.dcolor = this.dcolor || new SolidML.ColorHSBA(0,1,1,1);
            this.dcolor.s = getNumber();
            break;
          case "brightness": case "b":
            this.dcolor = this.dcolor || new SolidML.ColorHSBA(0,1,1,1);
            this.dcolor.b = getNumber();
            break;
          case "alpha": case "a":
            this.dcolor = this.dcolor || new SolidML.ColorHSBA(0,1,1,1);
            this.dcolor.a = getNumber();
            break;
          case "blend":
            this.blend.setHex(getColor());
            this.blend.a = getNumber();
            this.ratio.set(1,1,1,1);
            break;
          case "color":
            const nextColor = getColor(true);
            if (nextColor)
              this.color = new SolidML.ColorHSBA().setHex(nextColor);
            else {
              m = rex.exec(opeString);
              if (m[1] == 'random')
                this.color = new SolidML.ColorHSBA().setColorPool(this.parentRule.colorpoolInstance);
              else
                throw Error("cannot parse : " + m[0]);
            }
            break;
          case "random": case "#?":
            this.color = new SolidML.ColorHSBA().setColorPool(this.parentRule.colorpoolInstance);
            break;
          case "x":
            this.matrix.multiply(mat.makeTranslation(getNumber(),0,0));
            break;
          case "y":
            this.matrix.multiply(mat.makeTranslation(0,getNumber(),0));
            break;
          case "z":
            this.matrix.multiply(mat.makeTranslation(0,0,getNumber()));
            break;
          case "rx":
            this.matrix.multiply(mat.makeRotationX(getNumber()/180*Math.PI));
            break;
          case "ry":
            this.matrix.multiply(mat.makeRotationY(getNumber()/180*Math.PI));
            break;
          case "rz":
            this.matrix.multiply(mat.makeRotationZ(getNumber()/180*Math.PI));
            break;
          case "fx":
            this.matrix.multiply(mat.makeScale(-1,1,1));
            break;
          case "fy":
            this.matrix.multiply(mat.makeScale(1,-1,1));
            break;
          case "fz":
            this.matrix.multiply(mat.makeScale(1,1,-1));
            break;
          case "s":
            const sx = getNumber();
            this.matrix.multiply(mat.makeScale(sx,getNumber(true)||sx,getNumber(true)||sx));
            break;
          case "m":
            mat.fromArray([
              getNumber(),getNumber(),getNumber(),0,
              getNumber(),getNumber(),getNumber(),0,
              getNumber(),getNumber(),getNumber(),0,
              0,0,0,1]);
            this.matrix.multiply(mat);
            break;
          default:
            throw Error("cannot parse : " + m[0]);
        }
      }
    }
  }
}
/** Represents colorpool in Eisen Script. */
SolidML.ColorPool = class {
  /**
   * create colorpool by scheme string
   * @param  {string} scheme scheme string of colorpool command
   * @param  {SolidML.randMT} randMT number generator for random picking
   */
  constructor(scheme, randMT) {
    this._randMT = randMT;
    this._dice = new SolidML.ColorHSBA();
    this.scheme = scheme;
  }
  /** 
   *  colorpool scheme, specifyed by "set colorpool " command 
   *  @type {string}
   */
  get scheme() {
    return this._schemeString;
  }
  set scheme(schemeString) {
    this._schemeString = schemeString;
    const match = /^\[(.*?)\]$/.exec(schemeString);
    if (match) {
      this._scheme = "list";
      this._option = match[1];
    } else { 
      const str = schemeString.split(":");
      this._scheme = str[0];
      this._option = str[1];
    }
    const step = Number(this._option) || 0;
    switch(this._scheme) {
      case "list":
        this.colorList = this._option.split(/\s*,\s*/).map(c=>this._dice.setHex(SolidML.ColorTable[c] || c).getRGBA());
        break;
      case "randomhue":
        if (step > 0) {
          this.colorList = [];
          for (let i=0; i<step; i++)
            this.colorList.push(this._dice.set(i/step*360, 1, 1, 1).getRGBA());
        }
        break;
      case "grayscale":
        if (step > 0) {
          this.colorList = [];
          for (let i=0; i<step; i++) {
            const v = i/(step-1);
            this.colorList.push({r:v, g:v, b:v, a:1});
          }
        }
        break;
      default:
        this.colorList = null;
        break;
    }
  }
  /**
   * get RGBA color value
   * @return {object} object that has {r, g, b, a} 
   */
  getRGBA() {
    const num = this._randMT.next();
    if (this.colorList)
      return this.colorList[(num * this.colorList.length)>>0];
    if (this._scheme == "randomhue")
      return this._dice.set(num*360, 1, 1, 1).getRGBA();
    if (this._scheme == "grayscale")
      return {r:num, g:num, b:num, a:1};
    return {r:num, g:this._randMT.next(), b:this._randMT.next(), a:1};
  }
  _incrementRandMT() {
    this._randMT.next();
    if (!this.colorList && this._scheme != "randomhue" && this._scheme != "grayscale") {
      this._randMT.next();
      this._randMT.next();
    }
  }
}
/** Mersenne Twister random number generator */
SolidML.randMT = class {
  /** constructor. {@link SolidML.randMT} is used for the model construction.
   *  @param {number} [seed] seed for random numbers list
   */
  constructor(seed=null) {
    this._mt = new Uint32Array(624);
    this.seed = seed;
  }
  /** seed for random number table. null to use Date.getTime() inside.
   *  @type {int} 
   */
  get seed() {
    return this._seed;
  }
  set seed(s) {
    if (s === null)
      s = new Date().getTime();
    this._seed = s;
    this._mt[0] = s>>>0;
    for (let i=1; i<this._mt.length; i++) 
      this._mt[i] = 1812433253 * (this._mt[i-1] ^ (this._mt[i-1] >>> 30)) + i;
    this._index = this._mt.length;
  }
  _nextInt() {
    const mt = this._mt;
    let v;
    if (this._index >= mt.length) {
      let k = 0, N = mt.length, M = 397;
      do {
        v = (mt[k] & 0x80000000) | (mt[k+1] & 0x7fffffff);
        mt[k] = mt[k+M] ^ (v >>> 1) ^ ((v & 1) ? 0x9908b0df : 0);
      } while (++k < N-M);
      do {
        v = (mt[k] & 0x80000000) | (mt[k+1] & 0x7fffffff);
        mt[k] = mt[k+M-N] ^ (v >>> 1) ^ ((v & 1) ? 0x9908b0df : 0);
      } while (++k < N-1);
      v = (mt[N-1] & 0x80000000) | (mt[0] & 0x7fffffff);
      mt[N-1] = mt[M-1] ^ (v >>> 1) ^ ((v & 1) ? 0x9908b0df : 0);
      this._index = 0;
    }
    v = mt[this._index++];
    v ^= v >>> 11;
    v ^= (v << 7) & 0x9d2c5680;
    v ^= (v << 15) & 0xefc60000;
    v ^= v >>> 18;
    return v >>> 0;
  }
  /** @return {Number} Returns random number and increment pointer for random number table */
  next() {
    return ((this._nextInt() >>> 5) * 0x4000000 + (this._nextInt() >>> 6)) / 0x20000000000000; 
  }
}
// [private] script parser
SolidML.ScriptParser = class {
  static _initialize() {
    if (!SolidML.ScriptParser.ruleRexString) {
      SolidML.ScriptParser._continuousMeshLabel = {"mesh":true, "cmesh":true, "tube":true, "ctube":true};
      SolidML.ScriptParser.nameRexString = "([a-zA-Z_][a-zA-Z0-9_:]*)";
      SolidML.ScriptParser.defineRexString = "(#define|\\$)\\s*([a-zA-Z_]+)[\\s=]*([^\\s]+)";
      SolidML.ScriptParser.criteriaRexString = "(set|@)\\s*([a-z:]*)\\s*([a-z:,]+|[\\-\\d.]+|#[0-9a-fA-F]+|\\[.+?\\])";
      SolidML.ScriptParser.ruleDefineRexString = "(rule|#)\\s*" + SolidML.ScriptParser.nameRexString + "(.*?){";
      SolidML.ScriptParser.matRexString = "(((\\d+)[\\s*]*)?\\{(.+?)\\})";
      SolidML.ScriptParser.referenceParamRexString = "(\\[(.+?)\\])?";
      SolidML.ScriptParser.ruleRexString = [
        SolidML.ScriptParser.defineRexString,
        SolidML.ScriptParser.criteriaRexString, 
        SolidML.ScriptParser.ruleDefineRexString, 
        SolidML.ScriptParser.matRexString, 
        SolidML.ScriptParser.nameRexString+SolidML.ScriptParser.referenceParamRexString, 
        "(})"
      ].join("|");
      SolidML.ScriptParser.ruleOptionRex = new RegExp("([a-z@]+)\\s*([\\-\\d.]+)|>\\s*" + SolidML.ScriptParser.nameRexString, "gm");
      SolidML.ScriptParser.operatorRex   = new RegExp("([a-z]+|#\\?)|([\\-\\d.]+)|(#[0-9a-fA-F]+)|(\\*)|\\$" + SolidML.ScriptParser.nameRexString, "gm");
      SolidML.REX_DEFINE = 1;
      SolidML.REX_DEFINE_KEY = 2;
      SolidML.REX_DEFINE_VALUE = 3;
      SolidML.REX_CRITERIA = 4;
      SolidML.REX_CRITERIA_CMD = 5;
      SolidML.REX_CRITERIA_PARAM = 6;
      SolidML.REX_RULEDEF = 7;
      SolidML.REX_RULEDEF_LABEL = 8;
      SolidML.REX_RULEDEF_OPTION = 9;
      SolidML.REX_MATRIX = 10;
      SolidML.REX_MATRIX_REPEAT = 12;
      SolidML.REX_MATRIX_OPERATOR = 13;
      SolidML.REX_REFERENCE = 14;
      SolidML.REX_REFERENCE_PARAM = 16;
      SolidML.REX_RULE_END = 17;
    }
  }
  // defined key reference change into "$key" and comment out
  static _normalizeScript(script) {
    let $, $$, ruleIndices=null;
    // remove all comments
    script = script.replace(/\/\/.*?$|\/\*[\s\S]*?\*\//gm, ' ');
    // insert "$" before defined variables
    const rexDefine = /#define\s+([a-zA-Z_]+)/gm;
    while ($ = rexDefine.exec(script)) {
      const rexReplace = new RegExp($[1], "gm");
      script = script.replace(rexReplace, (match, offset, string)=>{
        return (offset < rexDefine.lastIndex || string[offset-1] == "$") ? match : "$"+ match;
      });
    }
    // split rule includes "(A|B)" command
    const rexRuleSplit = /\(([\s\S]*?)\)/gm, 
          rexWeight = /(@w|w|weight)([\d.]+)/,
          mapWeight = s=>{
            const wmatch = s.match(rexWeight), 
                  w = (wmatch) ? parseFloat(wmatch[2]) : 1;
            return {s:" "+s.replace(rexWeight, "")+" ", w};
          };
    // seek "(A|B)"
    while ($ = rexRuleSplit.exec(script)) {
      // list of rule definitions indices sorted from end
      ruleIndices = [];
      const rex = new RegExp(SolidML.ScriptParser.ruleDefineRexString, "gm");
      while ($$ = rex.exec(script))
        ruleIndices.unshift($$);
      // split "A|B" into ["A","B"]
      const branch = $[1].split("|").map(mapWeight);
      // seek rule includes "(A|B)"
      const $ruleStart = ruleIndices.find((e,i,a)=>(e.index < $.index));
      if ($ruleStart) {
        const ruleDefine = $ruleStart[1] + $ruleStart[2],
              ruleOption = mapWeight($ruleStart[3]);
        // seek sequence start "{"
        const rex = /[{}]/gm;
        rex.lastIndex = $ruleStart.index;
        $$ = rex.exec(script);
        if ($$ && $$[0] == "{") {
          const sequenceStart = $$.index;
          // seek sequence end "}"
          let depth = 1;
          while ($$ = rex.exec(script)) 
            if ((depth += ($$[0] == "{") ? 1 : -1) == 0) break;
          if ($$) {
            // construct new rules
            const scriptBefore   = script.substring(0, $ruleStart.index),
                  scriptSequence = script.substring(sequenceStart, $$.index+1),
                  scriptAfter    = script.substring($$.index+1);
            const newRules = branch.map(b=>{
              const newSequence = scriptSequence.replace($[0], b.s),
                    newRuleOption = ruleOption.s + "@w" + String(ruleOption.w * b.w);
              return ruleDefine + newRuleOption + newSequence;
            }).join("\n");
            script = scriptBefore + newRules + scriptAfter;
            rexRuleSplit.lastIndex = $ruleStart.index;
          }
        }
      }
    }
    console.log("final rules : \n"+script);
    return script;
  }
  constructor(rule) {
    this._rule = rule;
  }
  ruleOption(option) {
    let m;
    while (m = SolidML.ScriptParser.ruleOptionRex.exec(option)) {
      switch(m[1]) {
        case "weight": case "w": case "@w":
          this._rule.weight = Number(m[2]);
          break;
        case "maxdepth": case "md": case "@":
          this._rule.maxdepth = Number(m[2]);
          break;
        default:
          this._rule.maxdepthLabel = m[3];
          break;
      }
    }
  }
  parse(script, lastIndex) {
    this._init(script, lastIndex);
    while (this._exec()) {
      if (!this._definition()) 
        if (!this._criteria()) 
          if (!this._matrix()) 
            if (!this._reference())
              if (!this._ruleStart()) 
                if (this._ruleEnd()) 
                  break;
                else 
                  throw Error("syntax error: "+this.$[0]);
    }
    return this._regExp.lastIndex;
  }
  _init(script, lastIndex) {
    this._regExp = new RegExp(SolidML.ScriptParser.ruleRexString, "gm");
    this._regExp.lastIndex = lastIndex;
    this._script = script;
    this._tail = this._rule.sequence;
    this.$ = null;
    return this;
  }
  _exec() {
    this.$ = this._regExp.exec(this._script);
    return Boolean(this.$);
  }
  _definition() {
    if (!this.$[SolidML.REX_DEFINE])
      return false;
    const key = this.$[SolidML.REX_DEFINE_KEY],
          value = this.$[SolidML.REX_DEFINE_VALUE],
          numv  = Number(value);
    this._rule.rootInstance.variables[key] = isNaN(numv) ? value : numv;
    return true;
  }
  _criteria() {
    if (!this.$[SolidML.REX_CRITERIA])
      return false;
    const criteria = this.$[SolidML.REX_CRITERIA_CMD],
          param = this.$[SolidML.REX_CRITERIA_PARAM];
    this._rule.rootInstance.criteria._set(criteria, param);
    return true;
  }
  _ruleStart() {
    if (!this.$[SolidML.REX_RULEDEF]) 
      return false;
    const label  = this.$[SolidML.REX_RULEDEF_LABEL],
          option = this.$[SolidML.REX_RULEDEF_OPTION],
          rule = new SolidML.Rule(this._rule.rootInstance, this._rule, label, option);
    this._rule._appendChild(rule);
    this._regExp.lastIndex = rule._parse(this._script, this._regExp.lastIndex);
    return true;
  }
  _matrix() {
    if (!this.$[SolidML.REX_MATRIX]) 
      return false;
    const repeat = this.$[SolidML.REX_MATRIX_REPEAT],
          operator = this.$[SolidML.REX_MATRIX_OPERATOR];
    this._tail = new SolidML.Operator(this._rule, this._tail, repeat, operator);
    return true;
  }
  _reference() {
    if (!this.$[SolidML.REX_REFERENCE])
      return false;
    const label = this.$[SolidML.REX_REFERENCE],
          param = this.$[SolidML.REX_REFERENCE_PARAM];
    this._tail = new SolidML.Reference(this._tail, label, param);
    return true;
  }
  _ruleEnd() {
    return Boolean(this.$[SolidML.REX_RULE_END]);
  }
}
/** svg name table for colors. SolidML.ColorTable["name"] returns hex string of the color.
 *  @type {Object}
 */
SolidML.ColorTable = {
  "black": "#000000",
  "navy": "#000080",
  "darkblue": "#00008b",
  "mediumblue": "#0000cd",
  "blue": "#0000ff",
  "darkgreen": "#006400",
  "green": "#008000",
  "teal": "#008080",
  "darkcyan": "#008b8b",
  "deepskyblue": "#00bfff",
  "darkturquoise": "#00ced1",
  "mediumspringgreen": "#00fa9a",
  "lime": "#00ff00",
  "springgreen": "#00ff7f",
  "cyan": "#00ffff",
  "aqua": "#00ffff",
  "midnightblue": "#191970",
  "dodgerblue": "#1e90ff",
  "lightseagreen": "#20b2aa",
  "forestgreen": "#228b22",
  "seagreen": "#2e8b57",
  "darkslategray": "#2f4f4f",
  "darkslategrey": "#2f4f4f",
  "limegreen": "#32cd32",
  "mediumseagreen": "#3cb371",
  "turquoise": "#40e0d0",
  "royalblue": "#4169e1",
  "steelblue": "#4682b4",
  "darkslateblue": "#483d8b",
  "mediumturquoise": "#48d1cc",
  "indigo": "#4b0082",
  "darkolivegreen": "#556b2f",
  "cadetblue": "#5f9ea0",
  "cornflowerblue": "#6495ed",
  "mediumaquamarine": "#66cdaa",
  "dimgrey": "#696969",
  "dimgray": "#696969",
  "slateblue": "#6a5acd",
  "olivedrab": "#6b8e23",
  "slategrey": "#708090",
  "slategray": "#708090",
  "lightslategray": "#778899",
  "lightslategrey": "#778899",
  "mediumslateblue": "#7b68ee",
  "lawngreen": "#7cfc00",
  "chartreuse": "#7fff00",
  "aquamarine": "#7fffd4",
  "maroon": "#800000",
  "purple": "#800080",
  "olive": "#808000",
  "gray": "#808080",
  "grey": "#808080",
  "skyblue": "#87ceeb",
  "lightskyblue": "#87cefa",
  "blueviolet": "#8a2be2",
  "darkred": "#8b0000",
  "darkmagenta": "#8b008b",
  "saddlebrown": "#8b4513",
  "darkseagreen": "#8fbc8f",
  "lightgreen": "#90ee90",
  "mediumpurple": "#9370db",
  "darkviolet": "#9400d3",
  "palegreen": "#98fb98",
  "darkorchid": "#9932cc",
  "yellowgreen": "#9acd32",
  "sienna": "#a0522d",
  "brown": "#a52a2a",
  "darkgray": "#a9a9a9",
  "darkgrey": "#a9a9a9",
  "lightblue": "#add8e6",
  "greenyellow": "#adff2f",
  "paleturquoise": "#afeeee",
  "lightsteelblue": "#b0c4de",
  "powderblue": "#b0e0e6",
  "firebrick": "#b22222",
  "darkgoldenrod": "#b8860b",
  "mediumorchid": "#ba55d3",
  "rosybrown": "#bc8f8f",
  "darkkhaki": "#bdb76b",
  "silver": "#c0c0c0",
  "mediumvioletred": "#c71585",
  "indianred": "#cd5c5c",
  "peru": "#cd853f",
  "chocolate": "#d2691e",
  "tan": "#d2b48c",
  "lightgray": "#d3d3d3",
  "lightgrey": "#d3d3d3",
  "thistle": "#d8bfd8",
  "orchid": "#da70d6",
  "goldenrod": "#daa520",
  "palevioletred": "#db7093",
  "crimson": "#dc143c",
  "gainsboro": "#dcdcdc",
  "plum": "#dda0dd",
  "burlywood": "#deb887",
  "lightcyan": "#e0ffff",
  "lavender": "#e6e6fa",
  "darksalmon": "#e9967a",
  "violet": "#ee82ee",
  "palegoldenrod": "#eee8aa",
  "lightcoral": "#f08080",
  "khaki": "#f0e68c",
  "aliceblue": "#f0f8ff",
  "honeydew": "#f0fff0",
  "azure": "#f0ffff",
  "sandybrown": "#f4a460",
  "wheat": "#f5deb3",
  "beige": "#f5f5dc",
  "whitesmoke": "#f5f5f5",
  "mintcream": "#f5fffa",
  "ghostwhite": "#f8f8ff",
  "salmon": "#fa8072",
  "antiquewhite": "#faebd7",
  "linen": "#faf0e6",
  "lightgoldenrodyellow": "#fafad2",
  "oldlace": "#fdf5e6",
  "red": "#ff0000",
  "fuchsia": "#ff00ff",
  "magenta": "#ff00ff",
  "deeppink": "#ff1493",
  "orangered": "#ff4500",
  "tomato": "#ff6347",
  "hotpink": "#ff69b4",
  "coral": "#ff7f50",
  "darkorange": "#ff8c00",
  "lightsalmon": "#ffa07a",
  "orange": "#ffa500",
  "lightpink": "#ffb6c1",
  "pink": "#ffc0cb",
  "gold": "#ffd700",
  "peachpuff": "#ffdab9",
  "navajowhite": "#ffdead",
  "moccasin": "#ffe4b5",
  "bisque": "#ffe4c4",
  "mistyrose": "#ffe4e1",
  "blanchedalmond": "#ffebcd",
  "papayawhip": "#ffefd5",
  "lavenderblush": "#fff0f5",
  "seashell": "#fff5ee",
  "cornsilk": "#fff8dc",
  "lemonchiffon": "#fffacd",
  "floralwhite": "#fffaf0",
  "snow": "#fffafa",
  "yellow": "#ffff00",
  "lightyellow": "#ffffe0",
  "ivory": "#fffff0",
  "white": "#ffffff"
};
