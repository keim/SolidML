/** extention of THREE.WebGLRenderTarget with MRT */
class WebGL2RenderTarget extends THREE.WebGLRenderTarget {
  /** returns true if this is instance of WebGL2RenderTarget */
  get isWebGL2RenderTarget() {
    return true;
  }


  /** same as THREE.WebGLRenderTarget, supports option.multipleRenderTargets
   *  @param {number} same as THREE.WebGLRenderTarget
   *  @param {number} same as THREE.WebGLRenderTarget
   *  @param {object} same as THREE.WebGLRenderTarget. set { multipleRenderTargets:true, renderTargetCount:4 } to use MRT with specifyed texture number.
   */
  constructor( width, height, options ) {
    super( width, height, options );

    // check support
    if ( this.isWebGLRenderTargetCube )
      throw new Error("WebGL2RenderTarget: Cube render target not supported");

    // listen dispose event
    this.addEventListener( 'dispose', this._onDispose.bind(this) );

    // MRT settings
    options = options || {};
    /** 
     * flag to use multiple render targets
     * @type {boolean}
     */
    this.multipleRenderTargets = options.multipleRenderTargets || false;
    /** 
     * render target count to use
     * @type {int}
     */
    this.renderTargetCount = options.renderTargetCount || 1;
    /** 
     * array of THREE.Texture used for MRT, the length is WebGL2RenderTarget.renderTargetCount. the first element is WebGL2RenderTarget.texture
     * @type {Array.<THREE.Texture>}
     */
    this.textures = [this.texture];

    // create textures
    if (this.multipleRenderTargets) 
      for ( let i = 1; i < this.renderTargetCount; i++ ) 
        this.textures.push(new THREE.Texture().copy(this.texture));
  }


  isPowerOfTwo() {
    return ( THREE.Math.isPowerOfTwo( this.width ) && THREE.Math.isPowerOfTwo( this.height ) );
  }


  _onDispose( event ) {
    console.warn("WebGL2RenderTarget: dispose not impelented.");
  }


  _setupIfNeeded( renderer ) {
    const gl = renderer.context;
    const renderTargetProperties = renderer.properties.get( this );

    // 
    if (renderTargetProperties.__webglFramebuffer)
      return;

    // check render target capacity 
    if ( this.renderTargetCount > gl.getParameter(gl.MAX_DRAW_BUFFERS) )  
      throw new Error("WebGL2RenderTarget: renderTargetCount is over system capacity. " + gl.getParameter(gl.MAX_DRAW_BUFFERS) + " buffers @ max.");

    // use threejs utility inside
    if ( !WebGL2RenderTarget._utils ) 
      WebGL2RenderTarget._utils = new THREE.WebGLUtils();

    // create new framebuffer
    renderTargetProperties.__webglFramebuffer = gl.createFramebuffer();

    // setup color buffer
    if ( this.multipleRenderTargets ) {
      // create webgl textures
      for ( let i = 0; i < this.renderTargetCount; i++ ) 
        this._setupColorBuffer( renderer, this.textures[i], i, renderTargetProperties.__webglFramebuffer );
      // draw buffers
      gl.bindFramebuffer(gl.FRAMEBUFFER, renderTargetProperties.__webglFramebuffer);
      gl.drawBuffers(this.textures.map(( texture, i )=>( gl.COLOR_ATTACHMENT0 + i)));
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    } else {
      this._setupColorBuffer( renderer, this.texture, 0, renderTargetProperties.__webglFramebuffer );
    }

    renderer.state.bindTexture( gl.TEXTURE_2D, null );

    // Setup depth and stencil buffers
    if ( this.depthBuffer ) 
      this._setupDepthRenderbuffer(renderer);
  }


  _setupColorBuffer( renderer, texture, attachIndex, framebuffer ) {
    const gl = renderer.context,
          webGLTexture = gl.createTexture(),
          textureProperties = renderer.properties.get( texture );
    // create webgl texture
    textureProperties.__webglTexture = webGLTexture;
    renderer.info.memory.textures ++;
    // setup color buffer
    renderer.state.bindTexture( gl.TEXTURE_2D, webGLTexture );
    this._setTextureParameters( gl, gl.TEXTURE_2D, texture );
    this._setupFrameBufferTexture( renderer, framebuffer, gl.COLOR_ATTACHMENT0 + attachIndex, gl.TEXTURE_2D, webGLTexture );
    // create mipmap if required
    if ( texture.generateMipmaps && this.isPowerOfTwo() && 
         texture.minFilter !== NearestFilter && texture.minFilter !== LinearFilter ) 
      this._generateMipmap( renderer, gl.TEXTURE_2D, texture, this.width, this.height );
  }


