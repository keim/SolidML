/** Ultimately simple implementation to use WebGL2 in three.js ! */
 class WebGL2Renderer {
  constructor( parameters ) {
    const canvas  = document.createElement( 'canvas' ),
          context = canvas.getContext( 'webgl2' );
    THREE.WebGLRenderer.call( this, Object.assign({ canvas, context }, parameters) );
  }
}
