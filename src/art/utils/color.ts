import { HSL } from "three";
import Random from "./ab-random";

export const color_variation = (R: Random, c: THREE.Color, h: number, s = 0, l = 0) => {
    let hsl: HSL = {
        h: 0,
        s: 0,
        l: 0
    };
    c.getHSL(hsl);
    hsl.h += R.rn(-h, h);
    hsl.s += R.rn(-s, s);
    hsl.l += R.rn(-l, l);
    return hsl;
}