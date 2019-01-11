class BufferAccumlator {
  constructor(gl) {
    const renderTargetConf = {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      generateMipmaps: false,
      stencilBuffer: false,
      depthBuffer: false
    };
    this.renderTarget = gl.newRenderTarget(renderTargetConf);
    this.accumlationBuffer = gl.newRenderTarget(renderTargetConf);
    this.mult  = new RenderTargetOperator(gl.renderer, RenderTargetOperator.multShader);
    this.copy  = new RenderTargetOperator(gl.renderer, RenderTargetOperator.copyShader);
    this.blend = new RenderTargetOperator(gl.renderer, RenderTargetOperator.blendShader);
  }
  clear() {
    this.accumlateCount = 0;
  }
  accumlate(accumRenderTarget, alpha=1) {
    this.accumlateCount++;
    const blend = (this.accumlateCount < 1024) ? this.accumlateCount : 1024;
    this.blend.calc({"tSrc1":this.accumlationBuffer, "tSrc2":accumRenderTarget, "blend":alpha/blend}, this.renderTarget);
    this.copy.calc({"tSrc":this.renderTarget}, this.accumlationBuffer);
  }
  render(renderTarget, scale, add) {
    this.mult.calc({"tSrc1":renderTarget, "tSrc2":this.accumlationBuffer, scale, add});
    //this.copy.calc({"tSrc":this.renderTarget, "scale":1});
  }
}

class ShadowAccumlator {
  constructor(gl) {
    ShadowAccumlator.LIGHT_COUNT = 2;
    this.accumlator = new BufferAccumlator(gl);
    this.renderer = gl.renderer;
    this.renderTarget = gl.newRenderTarget({generateMipmaps: false});
    this.material = [
      new ShadowAccumlator.Material(), 
      new ShadowAccumlator.Material({useInstancedMatrix:true})
    ];
    this.depthMaterial = [
      new ShadowAccumlator.DepthMaterial(), 
      new ShadowAccumlator.DepthMaterial({useInstancedMatrix:true})
    ];
    this.scene = new THREE.Scene();
    this.lights = [];
    for (let i=0; i<ShadowAccumlator.LIGHT_COUNT; i++) {
      const light = new THREE.DirectionalLight(0xffffff, 1);
      light.castShadow = true;
      light.shadow.radius = 2.5;
      light.shadow.mapSize.width = 256;
      light.shadow.mapSize.height = 256;
      this.scene.add(light);
      this.scene.add(light.target);
      this.lights.push(light);
    }
    this.boundingSphere = null;
    this.group = null;
    this.pause = false;
  }
  stop() {
    this.accumlator.clear();
    this.pause = true;
  }
  start() {
    this.accumlator.clear();
    this.pause = false;
  }
  setMeshes(meshList, boundingSphere) {
    if (this.group)
      this.scene.remove(this.group);
    this.group = new THREE.Group();
    if (meshList) {
      meshList.forEach(mesh=>{
        const newMesh = mesh.clone(); 
        newMesh.material = this.material[mesh.geometry.isInstancedBufferGeometry?1:0];
        newMesh.customDepthMaterial = this.depthMaterial[mesh.geometry.isInstancedBufferGeometry?1:0];
        this.group.add(newMesh);
      });
      this.boundingSphere = boundingSphere;
      for (let i=0; i<ShadowAccumlator.LIGHT_COUNT; i++) {
        this.lights[i].shadow.camera.bottom = - this.boundingSphere.radius;
        this.lights[i].shadow.camera.top    = + this.boundingSphere.radius;
        this.lights[i].shadow.camera.left   = - this.boundingSphere.radius;
        this.lights[i].shadow.camera.right  = + this.boundingSphere.radius;
        this.lights[i].shadow.camera.near = 0.01;
        this.lights[i].shadow.camera.far = this.boundingSphere.radius*2;
        this.lights[i].shadow.camera.updateProjectionMatrix();
      }
      this.scene.add(this.group);
    }
    this.accumlator.clear();
  }
  render(camera, times) {
    if (!this.group || this.group.children.length == 0 || this.pause) return;
    const tempCamera = camera.clone(),
          mat = new THREE.Matrix4(),
          center = this.boundingSphere.center,
          radius = this.boundingSphere.radius;
    this.renderer.setClearColor(new THREE.Color(0xffffff));
    for (let i=0; i<ShadowAccumlator.LIGHT_COUNT; i++) {
      this.lights[i].target.position.copy(center);
    }
    this.scene.add(tempCamera);
    if (this.accumlator.accumlateCount > 512) times = 1;
    for (let i=0; i<times; i++) {
      const me = randomRotationMatrix(mat, Math.random(), Math.random(), Math.random()).elements;
      this.lights[0].position.set(center.x + me[0]*radius, center.y + me[1]*radius, center.z + me[2]*radius);
      this.lights[0].shadow.camera.up.set(me[4], me[5], me[6]);
      this.lights[1].position.set(center.x - me[0]*radius, center.y - me[1]*radius, center.z - me[2]*radius);
      this.lights[1].shadow.camera.up.set(-me[4], -me[5], -me[6]);
      this.renderer.render(this.scene, tempCamera, this.renderTarget);
      this.accumlator.accumlate(this.renderTarget);
    }
    this.scene.remove(tempCamera);
  }
  texture() {
    return this.accumlator.renderTarget.texture; 
  }
}

