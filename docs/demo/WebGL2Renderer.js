/** to use WebGL2 MRT from three.js */
 class WebGL2Renderer {
  /** same as WebGLRenderer, cutomize to use WebGL2RenderTarget inside */
  constructor( parameters ) {
    const canvas  = document.createElement( 'canvas' ),
          context = canvas.getContext( 'webgl2' );
    THREE.WebGLRenderer.call( this, Object.assign({ canvas, context }, parameters) );
    // override render()
    this._render_original = this.render;
    this.render = this._render_override.bind(this);
  }


  // override function of render()
  _render_override( scene, camera, renderTarget, forceClear ) {
    if (renderTarget && renderTarget.isWebGL2RenderTarget) {
      renderTarget._setupIfNeeded(this);
    }
    this._render_original( scene, camera, renderTarget, forceClear );
  }
}
