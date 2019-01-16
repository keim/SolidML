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
    this.accumlator = new BufferAccumlator(gl);
    this.renderer = gl.renderer;
    this.renderTarget = gl.newRenderTarget({generateMipmaps: false});

    this.material = [
      new ShadowAccumlator.Material(), 
      new ShadowAccumlator.Material({useInstancedMatrix:true})
    ];
    this.scene = new THREE.Scene();

    this.shadowMaterial = [
      new ShadowAccumlator.DepthMaterial(), 
      new ShadowAccumlator.DepthMaterial({useInstancedMatrix:true})
    ];
    this.shadowScene = new THREE.Scene();
    this.shadowCamera = new THREE.OrthogonalCamera();
    this.shadowScene.add(this.shadowCamera);
    this.shadowMap0 = new THREE.WebGLRenderTarget(256, 256, {generateMipmaps: false});
    this.shadowMap1 = new THREE.WebGLRenderTarget(256, 256, {generateMipmaps: false});
    this.shadowMatrix0 = new THREE.Matrix4();
    this.shadowMatrix1 = new THREE.Matrix4();

    this.boundingSphere = null;
    this.group = null;
    this.shadowGroup = null;
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
    if (this.group) {
      this.scene.remove(this.group);
      this.shadowScene.remove(this.shadowGroup);
    }
    this.group = new THREE.Group();
    this.shadowGroup = new THREE.Group();
    if (meshList) {
      meshList.forEach(mesh=>{
        const isIBG = mesh.geometry.isInstancedBufferGeometry ? 1 : 0,
              newMesh = mesh.clone(),
              shadowMesh = mesh.clone();              
        newMesh.material = this.material[isIBG];
        this.group.add(newMesh);
        shadowMesh.material = this.shadowMaterial[isIBG];
        this.shadowGroup.add(shadowMesh);
      });
      this.boundingSphere = boundingSphere;
      this.shadowCamera.bottom = - this.boundingSphere.radius;
      this.shadowCamera.top    = + this.boundingSphere.radius;
      this.shadowCamera.left   = - this.boundingSphere.radius;
      this.shadowCamera.right  = + this.boundingSphere.radius;
      this.shadowCamera.near = 0.01;
      this.shadowCamera.far = this.boundingSphere.radius*2;
      this.shadowCamera.updateProjectionMatrix();
      this.scene.add(this.group);
      this.shadowScene.add(this.shadowGroup);
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
    this.scene.add(tempCamera);
    if (this.accumlator.accumlateCount > 512) times = 1;
    for (let i=0; i<times; i++) {
      const me = randomRotationMatrix(mat, Math.random(), Math.random(), Math.random()).elements;
      this.shadowCamera.position.set(center.x + me[0]*radius, center.y + me[1]*radius, center.z + me[2]*radius);
      this.shadowCamera.up.set(me[4], me[5], me[6]);
      this.shadowCamera.lookAt( center );
      this.shadowCamera.updateMatrixWorld();
      this.shadowMatrix0.set( 0.5, 0, 0, 0.5,  0, 0.5, 0, 0.5,  0, 0, 0.5, 0.5,  0, 0, 0, 1 );
      this.shadowMatrix0.multiply( this.shadowCamera.projectionMatrix );
      this.shadowMatrix0.multiply( this.shadowCamera.matrixWorldInverse );
      this.renderer.render(this.shadowScene, this.shadowCamera, this.shadowMap0);

      this.shadowCamera.position.set(center.x - me[0]*radius, center.y - me[1]*radius, center.z - me[2]*radius);
      this.shadowCamera.up.set(-me[4], -me[5], -me[6]);
      this.shadowCamera.lookAt( center );
      this.shadowCamera.updateMatrixWorld();
      this.shadowMatrix1.set( 0.5, 0, 0, 0.5,  0, 0.5, 0, 0.5,  0, 0, 0.5, 0.5,  0, 0, 0, 1 );
      this.shadowMatrix1.multiply( this.shadowCamera.projectionMatrix );
      this.shadowMatrix1.multiply( this.shadowCamera.matrixWorldInverse );
      this.renderer.render(this.shadowScene, this.shadowCamera, this.shadowMap1);


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
vec3 unpackRGBAToRSMNormal(const in vec4 v) {
  vec2 u = v.xy * 2.0 - 1.0;
  return normalize(vec3(u, sqrt(1.0 - u.x * u.x - u.y * u.y)));
}
vec4 packRSMDepthNormaltoRGBA(const in float depth, const in vec3 normal){
  vec4 r = vec4(normal.xy * 0.5 + 0.5, fract(depth*256.), depth);
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
    this.vertexShader = `#version 300 es
in vec4 color;
out vec4 vColor;
out vec3 vNormal;
#ifdef INSTANCED_MATRIX
  in vec4 imatx;
  in vec4 imaty;
  in vec4 imatz;
  in vec4 imatw;
  void main() { 
    mat4 imat = mat4(imatx, imaty, imatz, imatw);
    vColor = color;
    vNormal = normalMatrix * (imat * vec4(normal.xyz, 0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * imat * vec4(position.xyz, 1); 
  }
#else
  void main() {
    vColor = color;
    vNormal = normalMatrix * normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xyz, 1);
  }
#endif
    `;
    this.fragmentShader = `#version 300 es
${rsm_packing}
in vec4 vColor;
in vec3 vNormal;
layout (location = 0) out vec4 outColor;
void main() {
  outColor = packRSMDepthNormaltoRGBA( gl_FragCoord.z, vNormal );
}
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
    this.uniforms = THREE.UniformsUtils.merge([
      THREE.ShaderLib.lambert.uniforms,
      {
        lightDirection : {value: THREE.Vector3()},
        lightColor0 : {value: THREE.Vector3()},
        lightColor1 : {value: THREE.Vector3()},
        shadowMatrix0 : {value: THREE.Matrix4()},
        shadowMatrix1 : {value: THREE.Matrix4()},
        shadowMap0 : {value: null},
        shadowMap1 : {value: null},
        shadowMapSize : {value: THREE.Vector2(256, 256)}
      }
    ]);
    this._initShaders();
    this.color = new THREE.Color( 0xffffff );
    this.emissive = new THREE.Color( 0x000000 );
    this.emissiveIntensity = 1.0;

    this.lightDirection = THREE.Vector3();
    this.lightColor0 = THREE.Vector3();
    this.lightColor1 = THREE.Vector3();
    this.shadowMatrix0 = THREE.Matrix4();
    this.shadowMatrix1 = THREE.Matrix4();
    this.shadowMap0 = null;
    this.shadowMap1 = null;
    this.shadowMapSize = THREE.Vector2(256, 256);

    this.setValues(paramaters);
  }

  setShadowMapParameters() {
    /**/ // TODO!
  }

  _initShaders() {
this.vertexShader = `#version 300 es
#include <common>
in vec4 color;
#ifdef INSTANCED_MATRIX
  in vec4 imatx;
  in vec4 imaty;
  in vec4 imatz;
  in vec4 imatw;
#endif
uniform vec3 lightDirection;
uniform vec3 lightColor0;
uniform vec3 lightColor1;
uniform mat4 shadowMatrix0;
uniform mat4 shadowMatrix1;
uniform vec2 shadowMapSize;
out vec4 vShadowCoord0;
out vec4 vShadowCoord1;
out vec3 vViewPosition;
out vec4 vColor;
out vec3 vLightFront;
out vec3 vLightBack;

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
  float dotNL0 = dot( nml, lightDirection );
  float dotNL1 = dot( nml, -lightDirection );
  vLightFront = (saturate(  dotNL0 ) * lightColor0 + saturate(  dotNL1 ) * lightColor1) * PI;
  vLightBack  = (saturate( -dotNL0 ) * lightColor0 + saturate( -dotNL1 ) * lightColor1) * PI;
  vShadowCoord0 = shadowMatrix0 * worldPosition;
  vShadowCoord1 = shadowMatrix1 * worldPosition;
  gl_Position = projectionMatrix * mvPosition;
}`;

this.fragmentShader = `#version 300 es
uniform vec3 lightDirection;
uniform vec3 lightColor0;
uniform vec3 lightColor1;
uniform sampler2D shadowMap0;
uniform sampler2D shadowMap1;
uniform vec2 shadowMapSize;
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
in vec4 vShadowCoord[ NUM_DIR_LIGHTS ];
in vec3 vViewPosition;
in vec4 vColor;
in vec3 vLightFront;
in vec3 vLightBack;
layout (location = 0) out vec4 outColor;
#include <common>
${rsm_packing}
vec3 texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
  vec4 dmap = texture2D( depths, uv );
  vec4 albedo = vec4(0);//unpackRGBAToRSMAlbedo(dmap);
  return mix( albedo.xyz * (1.0 - albedo.w), vec3(1), step( compare, unpackRGBAToRSMDepth(dmap) ) );
}
vec3 getShadow( sampler2D shadowMap, float shadowBias, vec4 shadowCoord ) {
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
    shadow += getShadow( shadowMap0, 0.0, vShadowCoord0 );
    shadow += getShadow( shadowMap1, 0.0, vShadowCoord1 );
  return shadow;
}
void main() {
  vec3 outgoingLight = (( gl_FrontFacing ) ? vLightFront : vLightBack) * diffuse * getShadowMask() / PI + emissive;
  outColor = vec4( outgoingLight, opacity );
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