const rsm_packing = `
const float PackUpscale = 256. / 255.;
const float ShiftRight8 = 1. / 256.;
float unpackRGBAToRSMDepth(const in vec4 v) {
  return v.z * 255. / 65536. + v.w;
}
vec4 unpackRGBAToRSMAlbedo(const in vec4 v) {
  vec2 w = v.xy * 255. / 16.;
  return vec4(floor(w.x), fract(w.x)*16., floor(w.y), fract(w.y)*16.) / 15.;
}
vec4 packRSMtoRGBA(const in float depth, const in vec4 albedo){
  vec4 r = vec4(
    (floor(albedo.x * 15.) * 16. + floor(albedo.y * 15.)) / 256.,
    (floor(albedo.z * 15.) * 16. + floor(albedo.w * 15.)) / 256.,
    fract(depth*256.), depth);
  r.w -= r.z * ShiftRight8; // tidy overflow
  return r * PackUpscale;
}`;

ShadowAccumlator.DepthMaterial = class extends THREE.ShaderMaterial {
  constructor(paramaters={}) {
    super();
    if (paramaters["useInstancedMatrix"]) {
      Object.assign(this.defines, {"INSTANCED_MATRIX" : 1});
      delete paramaters["useInstancedMatrix"];
    }
    this.uniforms = THREE.UniformsUtils.clone(THREE.ShaderLib.depth.uniforms);
    this.setValues(paramaters);
    this.vertexShader = `
attribute vec4 color;
varying vec4 vColor;
#ifdef INSTANCED_MATRIX
  attribute vec4 imatx;
  attribute vec4 imaty;
  attribute vec4 imatz;
  attribute vec4 imatw;
  void main() { 
    vColor = color;
    gl_Position = projectionMatrix * modelViewMatrix * mat4(imatx, imaty, imatz, imatw) * vec4(position.xyz, 1); 
  }
#else
  void main() {
    vColor = color;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xyz, 1);
  }
#endif
    `;
    this.fragmentShader = `
${rsm_packing}
varying vec4 vColor;
void main() { gl_FragColor = packRSMtoRGBA( gl_FragCoord.z, vColor ); }
    `;
  }
}


