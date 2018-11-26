/** Simple Structure Synth (Eisen script) parser 
 *  @file all in one file 
 */
class SolidML {
  /** Basically one instance for one script. 
   *  @param {string} [eisenScript] Eisen Script to compile, calls {@link SolidML#compile} inside.
   *  @param {object} [criteria] default criteria of this structure, specified by "set *" commands in script.
   */
  constructor(eisenScript, criteria) {
    /** criteria of this structure, specified by "set *" commands in script
     *  @type {object}
     */
    this.criteria = Object.assign({
      maxdepth : 10000,
      maxobjects : 100000,
      minsize : 0,
      maxsize : 100000,
      seed: null,
      background: "#000000",
      floor:"#000000",
      sky:"#000000",
      colorpool: "randomrgb"
    }, criteria);
    if (eisenScript) this.compile(eisenScript);
  }
  /** Parse Eisen Script, make a structure of recursive calls inside
   *  @param  {string} eisenScript script to compile
   *  @return {SolidML} this instance
   */
  compile(eisenScript) {
    this._root = new SolidML.Rule(this, null, null, null);
    this._root._parse(eisenScript.replace(/\/\/.*?$|\/\*.*?\*\//gm, ''), 0);
    return this;
  }
  /** Build object, call recursive functions made by {@link SolidML#compile}.
   *  @param {SolidML~buildCallback} [callback] function called back when new object has created.
   *  @return {any} returned value of callback. when callback is undefined, returns the array of {matrix:Matrix4, color:Color, label:String, param:String}for each objects.
   */
  build(callback) {
    if (!this._root)
      throw Error("SolidML.complie() should be called before calling SolidML.build()");
    if (!callback) {
      const objects = [];
      callback = stat=>{
        objects.push({"matrix": stat.matrix.clone(), 
                      "color":  stat.color.getRGBA(), 
                      "label":  stat.label, 
                      "param":  stat.param});
        return objects;
      };
    }
    SolidML.randMT.instance(this.criteria["seed"]);
    const status = this._root._build(new SolidML.BuildStatus(callback));
    return status.result;
  }
}
/** callback function passed to {@link SolidML#build}
 *  @callback SolidML~buildCallback
 *  @param {SolidML.BuildStatus} status the status while building structure
 *  @return {any} thr return value can be refered by {@link SolidML.BuildStatus.result}, or {@link SolidML#build}.
 */
/** represents 4dim-matrix compatible with THREE.Matrix4. */
SolidML.Matrix4 = class {
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
  det3() {
    const te = this.elements;
    return Math.abs(te[0]*te[5]*te[10] - te[0]* te[6]*te[9] - te[1]*te[4]*te[10] + te[1]* te[6]*te[8] + te[2]*te[4]* te[9] - te[2]*te[5]*te[8]);
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
}
/** represents color by (hue, saturation, brightness, alpha) */
SolidML.ColorHSBA = class {
  constructor() { this.h=0; this.s=0; this.b=0; this.a=0; this.cp=null; }
  set(h,s,b,a) { this.h=h; this.s=s; this.b=b; this.a=a; return this; }
  copy(c) { this.h=c.h; this.s=c.s; this.b=c.b; this.a=c.a; this.cp=c.cp; return this; }
  clone(c) { return new SolidML.ColorHSBA().copy(this); }
  multiply(c) { this.h += c.h; this.s *= c.s; this.b *= c.b; this.a *= c.a; return this; }
  blend(dst, ratio) {
  	if (this.s > 0) {
	    let hdif = (dst.s == 0) ? 0 : dst.h - this.h;
	    hdif += (hdif<-180) ? 360 : ((hdif>180) ? -360 : 0);
	    this.h += hdif*ratio.h*dst.a;
  	} else 
  	  this.h = dst.h;
    this.s += (dst.s-this.s)*ratio.s*dst.a;
    this.b += (dst.b-this.b)*ratio.b*dst.a;
    return this;
  }
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
  setHex(hex) {
    const dig6 = (hex.length > 6), 
          m = hex.match(dig6 ? /#(..)(..)(..)/:/#(.)(.)(.)/) || ["#fff"], 
          scale = dig6 ? 255 : 15;
    this.setRGB({r:parseInt(m[1],16)/scale, g:parseInt(m[2],16)/scale, b:parseInt(m[3],16)/scale});
    return this;
  }
  getRGBA() {
    if (this.cp) this._dice();
    const hp=(this.h-Math.floor(this.h/360)*360)/60, c=this.b*this.s, x=c*(1-Math.abs(hp%2-1)), m=this.b-c, a=this.a;
    return (hp<1) ? {r:c+m,g:x+m,b:m,a} : (hp<2) ? {r:x+m,g:c+m,b:m,a} :  (hp<3) ? {r:m,g:c+m,b:x+m,a} : 
           (hp<4) ? {r:m,g:x+m,b:c+m,a} : (hp<5) ? {r:x+m,g:m,b:c+m,a} : {r:c+m,g:m,b:x+m,a};
  }
  setRandom(scheme) {
    this.cp = (/^list:/.test(scheme)) ? scheme.replace(/^list:/, "").split(/,/) : scheme;
    return this;
  }
  _dice() {
    const rand = SolidML.randMT.instance();
    switch(this.cp) {
      case "randomrgb":
        this.setRGB({r:rand.next(), g:rand.next(), b:rand.next()});
        break;
      case "randomhue":
        this.set(rand.next()*360, 1, 1, 1);
        break;
      case "grayscale":
        this.set(0, 0, rand.next(), 1);
        break;
      default:
        if (this.cp.length) {
          const color = this.cp[(rand.next() * this.cp.length)>>0];
          this.setHex(SolidML.ColorTable[color] || color);
        }
        break;
    }
  }
}
/** [SHOULD NOT CREATE new instance] represents various status while building structure, passed by the callback of {@link SolidML#build} */
SolidML.BuildStatus = class {
  /** [SHOULD NOT CREATE new instance] SolidML.BuildStatus instance is created by {@link SolidML}  */
  constructor(funcNewObject) {
    /** matrix to transform the object 
     * @type {SolidML.Matrix4}
     */
    this.matrix = new SolidML.Matrix4();
    /** color for the object 
     * @type {SolidML.ColorHSBA}
     */
    this.color  = new SolidML.ColorHSBA().set(0,0,1,1);
    /** name of the object
     * @type {string}
     */
    this.label = null;
    /** parameters of the object written as "[...]"
     * @type {string}
     */
    this.param = null;
    /** current object count
     * @type {int}
     */
    this.objectCount = 0;
    /** current rule
     * @type {SolidML.Rule}
     */
    this.rule = null;
    /** return value of previous callback
     * @type {object}
     */
    this.result = null;
    // private
    this._stacMatrix = [];
    this._stacRule = [];
    this._ruleDepth = {};
    this._rule_min3 = 0;
    this._rule_max3 = 0;
    this._funcNewObject = funcNewObject;
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
    this._stacRule.push(this.rule);
    this.rule = rule;
    if (!(rule.ruleName in this._ruleDepth))
      this._ruleDepth[rule.ruleName] = 0;
    let imin = this.rule.minsize(),
        imax = this.rule.maxsize();
    this._rule_min3 = imin*imin*imin;
    this._rule_max3 = imax*imax*imax;
    return (++this._ruleDepth[rule.ruleName] <= rule.maxdepth);
  }
  _popRule() {
    this._ruleDepth[this.rule.ruleName]--;
    this.rule = this._stacRule.pop();
  }
  _newObject(label, param) {
    this.label = label;
    this.param = param;
    if (++this.objectCount > this.rule.rootInstance.criteria.maxobjects) return false;
    const det3 = this.matrix.det3();
    if (det3 > this._rule_min3 && det3 < this._rule_max3) 
        this.result = this._funcNewObject(this);
    return true;
  }
}
/** [SHOULD NOT CREATE new instance] SolidML.Rule represents rules in Eisen Script.  */
SolidML.Rule = class {
  /** [SHOULD NOT CREATE new instance] SolidML.Rule is create by {@link SolidML}
   * @param {rootInstance} SolidML instance 
   * @param {SolidML.Rule} parentRule parent rule, refers SolidML._root ussually
   * @param {string} ruleName rule name to search by parentRule.find() method
   * @param {string} option option string includes "weight" and "maxdepth"
   */
  constructor(rootInstance, parentRule, ruleName, option) {
    this.rootInstance = rootInstance;
    this.parent = parentRule;
    this.ruleName = ruleName || "$root";
    this.childRules = {};
    this.sequence = new SolidML.Reference(null, null);
    this.weight = 1;
    this.maxdepth = this.rootInstance.criteria["maxdepth"];
    this.maxdepthLabel = null;
    this.colorpool = (parentRule) ? parentRule.colorpool : this.rootInstance.criteria["colorpool"];
    if (option) this._parseRuleOption(option);
  }
  isEmpty() {
    return (!this.sequence.next);
  }
  minsize() {
    return this.rootInstance.criteria["minsize"];
  }
  maxsize() {
    return this.rootInstance.criteria["maxsize"];
  }
  /** search rule by name
   *  @param {string} ruleName name to search. search child rules first, then search ancestor rules.
   */
  find(ruleName) {
    if (ruleName in this.childRules) {
      const list = this.childRules[ruleName],
            total = list.reduce((acm, rule)=>acm+rule.weight, 0),
            randnum = SolidML.randMT.instance().next() * total;
      for (let i=0, acm=0; i<list.length; i++) {
        acm += list[i].weight;
        if (randnum < acm) return list[i];
      }
      return list[list.length-1];
    }
    return this.parent && this.parent.find(ruleName);
  }
  _parse(eisenScript, lastIndex) {
    let m;
    const rex = SolidML.regExp();
    rex.lastIndex = lastIndex;
    this._tail = this.sequence;
    while (m = rex.exec(eisenScript)) {
      if (!this._parseSetting(m,rex)) 
        if (!this._parseMatrix(m,rex)) 
          if (!this._parseReference(m,rex))
            if (!this._parseRule(m,rex)) 
              if (this._parseRuleEnd(m,rex)) 
                  break;
                else 
                  throw Error("syntax error: "+m[0]);
    }
    return rex.lastIndex;
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
        throw Error("label [" + this.maxdepthLabel + "] not found in rule " + this.ruleName);
    }
    stat._popRule();
    return stat;
  }
  _parseRuleOption(option) {
    let m;
    const rex = new RegExp("([a-z@]+)\\s*(\\d*\\.?\\d+)|>\\s*" + SolidML.ruleNameRexString, "gm");
    while (m = rex.exec(option)) {
      switch(m[1]) {
        case "weight": case "w": case "@w":
          this.weight = Number(m[2]);
          break;
        case "maxdepth": case "md": case "@":
          this.maxdepth = Number(m[2]);
          break;
        default:
          this.maxdepthLabel = m[3];
          break;
      }
    }
  }
  _parseSetting(m,rx) {
    if (!m[SolidML.REX_SETTING])
      return false;
    switch(m[SolidML.REX_SETTING_CMD]) {
      case "maxdepth": case "":
        this.rootInstance.criteria["maxdepth"] = Number(m[SolidML.REX_SETTING_ARG]);
        break;
      case "maxobjects": case "mo":
        this.rootInstance.criteria["maxobjects"] = Number(m[SolidML.REX_SETTING_ARG]);
        break;
      case "minsize": case "min":
        this.rootInstance.criteria["minsize"] = Number(m[SolidML.REX_SETTING_ARG]);
        break;
      case "maxsize": case "max":
        this.rootInstance.criteria["maxsize"] = Number(m[SolidML.REX_SETTING_ARG]);
        break;
      case "seed": case "s":
        this.rootInstance.criteria["seed"] = Number(m[SolidML.REX_SETTING_ARG]) || m[SolidML.REX_SETTING_STRING];
        break;
      case "background": case "bg":
        this.rootInstance.criteria["background"] = m[SolidML.REX_SETTING_COLOR] || SolidML.ColorTable[m[SolidML.REX_SETTING_STRING]] || "#000";
        this.rootInstance.criteria["sky"] = this.rootInstance.criteria["background"];
        this.rootInstance.criteria["floor"] = this.rootInstance.criteria["background"];
        break;
      case "floor": case "f":
        this.rootInstance.criteria["floor"] = m[SolidML.REX_SETTING_COLOR] || SolidML.ColorTable[m[SolidML.REX_SETTING_STRING]] || "#000";
        break;
      case "sky":
        this.rootInstance.criteria["sky"] = m[SolidML.REX_SETTING_COLOR] || SolidML.ColorTable[m[SolidML.REX_SETTING_STRING]] || "#000";
        break;
      case "material": case "mat":
        this.rootInstance.criteria["material"] = m[SolidML.REX_SETTING_PARAM];
        break;
      case "colorpool": case "cp":
        this.colorpool = m[SolidML.REX_SETTING_STRING];
        break;
      default:
        this.rootInstance.criteria[m[SolidML.REX_SETTING_CMD]] = m[SolidML.REX_SETTING_PARAM];
        break;
    }
    return true;
  }
  _parseMatrix(m,rx) {
    if (!m[SolidML.REX_MATRIX]) 
      return false;
    const repeat = m[SolidML.REX_MATRIX_REPEAT],
          operator = m[SolidML.REX_MATRIX_OPERATOR];
    this._tail = new SolidML.Operator(this, this._tail, repeat, operator);
    return true;
  }
  _parseReference(m,rx) {
    if (!m[SolidML.REX_REFERENCE])
      return false;
    const label = m[SolidML.REX_REFERENCE],
          param = m[SolidML.REX_REFERENCE_PARAM];
    this._tail = new SolidML.Reference(this._tail, label, param);
    return true;
  }
  _parseRule(m,rx) {
    if (!m[SolidML.REX_RULEDEF]) 
      return false;
    const label  = m[SolidML.REX_RULEDEF_LABEL],
          option = m[SolidML.REX_RULEDEF_OPTION],
          rule = new SolidML.Rule(this.rootInstance, this, label, option);
    if (!(rule.ruleName in this.childRules)) this.childRules[rule.ruleName] = [];
    this.childRules[rule.ruleName].push(rule);
    rx.lastIndex = rule._parse(m.input, rx.lastIndex);
    return true;
  }
  _parseRuleEnd(m,rx) {
    if (!m[SolidML.REX_RULE_END]) 
      return false;
    return true;
  }
}
SolidML.Reference = class {
  constructor(prev, label, param) {
    if (prev) prev.next = this;
    this.next = null;
    this.label = label;
    this.param = param;
  }
  _build(stat) {
    const rule = stat.rule.find(this.label);
    if (rule) {
      if (++stat._ruleDepth[rule.parent.ruleName] <= rule.parent.maxdepth) 
        rule._build(stat);
      stat._ruleDepth[rule.parent.ruleName]--;
    } else 
      if (!stat._newObject(this.label, this.param)) 
        return null;
    return this.next;
  }
}
SolidML.Operator = class {
  constructor(rule, prev, repeat, opeString) {
    this.parentRule = rule;
    this.repeat = Number(repeat) || 1;
    this.matrix = new SolidML.Matrix4();
    this.color = null;
    this.dcolor = null;
    this.blend = new SolidML.ColorHSBA().set(0,1,1,0);
    this.ratio = new SolidML.ColorHSBA().set(0,0,0,0);
    prev.next = this;
    this.next = null;
    this._parse(opeString);
  }
  _build(stat) {
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
    const rex = /([a-z]+)|([\-\d.]+)|(#[\da-fA-F]{3,6})|(\*)/gm;
    const getNumber = (failThrough=false)=>{
      const li = rex.lastIndex, m = rex.exec(opeString);
      if (m && m[2]) return Number(m[2]);
      if (!failThrough) throw Error("parameter not defined : "+opeString);
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
      if (!failThrough)
        throw Error("color not defined : "+opeString);
      rex.lastIndex = li;
      return null;
    };
    while (m = rex.exec(opeString)) {
      if (m[1] in SolidML.ColorTable) 
        this.color = new SolidML.ColorHSBA().setHex(SolidML.ColorTable[m[1]]);
      else if (m[3])
        this.color = new SolidML.ColorHSBA().setHex(m[3]);
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
            if (!this.dcolor) this.dcolor = new SolidML.ColorHSBA().set(0,1,1,1);
            this.dcolor.h = getNumber();
            break;
          case "sat":
            if (!this.dcolor) this.dcolor = new SolidML.ColorHSBA().set(0,1,1,1);
            this.dcolor.s = getNumber();
            break;
          case "brightness": case "b":
            if (!this.dcolor) this.dcolor = new SolidML.ColorHSBA().set(0,1,1,1);
            this.dcolor.b = getNumber();
            break;
          case "alpha": case "a":
            if (!this.dcolor) this.dcolor = new SolidML.ColorHSBA().set(0,1,1,1);
            this.dcolor.a = getNumber();
            break;
          case "blend":
            this.blend.setHex(getColor());
            this.blend.a = getNumber();
            break;
          case "color":
            const nextColor = getColor(true);
            if (nextColor)
              this.color = new SolidML.ColorHSBA().setHex(nextColor);
            else {
              m = rex.exec(opeString);
              if (m[1] == 'random')
                this.color = new SolidML.ColorHSBA().setRandom(this.parentRule.colorpool);
              else
                throw Error("cannot parse : " + m[0]);
            }
            break;
          case "random":
            this.color = new SolidML.ColorHSBA().setRandom(this.parentRule.colorpool);
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

SolidML.randMT = class {
  constructor(seed) {
    this._mt = new Uint32Array(624);
    this.seed = (seed===null) ? new Date().getTime() : seed;
  }
  static instance(seed=null) {
    if (!SolidML.randMT._instance) 
      SolidML.randMT._instance = new SolidML.randMT(seed);
    else if (seed)
      SolidML.randMT._instance.seed = seed;
    return SolidML.randMT._instance;
  }
  get seed() {
    return this._seed;
  }
  set seed(s) {
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
  next() {
    return ((this._nextInt() >>> 5) * 0x4000000 + (this._nextInt() >>> 6)) / 0x20000000000000; 
  }
}
SolidML.setRexString = "(set|@)\\s*([a-z]*)\\s*((-?\\d*\\.?\\d+)|(#[a-fA-F0-9]+)|([a-z:,]+)|(\\[.+?\\]))";
SolidML.ruleNameRexString = "([a-zA-Z_][a-zA-Z0-9_]*)";
SolidML.ruleDefineRexString = "(rule|#)\\s*" + SolidML.ruleNameRexString + "(.*?){";
SolidML.matRexString = "(((\\d+)[\\s*]*)?\\{(.+?)\\})";
SolidML.referenceParamRexString = "(\\[(.+?)\\])?";
SolidML.regExp = ()=>{
  const ruleRegExp = SolidML.ruleDefineRexString + "(\\s*" + SolidML.ruleWeightRexString + "|\\s*" + SolidML.ruleMaxDepthRexString +")*\\s*{";
  const str = [SolidML.setRexString, SolidML.ruleDefineRexString, SolidML.matRexString, SolidML.ruleNameRexString+SolidML.referenceParamRexString, "(})"].join("|");
  return new RegExp(str, "gm");
};
SolidML.REX_SETTING = 1;
SolidML.REX_SETTING_CMD = 2;
SolidML.REX_SETTING_PARAM = 3;
SolidML.REX_SETTING_ARG = 4;
SolidML.REX_SETTING_COLOR = 5;
SolidML.REX_SETTING_STRING = 6;
SolidML.REX_SETTING_ARRAY = 7;
SolidML.REX_RULEDEF = 8;
SolidML.REX_RULEDEF_LABEL = 9;
SolidML.REX_RULEDEF_OPTION = 10;
SolidML.REX_MATRIX = 11;
SolidML.REX_MATRIX_REPEAT = 13;
SolidML.REX_MATRIX_OPERATOR = 14;
SolidML.REX_REFERENCE = 15;
SolidML.REX_REFERENCE_PARAM = 17;
SolidML.REX_RULE_END = 18;
/**
 * svg name table for colors. SolidML.ColorTable["name"] returns hex string of the color.
 * @type {Object}
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
