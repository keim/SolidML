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
    this.addOperator   = new RenderTargetOperator(gl.renderer, RenderTargetOperator.addShader);
    this.multOperator  = new RenderTargetOperator(gl.renderer, RenderTargetOperator.multShader);
    this.copyOperator  = new RenderTargetOperator(gl.renderer, RenderTargetOperator.copyShader);
    this.blendOperator = new RenderTargetOperator(gl.renderer, RenderTargetOperator.blendShader);
  }
  clear() {
    this.accumlateCount = 0;
  }
  accumlate(accumRenderTarget, alpha=1) {
    this.accumlateCount++;
    const blend = (this.accumlateCount < 1024) ? this.accumlateCount : 1024;
    this.blendOperator.calc({"tSrc1":this.accumlationBuffer, "tSrc2":accumRenderTarget, "blend":alpha/blend}, this.renderTarget);
    this.copyOperator.calc({"tSrc":this.renderTarget}, this.accumlationBuffer);
  }
  mult(renderTarget, scale, add, resultTarget) {
    this.multOperator.calc({"tSrc1":renderTarget, "tSrc2":this.accumlationBuffer, scale, add}, resultTarget);
    //this.copyOperator.calc({"tSrc":this.accumlationBuffer, "scale":1});
  }
  add(renderTarget, scale, resultTarget) {
    //this.addOperator.calc({"tSrc1":renderTarget, "tSrc2":this.accumlationBuffer, scale}, resultTarget);
    this.copyOperator.calc({"tSrc":this.accumlationBuffer, scale});
  }
}

