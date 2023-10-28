uniform sampler2D texture;
uniform vec2 u_resolution;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  gl_FragColor = texture2D(texture, uv);
}