export const lerp = (min: number, max: number, t: number) => min * (1 - t) + max * t;

export const inverseLerp = (min: number, max: number, t: number) => (t - min) / (max - min);

export const map = (value: number, inputMin: number, inputMax: number, outputMin: number, outputMax: number) =>
  lerp(outputMin, outputMax, inverseLerp(inputMin, inputMax, value));

export const clamp = (min: number, max: number, value: number) => Math.max(Math.min(value, max), min);

export const clamp01 = (v: number) => clamp(0, 1, v);

export const step = (thresh: number, x: number) => (x < thresh) ? 0 : 1;

// Waveshapes
export const sawtooth = (x: number, l: number) => ((x % l) / l);
export const square = (x: number, l: number) => (Math.floor(x / l) % 2 == 0) ? 0 : 1;
export const sine = (x: number, l: number) => map(Math.sin(x * 2 * Math.PI / l), -1, 1, 0, 1);

// Easings
export const ease_out = (x: number) => 1 - Math.pow(1 - x, 4);

export const prim_mod = (x: number, l: number, exp = 3) => {
  const f1 = sawtooth(x, l);
  const f2 = Math.floor(x / l % 2);
  const f3 = f1 + f2 - 2 * f1 * f2;
  return 1 - Math.pow(Math.abs(f3), exp);
}