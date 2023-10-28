#ifdef GL_ES
precision mediump float;
#endif

varying vec2 v_uv;

uniform sampler2D u_sceneTex;
uniform sampler2D u_gradientTex;
uniform sampler2D u_flowTex1;
uniform sampler2D u_flowTex2;
uniform sampler2D u_curlTex;
uniform sampler2D u_inputTex;

uniform sampler2D u_buffer0;
uniform sampler2D u_buffer1;

uniform vec2 u_resolution;
uniform float u_time;

uniform vec2 u_pos;
uniform float u_rot;
uniform float u_thickness;
uniform float u_rect_dist_strength;
uniform float u_scale;
uniform float u_size_scale;
uniform float u_size;
uniform float u_alpha_mult;
uniform float u_depth_amt;
uniform float u_depth_res;
uniform float u_depth_thickness;
uniform float u_stop_fb;
uniform float u_seed;
uniform float u_margin;

#include "../../../../../lygia/color/blend/add.glsl"
#include "../../../../../lygia/color/blend/color.glsl"
#include "../../../../../lygia/color/blend/colorDodge.glsl"
#include "../../../../../lygia/color/blend/difference.glsl"
#include "../../../../../lygia/color/blend/exclusion.glsl"
#include "../../../../../lygia/color/blend/hue.glsl"
#include "../../../../../lygia/color/blend/luminosity.glsl"
#include "../../../../../lygia/color/blend/negation.glsl"
#include "../../../../../lygia/color/blend/saturation.glsl"
#include "../../../../../lygia/color/space/hsv2rgb.glsl"
#include "../../../../../lygia/color/space/rgb2hsv.glsl"
#include "../../../../../lygia/generative/curl.glsl"
#include "../../../../../lygia/generative/gnoise.glsl"
#include "../../../../../lygia/generative/random.glsl"
#include "../../../../../lygia/generative/snoise.glsl"
#include "../../../../../lygia/math/aastep.glsl"
#include "../../../../../lygia/math/const.glsl"
#include "../../../../../lygia/math/map.glsl"

#define CENTER_2D vec2(0.5, 0.5)
#include "../../../../../lygia/space/scale.glsl"
#include "cell2d.frag"
#include "spectral.glsl"

// vec3 blendHue(vec3 base, vec3 blend, float opacity) {
//   vec3 baseHSL = rgb2hsv(base);
//   vec3 blendHSL = rgb2hsv(blend);
//   return hsv2rgb(
//       vec3(mix(baseHSL.x, blendHSL.x, opacity), baseHSL.y, baseHSL.z));
// }

float rect(in vec2 _st, in vec2 _size, float smoothness) {
  _size = vec2(0.5) - _size * 0.5;
  float smoothing = smoothness;  // 0.001

  vec2 uv = smoothstep(_size, _size + vec2(smoothing), _st);
  uv *= smoothstep(_size, _size + vec2(smoothing), vec2(1.0) - _st);
  return uv.x * uv.y;
}

mat2 rotate2d(float _angle) {
  return mat2(cos(_angle), -sin(_angle), sin(_angle), cos(_angle));
}

vec3 flow_tex(vec2 uv, vec2 frequency, float seed) {
  vec2 c_uv = uv * vec2(1., 2.);
  vec2 freq = frequency * u_resolution;
  vec3 curl_n = curl(vec3(c_uv * freq + vec2(1.), 0.));
  float p = snoise(vec3(c_uv * 1000. + vec2(seed * 100.), 0.));
  curl_n += vec3(p);
  vec2 cell = cell2d(c_uv * 1.);
  curl_n += cell.r;
  return curl_n;
}

vec3 perlin_tex(vec2 uv, float seed) {
  vec2 n_scale = vec2(200., 20.);
  float perlin_r = snoise(vec2(uv * n_scale + vec2(seed * 10.)));
  n_scale = vec2(20., 20.);
  float perlin_g = snoise(vec2(uv * n_scale + vec2(seed * 10.)));
  float perlin_b = snoise(vec2(uv + vec2(seed * 10.)));
  vec3 perlin = vec3(perlin_r, perlin_g, perlin_b);
  return perlin;
}