class GIAccumlator {
  constructor(gl, mapsize) {
    const mrtOptions = {
      generateMipmaps: false, 
      multipleRenderTargets: true, 
      renderTargetCount: 2
    };

    this.shadowAccumlator = new BufferAccumlator(gl);
    this.lightAccumlator = new BufferAccumlator(gl);
    this.renderer = gl.renderer;
    const size = gl.renderer.getSize();
    this.renderTarget = new WebGL2RenderTarget(size.width, size.height, mrtOptions);

    this.material = [
      new GIAccumlator.Material(), 
      new GIAccumlator.Material({useInstancedMatrix:true})
    ];
    this.scene = new THREE.Scene();

    this.shadowMaterial = [
      new GIAccumlator.DepthMaterial(), 
      new GIAccumlator.DepthMaterial({useInstancedMatrix:true})
    ];
    this.shadowScene = new THREE.Scene();
    this.shadowCamera = new THREE.OrthographicCamera();
    this.shadowScene.add(this.shadowCamera);
    this.shadowMap0 = new WebGL2RenderTarget(mapsize, mapsize, mrtOptions);
    this.shadowMap1 = new WebGL2RenderTarget(mapsize, mapsize, mrtOptions);
    this.shadowMatrix0 = new THREE.Matrix4();
    this.shadowMatrix1 = new THREE.Matrix4();
    this.irradianceDistance = 0.8;
    this.lightColor0 = new THREE.Color(0xffffff);
    this.lightColor1 = new THREE.Color(0xffffff);
    this.lightDirection = new THREE.Vector3(0, 0, 1);

    this.clearColor = new THREE.Color(0);
    this.boundingSphere = null;
    this.group = null;
    this.shadowGroup = null;
    this.pause = false;
  }
  stop() {
    this.shadowAccumlator.clear();
    this.lightAccumlator.clear();
    this.pause = true;
  }
  start() {
    this.shadowAccumlator.clear();
    this.lightAccumlator.clear();
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
      this.shadowCamera.near = 1e-4;
      this.shadowCamera.far = this.boundingSphere.radius*4;
      this.shadowCamera.updateProjectionMatrix();
      this.scene.add(this.group);
      this.shadowScene.add(this.shadowGroup);
    }
    this.shadowAccumlator.clear();
    this.lightAccumlator.clear();
  }
  render(camera, times) {
    if (!this.group || this.group.children.length == 0 || this.pause) return;
    const tempCamera = camera.clone(),
          mat = new THREE.Matrix4(),
          center = this.boundingSphere.center,
          radius = this.boundingSphere.radius;
    this.renderer.setClearColor(this.clearColor);
    this.scene.add(tempCamera);
    //if (this.shadowAccumlator.accumlateCount > 512) times = 1;
    if (this.shadowAccumlator.accumlateCount > 0) times = 1;
    for (let i=0; i<times; i++) {
      const me = randomRotationMatrix(mat, Math.random(), Math.random(), Math.random()).elements;

      // shadowmap
      this.shadowCamera.position.set(center.x + me[0]*radius, center.y + me[1]*radius, center.z + me[2]*radius);
      this.shadowCamera.up.set(me[4], me[5], me[6]);
      this.shadowCamera.lookAt( center );
      this.shadowCamera.updateMatrixWorld();
      this.shadowMatrix0.set( 0.5, 0, 0, 0.5,  0, 0.5, 0, 0.5,  0, 0, 0.5, 0.5,  0, 0, 0, 1 );
      this.shadowMatrix0.multiply( this.shadowCamera.projectionMatrix );
      this.shadowMatrix0.multiply( this.shadowCamera.matrixWorldInverse );
      this.renderer.render(this.shadowScene, this.shadowCamera, this.shadowMap0);

      // back shadowmap
      this.shadowCamera.position.set(center.x - me[0]*radius, center.y - me[1]*radius, center.z - me[2]*radius);
      this.shadowCamera.up.set(-me[4], -me[5], -me[6]);
      this.shadowCamera.lookAt( center );
      this.shadowCamera.updateMatrixWorld();
      this.shadowMatrix1.set( 0.5, 0, 0, 0.5,  0, 0.5, 0, 0.5,  0, 0, 0.5, 0.5,  0, 0, 0, 1 );
      this.shadowMatrix1.multiply( this.shadowCamera.projectionMatrix );
      this.shadowMatrix1.multiply( this.shadowCamera.matrixWorldInverse );
      this.renderer.render(this.shadowScene, this.shadowCamera, this.shadowMap1);

      // lighting
      this.lightDirection.set(-me[0], -me[1], -me[2]);
      this.material[0].setShadowMapParameters(this);
      this.material[1].setShadowMapParameters(this);
      this.renderer.render(this.scene, tempCamera, this.renderTarget);

      this.shadowAccumlator.accumlate(this.renderTarget.textures[0]);
      this.lightAccumlator.accumlate(this.renderTarget.textures[1]);
    }
    this.scene.remove(tempCamera);
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
  return normalize(vec3(u, -sqrt(1.0 - u.x * u.x - u.y * u.y)));
}
vec4 packRSMDepthNormaltoRGBA(const in float depth, const in vec3 normal){
  vec4 r = vec4(normal.xy * 0.5 + 0.5, fract(depth*256.), depth);
  r.w -= r.z * ShiftRight8; // tidy overflow
  return r * PackUpscale;
}`;

GIAccumlator.DepthMaterial = class extends THREE.ShaderMaterial {
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
layout (location = 0) out vec4 outDepthNormal;
layout (location = 1) out vec4 outAlbedo;
void main() {
  outDepthNormal = packRSMDepthNormaltoRGBA( gl_FragCoord.z, vNormal );
  outAlbedo = vColor;
}
    `;
  }
}


