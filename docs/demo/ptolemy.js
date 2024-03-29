class Ptolemy {
  /**
   * three.js wrapper comfortable for me
   * @param option.containerid container id to insert three.js screen, start automatically when this option is set
   * @param option.width screen width, undefined to fit client window
   * @param option.height screen height, undefined to fit client window
   * @param option.setup called at first of all
   * @param option.draw called on each frames
   * @param option.paused flag to paused start
   */
  constructor(option) {
    if ( !WEBGL.isWebGL2Available() ) {
      document.body.appendChild( WEBGL.getWebGL2ErrorMessage() );
      return;
    }

    option = option || {};

    // member valiables
    this._starttime = 0;
    this._prevtime = 0;
    this.paused = Boolean(option.paused);
    this.time = 0;
    this.deltaTime = 0;
    
    // create basic instance
    this.renderer = new THREE.WebGLRenderer();
    this.camera   = new THREE.PerspectiveCamera(30, 1, 1, 1000);
    this.scene    = new THREE.Scene();
    
    // other
    this.screenCenter = new THREE.Vector3(0,0,0);
    this.screenSize = {"width":option.width||0, "height":option.height||0};

    // start
    this._containerid = option.containerid || null;
    this.setup = option.setup || null;
    this.draw  = option.draw  || null;

    // insert screen and start automatically, when option.containerid in set
    if (this._containerid) {
      window.addEventListener("load", this.start.bind(this));
      window.addEventListener('resize', this._adjustScreen.bind(this));
    }
  }

  get domElement() {
    return (this._containerid) ? document.getElementById(this._containerid) : null;
  }

  render(renderTarget = null) {
    this.renderer.setRenderTarget(renderTarget);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
  }

  capture(downloadName=null, mimeType="image/jpeg") {
    this.render();
    const data = this.renderer.domElement.toDataURL(mimeType);
    if (downloadName) {
      const link = document.createElement('a');
      document.body.appendChild(link);
      link.download = downloadName;
      link.href = data;
      link.click();
      document.body.removeChild(link);
    } else {
      const newWindow = window.open("about:blank", "_blank");
      newWindow.document.write('<iframe src="' + data  + '" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>');
    }
  }

  newRenderTarget(options = {}) {
    const ratio = this.renderer.getPixelRatio(); 
    const size = this.renderer.getSize(new THREE.Vector2()).multiplyScalar(ratio);
    return new Ptolemy.WebGLSwitchableRenderTarget(size.width, size.height, options);
  }

  setCameraDistance(verticalSize, targetPosition, cameraDirection) {
    const size = this.renderer.getSize(new THREE.Vector2());
    const dist = (verticalSize || size.height) * 0.5 / Math.tan(this.camera.fov * 0.008726646259971648);
    const target = targetPosition || this.screenCenter;
    this.camera.lookAt(target);
    this.camera.position.copy(target);
    if (cameraDirection) cameraDirection.normalize();
    this.camera.position.addScaledVector(cameraDirection || new THREE.Vector3(0,0,-1), -dist);
  } 

  /** screen size */
  setSize(width, height) {
    this.screenSize = {"width":width||0, "height":height||0};
    this._adjustScreen();
  }

  /** start updating */
  start() {
    if (this._containerid) this.domElement.appendChild(this.renderer.domElement);
    this._starttime = this._prevtime = performance.now();
    this._setup();
    this._loop();
  }

  _adjustScreen() {
    const dom = this.domElement;
    const width  = this.screenSize.width  || dom.clientWidth,
          height = this.screenSize.height || dom.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(width, height);
  }

  _loop() {
    const now = performance.now();
    this.time      = (now - this._starttime) / 1000;
    this.deltaTime = (now - this._prevtime) / 1000;
    this._prevtime = now;
    if (!this.paused) this._draw();
    requestAnimationFrame(this._loop.bind(this));
  }

  _setup() {
    this._adjustScreen();

    this.renderer.antialias = true;
    this.renderer.gammaFactor = 2.2;
    this.renderer.gammaOutput = true;
    this.renderer.physicallyCorrectLights = true;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    //this.renderer.shadowMap.type = THREE.BasicShadowMap;

    this.setCameraDistance();

    this.ambient = new THREE.AmbientLight(0xffffff, 0.5);
    this.topLight = this.newShadowingDirectionalLight(1, 1, 1, 1024);
    this.scene.add(this.ambient);
    this.scene.add(this.topLight);
    this.scene.add(this.topLight.target);

    this.scene.add(this.camera);

    if (this.setup) this.setup(this);
  }

  newShadowingDirectionalLight(x, y, z, mapsize) {
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.castShadow = true;
    light.shadow.radius = 1;
    light.shadow.bias = -1/256;
    light.shadow.mapSize.width = mapsize;
    light.shadow.mapSize.height = mapsize;
    light.position.set(x,y,z);
    light.target.position.set(0,0,0);
    return light;
  }

  calcShadowingRange(light, sphere) {
    light.shadow.camera.bottom = -sphere.radius;
    light.shadow.camera.top    = +sphere.radius;
    light.shadow.camera.left   = -sphere.radius;
    light.shadow.camera.right  = +sphere.radius;
    light.shadow.camera.near   = 0.01;
    light.shadow.camera.far    = sphere.radius*2;
    light.shadow.camera.updateProjectionMatrix();
  }

  _draw() {
    if (this.draw)
      this.draw(this);
  }
}


