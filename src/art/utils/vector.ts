// From https://github.com/mattdesl/tiny-artblocks/blob/main/src/util/vec.js

export const length = (a: [number, number]) => Math.hypot(a[0], a[1]);

export const dist = (a: [number, number], b: [number, number]) => Math.hypot(b[0] - a[0], b[1] - a[1]);

export const rotate = (a: [number, number], angle: number) => {
    let cos = Math.cos(angle);
    let sin = Math.sin(angle);
    return [a[0] * cos + a[1] * sin, a[1] * cos + a[0] * sin];
}