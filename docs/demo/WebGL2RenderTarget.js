/** extention of THREE.WebGLRenderTarget with MRT */
class WebGL2RenderTarget extends THREE.WebGLRenderTarget {
  get isWebGL2RenderTarget() { return true; }


  /** almost same with THREE.WebGLRenderTarget, except for the 1st argument
   *  @param {THREE.WebGLRenderer} renderer WebGLRenderer to allocate frame buffer
   *  @param {number} same as THREE.WebGLRenderTarget
   *  @param {number} same as THREE.WebGLRenderTarget
   *  @param {object} same as THREE.WebGLRenderTarget
   */
  constructor( renderer, width, height, options ) {
    super( width, height, options );

    // check support
    if (this.isWebGLRenderTargetCube)
      throw new Error("WebGL2RenderTarget: Cube render target not supported");
    if (!THREE.Math.isPowerOfTwo( this )) 
      throw new Error("WebGL2RenderTarget: texture without power of two width is not supported");

    // use threejs utility
    if (!WebGL2RenderTarget.utils) 
      WebGL2RenderTarget.utils = new THREE.WebGLUtils();

    // listen dispose event
    this.addEventListener( 'dispose', this._onDispose.bind(this) );

    // try to create frame buffer here (created at WebGLRenderer in three.js's default implement)
    this.renderer = renderer;
    const gl = this.renderer.context;
    const renderTargetProperties = this.renderer.properties.get( this );

    // create new framebuffer
    renderTargetProperties.__webglFramebuffer = gl.createFramebuffer();

    /**/// TODO: MRT here !!
    const textureProperties = this.renderer.properties.get( this.texture );

    // create texture
    textureProperties.__webglTexture = gl.createTexture();
    this.renderer.info.memory.textures ++;

    // setup color buffer
    this.renderer.state.bindTexture( gl.TEXTURE_2D, textureProperties.__webglTexture );
    this._setTextureParameters( gl.TEXTURE_2D, this.texture );
    this._setupFrameBufferTexture( renderTargetProperties.__webglFramebuffer, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D );


    // create mipmap if required
    if ( this.texture.generateMipmaps &&
         this.texture.minFilter !== NearestFilter && this.texture.minFilter !== LinearFilter) 
      this._generateMipmap( gl.TEXTURE_2D, this.texture, this.width, this.height );

    this.renderer.state.bindTexture( gl.TEXTURE_2D, null );

    // Setup depth and stencil buffers
    if ( this.depthBuffer ) 
      this._setupDepthRenderbuffer();
  }


  _onDispose( event ) {
    console.warn("WebGL2RenderTarget: dispose not impelented.");
  }


  _setTextureParameters( textureType, texture ) {
    const gl = this.renderer.context,
          utils = WebGL2RenderTarget.utils;
    gl.texParameteri( textureType, gl.TEXTURE_WRAP_S, utils.convert( texture.wrapS ) );
    gl.texParameteri( textureType, gl.TEXTURE_WRAP_T, utils.convert( texture.wrapT ) );
    gl.texParameteri( textureType, gl.TEXTURE_MAG_FILTER, utils.convert( texture.magFilter ) );
    gl.texParameteri( textureType, gl.TEXTURE_MIN_FILTER, utils.convert( texture.minFilter ) );
  }


  _setupFrameBufferTexture( framebuffer, attachment, textureTarget ) {
    const gl = this.renderer.context,
          utils = WebGL2RenderTarget.utils,
          glFormat = utils.convert( this.texture.format ),
          glType = utils.convert( this.texture.type ),
          glInternalFormat = this._getInternalFormat( glFormat, glType );
    this.renderer.state.texImage2D( textureTarget, 0, glInternalFormat, this.width, this.height, 0, glFormat, glType, null );
    gl.bindFramebuffer( gl.FRAMEBUFFER, framebuffer );
    gl.framebufferTexture2D( gl.FRAMEBUFFER, attachment, textureTarget, this.renderer.properties.get( this.texture ).__webglTexture, 0 );
    gl.bindFramebuffer( gl.FRAMEBUFFER, null );

  }


  _getInternalFormat( glFormat, glType ) {
    const gl = this.renderer.context;
    let prop = "";
         if ( glFormat === gl.RED ) prop = "R";
    else if ( glFormat === gl.RGB ) prop = "RGB";
    else if ( glFormat === gl.RGBA ) prop = "RGBA";
    else return glFormat;
         if ( glType === gl.FLOAT ) prop += "32F";
    else if ( glType === gl.HALF_FLOAT ) prop += "16F";
    else if ( glType === gl.UNSIGNED_BYTE ) prop += "8";
    else return glFormat;
    return this.renderer.context[prop];
  }


  _generateMipmap( target, texture, width, height ) {
    this.renderer.context.generateMipmap( target );
    const textureProperties = this.renderer.properties.get( texture );
    textureProperties.__maxMipLevel = Math.log( Math.max( width, height ) ) * Math.LOG2E;
  }


  _setupDepthRenderbuffer() {
    const gl = this.renderer.context,
          renderTargetProperties = this.renderer.properties.get( this );

    if ( this.depthTexture ) {
      this._setupDepthTexture( renderTargetProperties.__webglFramebuffer );
    } else {
      gl.bindFramebuffer( gl.FRAMEBUFFER, renderTargetProperties.__webglFramebuffer );
      renderTargetProperties.__webglDepthbuffer = gl.createRenderbuffer();
      this._setupRenderBufferStorage( renderTargetProperties.__webglDepthbuffer );
    }

    gl.bindFramebuffer( gl.FRAMEBUFFER, null );
  }


  _setupDepthTexture( framebuffer ) {
    const gl = this.renderer.context;

    gl.bindFramebuffer( gl.FRAMEBUFFER, framebuffer );

    if ( ! ( this.depthTexture && this.depthTexture.isDepthTexture ) ) 
      throw new Error( 'this.depthTexture must be an instance of THREE.DepthTexture' );

    // upload an empty depth texture with framebuffer size
    if ( ! this.renderer.properties.get( this.depthTexture ).__webglTexture ||
        this.depthTexture.image.width  !== this.width ||
        this.depthTexture.image.height !== this.height ) {
      this.depthTexture.image.width = this.width;
      this.depthTexture.image.height = this.height;
      this.depthTexture.needsUpdate = true;
    }

    this.renderer.setTexture2D( this.depthTexture, 0 );

    const webglDepthTexture = properties.get( this.depthTexture ).__webglTexture;
    if ( this.depthTexture.format === THREE.DepthFormat ) 
      gl.framebufferTexture2D( gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, webglDepthTexture, 0 );
    else if ( this.depthTexture.format === THREE.DepthStencilFormat )
      gl.framebufferTexture2D( gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.TEXTURE_2D, webglDepthTexture, 0 );
    else
      throw new Error( 'Unknown depthTexture format' );
  }


  _setupRenderBufferStorage( renderbuffer ) {
    const gl = this.renderer.context;

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