GIAccumlator.Material = class extends THREE.ShaderMaterial {
  constructor(paramaters={}) {
    super();
    if (paramaters["useInstancedMatrix"]) {
      Object.assign(this.defines, {"INSTANCED_MATRIX" : 1});
      delete paramaters["useInstancedMatrix"];
    }
    this.uniforms = THREE.UniformsUtils.merge([
      THREE.ShaderLib.lambert.uniforms,
      {
        shadowCamZRange : {value: new THREE.Vector2(0,1)},
        lightDirection : {value: null},
        lightColor0 : {value: null},
        lightColor1 : {value: null},
        shadowMatrix0 : {value: null},
        shadowMatrix1 : {value: null},
        shadowMap0 : {value: null},
        albedoMap0 : {value: null},
        shadowMap1 : {value: null},
        albedoMap1 : {value: null},
        irrRadius : {value: 1},
        shadowMapSize : {value: new THREE.Vector2(256,256)}
      }
    ]);
    this._initShaders();
    this.setValues(paramaters);
  }

  setShadowMapParameters(hash) {
    this.uniforms.shadowCamZRange.value.set(hash.shadowCamera.near, hash.shadowCamera.far);
    this.uniforms.lightDirection.value = hash.lightDirection;
    this.uniforms.lightColor0.value = hash.lightColor0;
    this.uniforms.lightColor1.value = hash.lightColor1;
    this.uniforms.shadowMatrix0.value = hash.shadowMatrix0;
    this.uniforms.shadowMatrix1.value = hash.shadowMatrix1;
    this.uniforms.shadowMap0.value = hash.shadowMap0.textures[0];
    this.uniforms.albedoMap0.value = hash.shadowMap0.textures[1];
    this.uniforms.shadowMapSize.value.set(hash.shadowMap0.width, hash.shadowMap0.height);
    this.uniforms.shadowMap1.value = hash.shadowMap1.textures[0];
    this.uniforms.albedoMap1.value = hash.shadowMap1.textures[1];
    this.uniforms.irrRadius.value = hash.irradianceDistance / (hash.shadowCamera.top - hash.shadowCamera.bottom);
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
out vec3 vNormal;
out vec4 vColor;
out float vLightFront;
out float vLightBack;

void main() {
  #ifdef INSTANCED_MATRIX
    mat4 imat = mat4(imatx, imaty, imatz, imatw);
    vec3 transformed  = (imat * vec4(position.xyz, 1)).xyz;
    vec3 objectNormal = (imat * vec4(normal.xyz,   0)).xyz;
  #else
    vec3 transformed  = position.xyz;
    vec3 objectNormal = normal.xyz;
  #endif
  vec3 transformedNormal = normalize( normalMatrix * objectNormal );
  vec4 mvPosition = modelViewMatrix * vec4( transformed, 1.0 );
  vec4 worldPosition = modelMatrix * vec4( transformed, 1.0 );
  #ifdef FLIP_SIDED
    transformedNormal = - transformedNormal;
  #endif
  vViewPosition = -mvPosition.xyz;
  vColor = color;
  vNormal = normalize((shadowMatrix0 * vec4(transformedNormal, 0)).xyz);
  float dotNL = dot( transformedNormal, lightDirection );
  vLightFront = saturate( -dotNL ) * PI;
  vLightBack = saturate(  dotNL ) * PI;
  vShadowCoord0 = shadowMatrix0 * worldPosition;
  vShadowCoord1 = shadowMatrix1 * worldPosition;
  vShadowCoord0.xyz /= vShadowCoord0.w;
  vShadowCoord1.xyz /= vShadowCoord1.w;
  gl_Position = projectionMatrix * mvPosition;
}`;

this.fragmentShader = `#version 300 es
struct ReflectiveShadowMap {
  float depth;
  vec3 normal;
  vec4 albedo;
};
uniform vec2 shadowCamZRange;
uniform vec3 lightDirection;
uniform vec3 lightColor0;
uniform vec3 lightColor1;
uniform sampler2D shadowMap0;
uniform sampler2D albedoMap0;
uniform sampler2D shadowMap1;
uniform sampler2D albedoMap1;
uniform float irrRadius;
uniform vec2 shadowMapSize;
in vec4 vShadowCoord0;
in vec4 vShadowCoord1;
in vec3 vViewPosition;
in vec3 vNormal;
in vec4 vColor;
in float vLightFront;
in float vLightBack;
layout (location = 0) out vec4 outShadow;
layout (location = 1) out vec4 outLight;
#include <common>
${rsm_packing}
float viewZToOrthographicDepth( const in float viewZ ) {
  return ( viewZ + shadowCamZRange.x ) / ( shadowCamZRange.x - shadowCamZRange.y );
}
float orthographicDepthToViewZ( const in float linearClipZ ) {
  return linearClipZ * ( shadowCamZRange.x - shadowCamZRange.y ) - shadowCamZRange.x;
}
ReflectiveShadowMap getRSM(sampler2D shadowMap, sampler2D albedoMap, vec2 uv) {
  vec4 dmap = texture2D( shadowMap, uv );
  return ReflectiveShadowMap(unpackRGBAToRSMDepth(dmap), unpackRGBAToRSMNormal(dmap), texture2D( albedoMap, uv ));
}
vec3 getIrradiance( sampler2D shadowMap, sampler2D albedoMap, vec2 uv, vec3 center ) {
  ReflectiveShadowMap rsm = getRSM(shadowMap, albedoMap, uv);
  vec3 dir = normalize( vec3(uv, orthographicDepthToViewZ(rsm.depth)) - center );
  return rsm.albedo.xyz * -rsm.normal.z * step(EPSILON, dot(-dir, rsm.normal)) * saturate(dot(dir, vNormal));
  //return rsm.albedo.xyz * -rsm.normal.z;
}
vec3 getIrradianceMap() {
  vec3 center0 = vec3(vShadowCoord0.xy, orthographicDepthToViewZ(vShadowCoord0.z)),
       center1 = vec3(vShadowCoord1.xy, orthographicDepthToViewZ(vShadowCoord1.z));
  vec3 irradiance = vec3(0);
  float r = rand(vShadowCoord0.xy) * irrRadius + 1./shadowMapSize.x;
  float t = rand(vShadowCoord0.xy + .1) * PI2;
  vec2 d = r * vec2(cos(t),sin(t));
  vec2 id = vec2(d.y, -d.x);
  irradiance += getIrradiance( shadowMap0, albedoMap0, vShadowCoord0.xy + d, center0);
  irradiance += getIrradiance( shadowMap0, albedoMap0, vShadowCoord0.xy - d, center0);
  irradiance += getIrradiance( shadowMap0, albedoMap0, vShadowCoord0.xy + id, center0);
  irradiance += getIrradiance( shadowMap0, albedoMap0, vShadowCoord0.xy - id, center0);
  irradiance += getIrradiance( shadowMap1, albedoMap1, vShadowCoord1.xy + d, center1);
  irradiance += getIrradiance( shadowMap1, albedoMap1, vShadowCoord1.xy - d, center1);
  irradiance += getIrradiance( shadowMap1, albedoMap1, vShadowCoord1.xy + id, center1);
  irradiance += getIrradiance( shadowMap1, albedoMap1, vShadowCoord1.xy - id, center1);
  return irradiance;
  //return getIrradiance( shadowMap0, albedoMap0, vShadowCoord0.xy, center0);
} 
vec3 getShadow( sampler2D shadowMap, sampler2D albedoMap, vec4 coord, float shadowBias ) {
  if (coord.x < 0.0 || coord.x > 1.0 || coord.y < 0.0 || coord.y > 1.0 || coord.z > 1.0) return vec3(1);
  ReflectiveShadowMap rsm = getRSM(shadowMap, albedoMap, coord.xy);
  return mix( rsm.albedo.xyz * (1.0 - rsm.albedo.w), vec3(1), step( coord.z - shadowBias, rsm.depth ) );
}
void main() {
  vec3 outgoingLight = vec3(0);
  outgoingLight += (( gl_FrontFacing ) ? vLightFront : vLightBack) * getShadow( shadowMap0, albedoMap0, vShadowCoord0, 1e-5 )/ PI;
  outgoingLight += (( gl_FrontFacing ) ? vLightBack : vLightFront) * getShadow( shadowMap1, albedoMap1, vShadowCoord1, 1e-5 )/ PI;
  outShadow = vec4( outgoingLight, 1.0 );
  outLight = vec4( getIrradianceMap(), 1.0 );
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