#define K 0.142
#define Ko 0.42
#define jitter 1.0

vec3 mod7(vec3 x) { return x - floor(x * (1.0 / 7.0)) * 7.0; }

vec2 cell2d(vec2 P) {
  vec2 Pi = mod289(floor(P));
  vec2 Pf = fract(P);
  vec3 oi = vec3(-1.0, 0.0, 1.0);
  vec3 of = vec3(-0.5, 0.5, 1.5);
  vec3 px = permute(Pi.x + oi);
  vec3 p = permute(px.x + Pi.y + oi);
  vec3 ox = fract(p * K) - Ko;
  vec3 oy = mod7(floor(p * K)) * K - Ko;
  vec3 dx = Pf.x + 0.5 + jitter * ox;
  vec3 dy = Pf.y - of + jitter * oy;
  vec3 d1 = dx * dx + dy * dy;
  p = permute(px.y + Pi.y + oi);
  ox = fract(p * K) - Ko;
  oy = mod7(floor(p * K)) * K - Ko;
  dx = Pf.x - 0.5 + jitter * ox;
  dy = Pf.y - of + jitter * oy;
  vec3 d2 = dx * dx + dy * dy;
  p = permute(px.z + Pi.y + oi);
  ox = fract(p * K) - Ko;
  oy = mod7(floor(p * K)) * K - Ko;
  dx = Pf.x - 1.5 + jitter * ox;
  dy = Pf.y - of + jitter * oy;
  vec3 d3 = dx * dx + dy * dy;
  vec3 d1a = min(d1, d2);
  d2 = max(d1, d2);
  d2 = min(d2, d3);
  d1 = min(d1a, d2);
  d2 = max(d1a, d2);
  d1.xy = (d1.x < d1.y) ? d1.xy : d1.yx;
  d1.xz = (d1.x < d1.z) ? d1.xz : d1.zx;
  d1.yz = min(d1.yz, d2.yz);
  d1.y = min(d1.y, d1.z);
  d1.y = min(d1.y, d2.x);
  return sqrt(d1.xy);
}
