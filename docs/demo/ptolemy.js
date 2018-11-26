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
    option = option || {};

    // member valiables
    this._starttime = 0;
    this._prevtime = 0;
    this.paused = Boolean(option.paused);
    this.time = 0;
    this.deltaTime = 0;
    
    // create basic instance
    this.camera   = new THREE.PerspectiveCamera(30, 1, 0.1, 10000);
    this.scene    = new THREE.Scene();
    this.renderer = new THREE.WebGLRenderer();

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

  get cameraDistance() {
    return this.renderer.getSize().height * 0.5 / Math.tan(this.camera.fov * 0.008726646259971648);
  } 

  /** screen size */
  setSize(width, height) {
    this.screenSize = {"width":width||0, "height":height||0};
    this._adjustScreen();
  }

  /** start updating */
  start() {
    if (this._containerid) document.getElementById(this._containerid).appendChild(this.renderer.domElement);
    this._starttime = this._prevtime = performance.now();
    this._setup();
    this._loop();
  }

  _adjustScreen() {
    const dom = document.getElementById(this._containerid)
    const width  = this.screenSize.width  || dom.clientWidth,
          height = this.screenSize.height || dom.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
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

    this.renderer.gammaOutput = true;
    this.renderer.physicallyCorrectLights = true;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.sky = new THREE.Mesh(new THREE.BoxBufferGeometry(1,1,1));

    this.ambient = new THREE.AmbientLight(0xffffff, 0.5);
    this.light   = new THREE.DirectionalLight(0xffffff, 1.0);
    this.light.castShadow = true;
    this.light.shadow.radius = 3;
    this.light.shadow.mapSize.width = 1024;
    this.light.shadow.mapSize.height = 1024;
    this.light.position.set(0, 0, 250);
    this.floorLight = new THREE.DirectionalLight(0xffffff, 0.3);
    this.floorLight.position.set(0, 0, -1);

    this.camera.position.set(0, 0, this.cameraDistance);
    this.camera.lookAt(this.screenCenter);

    this.scene.add(this.ambient);
    this.scene.add(this.light);
    this.scene.add(this.floorLight);
    this.scene.add(this.camera);

    if (this.setup) this.setup(this);
  }

  _draw() {
    if (this.draw) this.draw(this);
    this.renderer.render(this.scene, this.camera);
  }
}


