class ReflectiveShadowMap {
  constructor() {
    
  }
}
/*
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

    const rsm_packing = [ // packing functions for reflective shadow map
      "float unpackRGBAToRSMDepth(const in vec4 v) {",
        "return v.z * 255. / 65536. + v.w;",
      "}",
      "vec4 unpackRGBAToRSMAlbedo(const in vec4 v) {",
        "vec2 w = v.xy * 255. / 16.;",
        "return vec4(floor(w.x), fract(w.x)*16., floor(w.y), fract(w.y)*16.) / 15.;",
      "}",
      "vec4 packRSMtoRGBA(const in float depth, const in vec4 albedo, const in float glow){",
        "vec4 r = vec4(",
          "(floor(albedo.x * 15.) * 16. + floor(albedo.y * 15.)) / 256.,",
          "(floor(albedo.z * 15.) * 16. + floor(albedo.w * 15.)) / 256.,",
          "fract(depth*256.), depth);",
        "r.w -= r.z * ShiftRight8; // tidy overflow",
        "return r * PackUpscale;",
      "}"
    ].join("\n");
    const rsm_pars_fragment = [
      "#ifdef USE_SHADOWMAP",
        "#if NUM_DIR_LIGHTS > 0",
          "uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHTS ];",
          "varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHTS ];",
        "#endif",
        "#if NUM_SPOT_LIGHTS > 0",
          "uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHTS ];",
          "varying vec4 vSpotShadowCoord[ NUM_SPOT_LIGHTS ];",
        "#endif",
        "#if NUM_POINT_LIGHTS > 0",
          "uniform sampler2D pointShadowMap[ NUM_POINT_LIGHTS ];",
          "varying vec4 vPointShadowCoord[ NUM_POINT_LIGHTS ];",
        "#endif",
        "float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {",
          "return step( compare, unpackRGBAToRSMDepth( texture2D( depths, uv ) ) );",
        "}",
        "float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowBias, float shadowRadius, vec4 shadowCoord ) {",
          "float shadow = 1.0;",
          "vec4 v;",
          "shadowCoord.xyz /= shadowCoord.w;",
          "shadowCoord.z += shadowBias;",
          "bool inFrustum = all(bvec4(shadowCoord.x >= 0.0, shadowCoord.x <= 1.0, shadowCoord.y >= 0.0, shadowCoord.y <= 1.0));",
          "if (all(bvec2(inFrustum, shadowCoord.z <= 1.0))) {",
            "#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT )",
              "float texelSize = 1. / shadowMapSize.x;",
              "vec3 d = vec3(-texelSize, texelSize, 0)*shadowRadius;",
              "shadow = (",
                "texture2DCompare( shadowMap, shadowCoord.xy + d.xz, shadowCoord.z ) +",
                "texture2DCompare( shadowMap, shadowCoord.xy + d.zx, shadowCoord.z ) +",
                "texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +",
                "texture2DCompare( shadowMap, shadowCoord.xy + d.yz, shadowCoord.z ) +",
                "texture2DCompare( shadowMap, shadowCoord.xy + d.zy, shadowCoord.z )",
              ") * ( 1.0 / 5.0 );",
            "#else // no percentage-closer filtering:",
              "shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );",
            "#endif",
          "}",
          "return shadow;",
        "}",
        "vec2 cubeToUV( vec3 v, float texelSizeY ) { return vec2(0); }",
      "#endif"
    ].join("\n");
    const shader = {
      "depthVert" : [
        include([
          "common",
          "uv_pars_vertex",
          "displacementmap_pars_vertex",
          "morphtarget_pars_vertex",
          "skinning_pars_vertex",
          "logdepthbuf_pars_vertex",
          "clipping_planes_pars_vertex",
          "uv_vertex",
          "skinbase_vertex"
        ]),
        "attribute vec4 color;",
        "varying vec4 vColor;",
        "void main() {",
          "vColor = color;",
          "#ifdef USE_DISPLACEMENTMAP",
          include([
            "beginnormal_vertex",
            "morphnormal_vertex",
            "skinnormal_vertex"
          ]),
          "#endif",
          include([
            "begin_vertex",
            "morphtarget_vertex",
            "skinning_vertex",
            "displacementmap_vertex",
            "project_vertex",
            "logdepthbuf_vertex",
            "clipping_planes_vertex"
          ]),
        "}"
      ].join("\n"), 
      "depthFrag" : [
        "#if DEPTH_PACKING == 3200",
          "uniform float opacity;",
        "#endif",
        "varying vec4 vColor;",
        include([
          "common",
          "packing",
          "uv_pars_fragment",
          "map_pars_fragment",
          "alphamap_pars_fragment",
          "logdepthbuf_pars_fragment",
          "clipping_planes_pars_fragment"
        ]),
        rsm_packing,
        "void main() {",
          include([
            "clipping_planes_fragment"
          ]),
          "vec4 diffuseColor = vec4( 1.0 );",
          "#if DEPTH_PACKING == 3200",
            "diffuseColor.a = opacity;",
          "#endif",
          include([
            "map_fragment",
            "alphamap_fragment",
            "alphatest_fragment",
            "logdepthbuf_fragment"
          ]),
          "#if DEPTH_PACKING == 3200",
            "gl_FragColor = vec4( vec3( 1.0 - (gl_FragCoord.z) ), opacity );",
          "#elif DEPTH_PACKING == 3201",
            "gl_FragColor = packRSMtoRGBA( gl_FragCoord.z, vColor, 0.);",
          "#endif",
        "}"
      ].join("\n")
    };

*/