// This is obviuosly dull implementation ...
// Official WebGLMultipleRenderTargets is quite stupid for me.
Ptolemy.WebGLSwitchableRenderTarget = class extends THREE.WebGLRenderTarget {

	constructor( width, height, options ) {

		super( width, height, options );

    const count = options.renderTargetCount || 1

		this.multipleTextures = [ this.texture ]

    for ( let i = 1; i < count; i ++ ) {

			this.multipleTextures[ i ] = this.texture.clone()

		}

    this.isWebGLMultipleRenderTargets = (count > 1)

  }

  // switcher
  set isWebGLMultipleRenderTargets(multiple) {

    this._isWebGLMultipleRenderTargets = multiple
    this.texture = multiple ? this.multipleTextures : this.multipleTextures[0]

  }

  get isWebGLMultipleRenderTargets() {

    return this._isWebGLMultipleRenderTargets

  }

  get isWebGLRenderTarget() {

    return !this._isWebGLMultipleRenderTargets

  }

	setSize( width, height, depth = 1 ) {

		if ( this.width !== width || this.height !== height || this.depth !== depth ) {

			this.width = width;
			this.height = height;
			this.depth = depth;

			for ( let i = 0; i < this.multipleTextures.length; i ++ ) {

				this.multipleTextures[ i ].image.width = width;
				this.multipleTextures[ i ].image.height = height;
				this.multipleTextures[ i ].image.depth = depth;

			}

			this.dispose();

		}

		this.viewport.set( 0, 0, width, height );
		this.scissor.set( 0, 0, width, height );

		return this;

	}

	copy( source ) {

		this.dispose();

		this.width = source.width;
		this.height = source.height;
		this.depth = source.depth;

		this.viewport.set( 0, 0, this.width, this.height );
		this.scissor.set( 0, 0, this.width, this.height );

		this.depthBuffer = source.depthBuffer;
		this.stencilBuffer = source.stencilBuffer;
		this.depthTexture = source.depthTexture;

    if (source.isWebGLSwitchableRenderTarget) {

      for ( let i = 0; i < source.multipleTextures.length; i ++ ) {

        this.multipleTextures[ i ] = source.multipleTextures[ i ].clone();
  
      }

      this.isWebGLMultipleRenderTargets = source.isWebGLMultipleRenderTargets;

    } else if (source.isWebGLMultipleRenderTargets) {

      for ( let i = 0; i < source.texture.length; i ++ ) {

        this.multipleTextures[ i ] = source.texture[ i ].clone();
  
      }

      this.isWebGLMultipleRenderTargets = true;

    } else {

      this.multipleTextures[ 0 ] = source.texture.clone();
      this.isWebGLMultipleRenderTargets = false;

    }

		return this;

	}

}

Ptolemy.WebGLSwitchableRenderTarget.prototype.isWebGLSwitchableRenderTarget = true