vec3 curl_tex(vec2 uv, float time, float seed) {
  vec2 freq = vec2(1., 1.) * 1.3 * 1.;
  vec2 t = vec2(time * 1000.) * .2;
  vec2 offset = vec2(seed * 100.);
  vec2 curl_uv = fract(uv * freq + offset + t);
  vec3 curl_n = curl(vec3(curl_uv, time * 100.));
  float curl_r = curl_n.r * curl_n.b;
  float curl_g = curl_n.g;
  float curl_b = curl_n.b;
  return vec3(curl_r, curl_g, curl_n.z);
}

vec3 ptdepth(sampler2D tInput, vec2 coords, float res, float thickness) {
  vec2 onePixel = vec2(1.0 / res, 1.0 / res);
  vec4 color;
  color.rgb = vec3(0.);
  color -= texture(tInput, coords - onePixel) * thickness;
  color += texture(tInput, coords + onePixel) * thickness;
  color.rgb = vec3((color.r + color.g + color.b) / 6.0);
  return color.rgb;
}

const int NUM_SPLATTERS_LAYERS = 5;
const int MAGIC_BOX_ITERS = 13;
const float MAGIC_BOX_MAGIC = 0.55;
float magicBox(vec3 p) {
  // The fractal lives in a 1x1x1 box with mirrors on all sides.
  // Take p anywhere in space and calculate the corresponding position
  // inside the box, 0<(x,y,z)<1
  p = 1.0 - abs(1.0 - mod(p, 2.0));

  float lastLength = length(p);
  float tot = 0.0;
  // This is the fractal.  More iterations gives a more detailed
  // fractal at the expense of more computation.
  for (int i = 0; i < MAGIC_BOX_ITERS; i++) {
    // The number subtracted here is a "magic" paremeter that
    // produces rather different fractals for different values.
    p = abs(p) / (lastLength * lastLength) - MAGIC_BOX_MAGIC;
    float newLength = length(p);
    tot += abs(newLength - lastLength);
    lastLength = newLength;
  }

  return tot;
}

// A random 3x3 unitary matrix, used to avoid artifacts from slicing the
// volume along the same axes as the fractal's bounding box.
const mat3 M =
    mat3(0.28862355854826727, 0.6997227302779844, 0.6535170557707412,
         0.06997493955670424, 0.6653237235314099, -0.7432683571499161,
         -0.9548821651308448, 0.26025457467376617, 0.14306504491456504);