  _setTextureParameters( gl, textureType, texture ) {
    const utils = WebGL2RenderTarget._utils;
    if (this.isPowerOfTwo()) {
      _gl.texParameteri( textureType, _gl.TEXTURE_WRAP_S, _gl.CLAMP_TO_EDGE );
      _gl.texParameteri( textureType, _gl.TEXTURE_WRAP_T, _gl.CLAMP_TO_EDGE );
      if ( texture.wrapS !== ClampToEdgeWrapping || texture.wrapT !== ClampToEdgeWrapping ) 
        console.warn( 'THREE.WebGL2Renderer: Texture is not power of two. Texture.wrapS and Texture.wrapT should be set to THREE.ClampToEdgeWrapping.' );
      if (texture.minFilter !== NearestFilter && texture.minFilter !== LinearFilter ) 
        console.warn( 'THREE.WebGL2Renderer: Texture is not power of two. Texture.minFilter should be set to THREE.NearestFilter or THREE.LinearFilter.' );
    } else {
      gl.texParameteri( textureType, gl.TEXTURE_WRAP_S, utils.convert( texture.wrapS ) );
      gl.texParameteri( textureType, gl.TEXTURE_WRAP_T, utils.convert( texture.wrapT ) );
    }
    gl.texParameteri( textureType, gl.TEXTURE_MAG_FILTER, utils.convert( texture.magFilter ) );
    gl.texParameteri( textureType, gl.TEXTURE_MIN_FILTER, utils.convert( texture.minFilter ) );
  }


  _setupFrameBufferTexture( renderer, framebuffer, attachment, textureTarget, texture ) {
    const gl = renderer.context,
          utils = WebGL2RenderTarget._utils,
          glFormat = utils.convert( this.texture.format ),
          glType = utils.convert( this.texture.type ),
          glInternalFormat = this._getInternalFormat( renderer, glFormat, glType );
    renderer.state.texImage2D( textureTarget, 0, glInternalFormat, this.width, this.height, 0, glFormat, glType, null );
    gl.bindFramebuffer( gl.FRAMEBUFFER, framebuffer );
    gl.framebufferTexture2D( gl.FRAMEBUFFER, attachment, textureTarget, texture, 0 );
    gl.bindFramebuffer( gl.FRAMEBUFFER, null );
  }


  _generateMipmap( renderer, target, texture, width, height ) {
    renderer.context.generateMipmap( target );
    const textureProperties = renderer.properties.get( texture );
    textureProperties.__maxMipLevel = Math.log( Math.max( width, height ) ) * Math.LOG2E;
  }


  _setupDepthRenderbuffer( renderer ) {
    const gl = renderer.context,
          renderTargetProperties = renderer.properties.get( this );

    gl.bindFramebuffer( gl.FRAMEBUFFER, renderTargetProperties.__webglFramebuffer );

    if ( this.depthTexture ) {
      this._setupDepthTexture( renderer, renderTargetProperties.__webglFramebuffer );
    } else {
      renderTargetProperties.__webglDepthbuffer = gl.createRenderbuffer();
      this._setupRenderBufferStorage( renderer, renderTargetProperties.__webglDepthbuffer );
    }

    gl.bindFramebuffer( gl.FRAMEBUFFER, null );
  }


  _getInternalFormat( renderer, glFormat, glType ) {
    const gl = renderer.context;
    let prop = "";
         if ( glFormat === gl.RED ) prop = "R";
    else if ( glFormat === gl.RGB ) prop = "RGB";
    else if ( glFormat === gl.RGBA ) prop = "RGBA";
    else return glFormat;
         if ( glType === gl.FLOAT ) prop += "32F";
    else if ( glType === gl.HALF_FLOAT ) prop += "16F";
    else if ( glType === gl.UNSIGNED_BYTE ) prop += "8";
    else return glFormat;
    return renderer.context[prop];
  }


  _setupDepthTexture( renderer, framebuffer ) {
    const gl = renderer.context;

    if ( ! ( this.depthTexture && this.depthTexture.isDepthTexture ) ) 
      throw new Error( 'this.depthTexture must be an instance of THREE.DepthTexture' );

    // upload an empty depth texture with framebuffer size
    if ( ! renderer.properties.get( this.depthTexture ).__webglTexture ||
        this.depthTexture.image.width  !== this.width ||
        this.depthTexture.image.height !== this.height ) {
      this.depthTexture.image.width = this.width;
      this.depthTexture.image.height = this.height;
      this.depthTexture.needsUpdate = true;
    }

    renderer.setTexture2D( this.depthTexture, 0 );

    const webglDepthTexture = properties.get( this.depthTexture ).__webglTexture;
    if ( this.depthTexture.format === THREE.DepthFormat ) 
      gl.framebufferTexture2D( gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, webglDepthTexture, 0 );
    else if ( this.depthTexture.format === THREE.DepthStencilFormat )
      gl.framebufferTexture2D( gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.TEXTURE_2D, webglDepthTexture, 0 );
    else
      throw new Error( 'Unknown depthTexture format' );
  }


  _setupRenderBufferStorage( renderer, renderbuffer ) {
    const gl = renderer.context;

    gl.bindRenderbuffer( gl.RENDERBUFFER, renderbuffer );

    if ( this.depthBuffer && ! this.stencilBuffer ) {
      gl.renderbufferStorage( gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this.width, this.height );
      gl.framebufferRenderbuffer( gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderbuffer );
    } else if ( this.depthBuffer && this.stencilBuffer ) {
      gl.renderbufferStorage( gl.RENDERBUFFER, gl.DEPTH_STENCIL, this.width, this.height );
      gl.framebufferRenderbuffer( gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, renderbuffer );
    } else {
      // FIXME: We don't support !depth !stencil
      gl.renderbufferStorage( gl.RENDERBUFFER, gl.RGBA4, this.width, this.height );
    }

    gl.bindRenderbuffer( gl.RENDERBUFFER, null );
  }
}