ShadowAccumlator.Material = class extends THREE.ShaderMaterial {
  constructor(paramaters={}) {
    super();
    if (paramaters["useInstancedMatrix"]) {
      Object.assign(this.defines, {"INSTANCED_MATRIX" : 1});
      delete paramaters["useInstancedMatrix"];
    }
    this.uniforms = THREE.UniformsUtils.clone(THREE.ShaderLib.lambert.uniforms);
    this._initShaders();
    this.color = new THREE.Color( 0xffffff );
    this.emissive = new THREE.Color( 0x000000 );
    this.emissiveIntensity = 1.0;
    this.lights = true;
    this.setValues(paramaters);
  }

  _initShaders() {
const directional_light = `
struct DirectionalLight {
  vec3 direction;
  vec3 color;
  int shadow;
  float shadowBias;
  float shadowRadius;
  vec2 shadowMapSize;
};
uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
`;

this.vertexShader = `
#define LAMBERT
#include <common>
${directional_light}
attribute vec4 color;
#ifdef INSTANCED_MATRIX
  attribute vec4 imatx;
  attribute vec4 imaty;
  attribute vec4 imatz;
  attribute vec4 imatw;
#endif
uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHTS ];
varying vec4 vShadowCoord[ NUM_DIR_LIGHTS ];
varying vec3 vViewPosition;
varying vec4 vColor;
varying vec3 vLightFront;
varying vec3 vLightBack;

void accumDirectionalLight(vec3 nml, DirectionalLight directionalLight) {
  float dotNL = dot( nml, directionalLight.direction );
  vLightFront += saturate(  dotNL ) * directionalLight.color * PI;
  vLightBack  += saturate( -dotNL ) * directionalLight.color * PI;
}

void main() {
  #ifdef INSTANCED_MATRIX
    mat4 imat = mat4(imatx, imaty, imatz, imatw);
    vec3 transformed  = (imat * vec4(position.xyz, 1)).xyz;
    vec3 objectNormal = (imat * vec4(normal.xyz,   0)).xyz;
  #else
    vec3 transformed  = position.xyz;
    vec3 objectNormal = normal.xyz;
  #endif
  vec3 transformedNormal = normalMatrix * objectNormal;
  vec4 mvPosition = modelViewMatrix * vec4( transformed, 1.0 );
  vec4 worldPosition = modelMatrix * vec4( transformed, 1.0 );
  #ifdef FLIP_SIDED
    transformedNormal = - transformedNormal;
  #endif
  vViewPosition = -mvPosition.xyz;
  vColor = color;

  vec3 nml = normalize( transformedNormal );
  vLightFront = vec3( 0.0 );
  vLightBack = vec3( 0.0 );
  accumDirectionalLight(nml, directionalLights[0]);
  accumDirectionalLight(nml, directionalLights[1]);
  vShadowCoord[0] = directionalShadowMatrix[0] * worldPosition;
  vShadowCoord[1] = directionalShadowMatrix[1] * worldPosition;
  gl_Position = projectionMatrix * mvPosition;
}`;

this.fragmentShader = `
uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHTS ];
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
varying vec4 vShadowCoord[ NUM_DIR_LIGHTS ];
varying vec3 vViewPosition;
varying vec4 vColor;
varying vec3 vLightFront;
varying vec3 vLightBack;
#include <common>
${rsm_packing}
${directional_light}
vec3 texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
  vec4 dmap = texture2D( depths, uv );
  vec4 albedo = unpackRGBAToRSMAlbedo(dmap);
  return mix( albedo.xyz * (1.0 - albedo.w), vec3(1), step( compare, unpackRGBAToRSMDepth(dmap) ) );
}
vec3 getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
  vec3 shadow = vec3(1);
  shadowCoord.xyz /= shadowCoord.w;
  shadowCoord.z += shadowBias;
  if (shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0 && shadowCoord.z <= 1.0) {
    shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );
  }
  return shadow;
}
vec3 getShadowMask() {
  vec3 shadow = vec3(0);
    shadow += getShadow( directionalShadowMap[0], directionalLights[0].shadowMapSize, directionalLights[0].shadowBias, directionalLights[0].shadowRadius, vShadowCoord[0] );
    shadow += getShadow( directionalShadowMap[1], directionalLights[1].shadowMapSize, directionalLights[1].shadowBias, directionalLights[1].shadowRadius, vShadowCoord[1] );
  return shadow;
}
void main() {
  vec3 outgoingLight = (( gl_FrontFacing ) ? vLightFront : vLightBack) * diffuse * getShadowMask() / PI + emissive;
  gl_FragColor = vec4( outgoingLight, opacity );
}`;
  }
}

function randomRotationMatrix(mat, x0, x1, x2) {
  const y1 = x1 * Math.PI * 2,
        y2 = x2 * Math.PI * 2,
        r1 = Math.sqrt(1.0-x0),
        r2 = Math.sqrt(x0),
        u0 = Math.cos(y2) * r2,
        u1 = Math.sin(y1) * r1,
        u2 = Math.cos(y1) * r1,
        u3 = Math.sin(y2) * r2,
        coefi  = 2 * u0 * u0 - 1,
        coefuu = 2,
        coefe  = 2 * u0;
  return mat.set(
    coefi+coefuu*u1*u1,       // r[0, 0]
    coefuu*u1*u2-coefe*u3,    // r[0, 1]
    coefuu*u1*u3+coefe*u2, 0, // r[0, 2]
    coefuu*u2*u1+coefe*u3,    // r[1, 0]
    coefi+coefuu*u2*u2,       // r[1, 1]
    coefuu*u2*u3-coefe*u1, 0, // r[1, 2]
    coefuu*u3*u1-coefe*u2,    // r[2, 0]
    coefuu*u3*u2+coefe*u1,    // r[2, 1]
    coefi+coefuu*u3*u3, 0,    // r[2, 2]
    0, 0, 0, 1
  );
}