void main() {
  vec4 color = vec4(vec3(0.0), 1.);
  float alpha = 0.0;
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float time = u_time;
  float seed = u_seed;
  vec2 pixel = 1.0 / u_resolution;

#ifdef BUFFER_0

  float x_factor = uv.x;  // smoothstep(.1, .75, uv.x);

  // PREVIOUS FRAME
  vec4 prev = texture2D(u_buffer1, uv);
  vec3 prev_color = prev.rgb;
  float prev_alpha = prev.a;

  float steps = 10.;
  float offset = 0.;
  vec2 dist_uv =
      uv + snoise(vec3(uv * 1., seed * 500.)) * mix(.0, .0, x_factor);
  float border_mask = rect(dist_uv, vec2(1. - u_margin), .15);
  vec2 stepped_uv =
      mix(uv, floor((dist_uv + vec2(offset)) * steps) / steps, border_mask);
  stepped_uv = vec2(stepped_uv.x, 0.);
  vec3 curl1 = texture2D(u_flowTex1, stepped_uv)
                   .rgb;  // flow_tex(uv, vec2(.0025), seed);
  // curl1 = flow_tex(uv, vec2(.0025), seed);
  vec3 curl2 = texture2D(u_flowTex2, stepped_uv)
                   .rgb;  // flow_tex(uv, vec2(.002, .08), seed);
  // curl2 = flow_tex(uv, vec2(.002, .08), seed);
  // vec3 curl = normalize(mix(curl1, curl2, snoisePertub1));

  float prevPertubScl = curl2.g * 5. * map(curl2.b, 0., 1., -1., 1.);
  float shakeSpeed = map(prev_alpha, 0., 1., 50000., 100000.);

  float snoisePertub1 = perlin_tex(uv * .1 / 16., seed).r;
  float t_curl_scl = mix(40., 80., snoisePertub1);
  vec3 tCurl = texture2D(u_curlTex,
                         uv * t_curl_scl + 1. * vec2(time / 2000. * shakeSpeed))
                   .rgb;
  // tCurl = curl_tex(uv + time * shakeSpeed, time, seed);
  float prevuvPertubX = map(tCurl.r, 0., 1., -1., 1.) * prevPertubScl;
  float prevuvPertubY = map(tCurl.g, 0., 1., -1., 1.) * prevPertubScl;
  vec2 prevScaleDir = vec2(prevuvPertubX, prevuvPertubY) * 1.2;

  float prevScaleComp = curl1.r + 0.0005;
  vec2 u_PushForce = vec2(3.1014, 1.0577);
  vec2 pushForce = mix(-u_PushForce, u_PushForce, curl2.r) * .1;
  vec2 prevScale = vec2(prevScaleComp, prevScaleComp * curl1.g) * pushForce;

  vec2 force1 = texture2D(u_gradientTex, prev_color.rb).rb * 5.;
  vec2 force2 = curl2.rg * 1.02 * map(curl1.b, 0., 1., .1, 1.);

  // vec2 pivot =
  //     flow_tex(uv + vec2(stepped_uv.y, 0.), vec2(.0025), seed).rg * 3.9;
  vec2 pivot = flow_tex(uv + stepped_uv.y, vec2(.0025), seed).rg * 3.9;

  vec2 prevuv = scale(uv, prevScale + prevScaleDir + force1 * force2, pivot);

  // prevuv = scale(uv, .9, pivot);

  float prevuvMixFactorScl = .00005;
  float prevuvMixFactor =
      .000001 + texture2D(u_buffer1, prevuv).a * prevuvMixFactorScl;

  prevuv = mix(uv, prevuv, prevuvMixFactor * border_mask);
  prevuv = clamp(prevuv, 0., 1.);
  prev_color = texture2D(u_buffer1, prevuv).rgb;
  prev_alpha = texture2D(u_buffer1, prevuv).a;

  // prevuv = scale(uv, test_pivot.r, vec2(.5));
  // prev_color = texture2D(u_buffer1, prevuv).rgb;
  // prev_alpha = texture2D(u_buffer1, uv).a;

  // RECTS
  vec2 center = vec2(.5);
  alpha = 0.;
  float size = u_size_scale;
  float thickness = mix(20., 100., 1.) * .00025 * 1.;
  float height = size;
  vec2 outer_size = vec2(size, height);
  vec2 inner_size = vec2(outer_size.x - thickness, outer_size.y - thickness);
  float x = u_pos.x + outer_size.x * .5;
  float y = u_pos.y + outer_size.y * .5;
  vec2 pos = vec2(x, y);
  pos -= center;
  vec2 st = dist_uv;
  st -= pos;
  st -= center;
  st = rotate2d(u_rot) * st;                         /// * vec2(1., .5625);
  st *= u_size * vec2(10., .1) * mix(.5, .1, uv.x);  // mix(.5, .5, x_factor);
  st += center;
  // st += snoise(vec3(uv * 10., u_time * 0.)) * mix(0., 0.0, x_factor);

  float smoothness = .002;
  float shape = rect(st, outer_size, smoothness);
  shape -= rect(st, inner_size, smoothness);

  // color.rgb = vec3(shape) * u_alpha_mult;
  float r_stepped = random(stepped_uv);
  vec3 r_s_c = texture2D(u_gradientTex, vec2(r_stepped, .5)).rgb;
  color.rgb = mix(vec3(0.), r_s_c, shape * u_alpha_mult);
  alpha += shape * 10.;  // map(cos(u_time * .1), -1., 1., 0., 3.);
  // color.rgb = texture2D(u_inputTex, uv).rgb;  // * u_alpha_mult;
  // alpha += color.r * 3.;

  color.rgb += blendDifference(prev_color, color.rgb, 1.);
  // color.rgb += prev_color * 1.;
  // color.rgb = mix(prev_color, color.rgb, .01);
  alpha += prev_alpha;
  color.a = alpha;

  // color.rgb = vec3(stepped_uv, .1);
  // color.rgb = vec3(border_mask);

  if (u_stop_fb == 1.) {
    color = texture2D(u_buffer1, uv);
  }

  // // color.a = alpha;
  // color = texture2D(u_inputTex, uv);

#elif defined(BUFFER_1)
  color = texture2D(u_buffer0, uv);

#else

  float ptdepthRes = u_depth_res;
  float ptdepthThickness = u_depth_thickness;
  vec3 pd = ptdepth(u_buffer1, uv, ptdepthRes, ptdepthThickness);
  color = texture2D(u_buffer1, uv);
  color.rgb = blendAdd(color.rgb, pd, u_depth_amt * color.a);
  color.a = 1.;

  // float bg_mask = smoothstep(.0, .1, color.r);
  color.rgb = texture2D(u_gradientTex, vec2(color.r, .5)).rgb;
  // vec4 color1 = vec4(0.972, 0.824, 0.802, 1.0);
  // vec4 color2 = vec4(0.917, 0.968, 1.0, 1.0);
  // vec4 bg_color = vec4(0.885, 0.944, 1.0, 1.0);  // texture2D(u_inputTex,
  // uv); bg_color = vec4((1. - bg_color.rgb) * .5, 1.); color =
  // spectral_mix(color1, color2, color.r); color = mix(bg_color, color,
  // bg_mask);

  // color.rgb = vec3(bg_mask);

  // Splatter work
  // color.rgb = texture2D(u_inputTex, uv).rgb;
  vec3 splatters = vec3(0.);

  // Good splatter hashes
  // 0x02d4f9e49d569e5a4d6f00bbdf6ba355a434eab0700678b8e6e45dd3b01d67a0
  // 0xc674feb3dd64df9a9092227d91b5507ca12f057398e4d94881b0a27b92a91985
  // 0x602a2a47199bbe438ed3d1663f726b35842a285ba809a6d21c6cf2ab1f668d5b --
  // FINALSPLATTERS?
  // 0x13ec8bae789a7884b3e415e565969b998a53bc2de9954f51d98211e9d104f013
  // 0xbf2e4bb008435499a3652b17e8681acee7f954e3ccabf6c01f23e6727882fb25

  float hues[NUM_SPLATTERS_LAYERS] =
      float[NUM_SPLATTERS_LAYERS](.18, .5, .9, .4, .18);

  // float hues[NUM_SPLATTERS_LAYERS] = float[NUM_SPLATTERS_LAYERS](.88, .92,
  // .9);
  for (int i = 0; i < NUM_SPLATTERS_LAYERS; i++) {
    seed += 111.;
    float r = random(seed * float(i) * 111.);
    float n = snoise(vec3(uv * mix(5., 10., r), seed * 222.));
    float n2 = snoise(vec3(uv * 3., seed * 222.)) * .5 + .5;
    float n3 = snoise(vec3(uv * 2., seed * 444.)) * .5 + .5;

    vec2 center = vec2(.5);
    vec2 st = uv;
    st -= center;
    st = rotate2d(random(seed) * PI) * st;  /// * vec2(1., .5625);
    st = scale(st, vec2(mix(.1, 5., n3), 1.));
    st += center;
    vec3 p = mix(.999, 1., r) * M * vec3(st + n * .1, 0.);

    float result = magicBox(p);
    result *= mix(.02, .05, n);
    result = smoothstep(.999, 1., result);
    float mult = 2.;
    if (i == 2) mult = 2.2;  // hack for final splatters
    result *= rect(uv, vec2(1. - u_margin * mult), .0);

    float splatter_hue = hues[i];
    vec3 splatter_c = hsv2rgb(vec3(splatter_hue, 1., 1.));
    vec3 splatter = vec3(result) * splatter_c;

    // color.rgb = mix(color.rgb, splatter, result * mix(.3, .7, n2));
  }

  // color.rgb = vec3(snoise(vec3(uv * 2., seed * 444.)) * .5 + .5);

#endif

  gl_FragColor = color;
}