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
    this.depthMaterial = [
      new ShadowAccumlator.DepthMaterial(), 
      new ShadowAccumlator.DepthMaterial({useInstancedMatrix:true})
    ];
    this.scene = new THREE.Scene();
    this.lights = [];
    for (let i=0; i<2; i++) {
      const light = new THREE.DirectionalLight(0xffffff, 1);
      light.castShadow = true;
      light.shadow.radius = 2.5;
      light.shadow.mapSize.width = 256;
      light.shadow.mapSize.height = 256;
      light.shadow.camera.near = 0.01;
      light.shadow.camera.far = 10000;
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
      for (let i=0; i<2; i++) {
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
          dir = new THREE.Vector3(),
          currentShadowMapType = this.renderer.shadowMap.type;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setClearColor(new THREE.Color(0xffffff));
    this.lights[0].target.position.copy(this.boundingSphere.center);
    this.lights[1].target.position.copy(this.boundingSphere.center);
    this.scene.add(tempCamera);
    if (this.accumlator.accumlateCount > 512) times = 1;
    for (let i=0; i<times; i++) {
      dir.set(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).setLength(this.boundingSphere.radius);
      this.lights[0].position.addVectors(this.boundingSphere.center, dir);
      this.lights[1].position.addVectors(this.boundingSphere.center, dir.negate());
      this.renderer.render(this.scene, tempCamera, this.renderTarget);
      this.accumlator.accumlate(this.renderTarget);
    }
    this.scene.remove(tempCamera);
    this.renderer.shadowMap.type = currentShadowMapType;
  }
  texture() {
    return this.accumlator.renderTarget.texture; 
  }
}

ShadowAccumlator.DepthMaterial = class extends THREE.ShaderMaterial {
  constructor(paramaters={}) {
    super();
    if (paramaters["useInstancedMatrix"]) {
      Object.assign(this.defines, {"INSTANCED_MATRIX" : 1});
      delete paramaters["useInstancedMatrix"];
    }
    this.uniforms = THREE.UniformsUtils.clone(THREE.ShaderLib.depth.uniforms);
    this.vertexShader = ShadowAccumlator.DepthMaterial.vertexShader();
    this.fragmentShader = ShadowAccumlator.DepthMaterial.fragmentShader();
    this.setValues(paramaters);
  }

  static vertexShader() {
    return `
#ifdef INSTANCED_MATRIX
  attribute vec4 imatx;
  attribute vec4 imaty;
  attribute vec4 imatz;
  attribute vec4 imatw;
  void main() { gl_Position = projectionMatrix * modelViewMatrix * mat4(imatx, imaty, imatz, imatw) * vec4(position.xyz, 1); }
#else
  void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xyz, 1); }
#endif
`;
  }

  static fragmentShader() {
    return "#include <packing> void main() { gl_FragColor = packDepthToRGBA( gl_FragCoord.z ); }";
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
    this.vertexShader = ShadowAccumlator.Material.vertexShader();
    this.fragmentShader = ShadowAccumlator.Material.fragmentShader();
    this.color = new THREE.Color( 0xffffff );
    this.emissive = new THREE.Color( 0x000000 );
    this.emissiveIntensity = 1.0;
    this.lights = true;
    this.setValues(paramaters);
  }

  static vertexShader() {
    return `
#define LAMBERT
#include <common>
#include <lights_pars_begin>
#include <shadowmap_pars_vertex>
attribute vec4 color;
#ifdef INSTANCED_MATRIX
  attribute vec4 imatx;
  attribute vec4 imaty;
  attribute vec4 imatz;
  attribute vec4 imatw;
#endif
varying vec3 vViewPosition;
varying vec4 vColor;
varying vec3 vLightFront;
varying vec3 vLightBack;

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
  #include <lights_lambert_vertex>
  #include <shadowmap_vertex>
  gl_Position = projectionMatrix * mvPosition;
}` 
  }

  static fragmentShader() {
    return `
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
varying vec3 vViewPosition;
varying vec4 vColor;
varying vec3 vLightFront;
varying vec3 vLightBack;
#include <common>
#include <packing>

#include <lights_pars_begin>
#include <shadowmap_pars_fragment>

float getShadowMask() {
  float shadow = 0.0;
  DirectionalLight directionalLight;
  #pragma unroll_loop
  for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
    directionalLight = directionalLights[ i ];
    shadow += bool( directionalLight.shadow ) ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 0.0;
  }
  return shadow;
}
void main() {
  //diffuse *= vColor; vColor.a
  vec3 outgoingLight = (( gl_FrontFacing ) ? vLightFront : vLightBack) * diffuse * getShadowMask() / PI + emissive;
  gl_FragColor = vec4( outgoingLight, opacity );
}` 
  }
}

