uniform sampler2D texture;
uniform vec2 u_resolution;
uniform vec2 u_frequency;
uniform float u_seed;

#include "../../../../../lygia/generative/curl.glsl"
#include "../../../../../lygia/generative/snoise.glsl"
#include "cell2d.frag"

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 c_uv = uv * vec2(1., 2.);
  vec2 swap_freq = u_frequency;
  if (u_seed < 5.) {
    swap_freq = swap_freq.yx;
  }
  vec2 freq = swap_freq * u_resolution;
  vec3 curl_n = curl(vec3(c_uv * freq + vec2(1.), u_seed * 100.));
  float p = snoise(vec3(c_uv * 1000. + vec2(u_seed * 100.), 0.));
  curl_n += vec3(p);
  vec2 cell = cell2d(c_uv * 1.);
  curl_n += cell.r;
  gl_FragColor = vec4(curl_n, 1.);
}
