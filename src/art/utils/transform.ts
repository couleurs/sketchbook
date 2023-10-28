/**
 * Calculates the bounding box of a set of points.
 */
export const boundingRect = (points: [number, number][]): [[number, number], [number, number]] => {
    const top_left_fn = (a: [number, number], b: [number, number]) => [Math.min(a[0], b[0]), Math.min(a[1], b[1])] as [number, number];
    const bottom_right_fn = (a: [number, number], b: [number, number]) => [Math.max(a[0], b[0]), Math.max(a[1], b[1])] as [number, number];
    const top_left = points.reduce(top_left_fn);
    const bottom_right = points.reduce(bottom_right_fn);
    return [top_left, bottom_right];
}

// From Lars Wander' blog post: https://larswander.com/writing/centering-and-scaling/
/**
 * Returns a function that transforms between the source and destination
 * coordinate space while preserving the ratio between the input x & y
 * dimensions.
 *
 * @param {[number, number]} stl Top-left point bounding the source.
 * @param {[number, number]} sbr Bottom-right point bounding the source.
 * @param {[number, number]} dtl Top-left point bounding the destination.
 * @param {[number, number]} dbr Bottom-right point bounding the destination.
 */
export const transformFn = (stl: [number, number], sbr: [number, number], dtl: [number, number], dbr: [number, number]) => {
    const [stlx, stly] = stl;
    const [sbrx, sbry] = sbr;
    const [dtlx, dtly] = dtl;
    const [dbrx, dbry] = dbr;

    // Compute the diagonal vector for both bounding rects.
    const [sdx, sdy] = [sbrx - stlx, sbry - stly];
    const [ddx, ddy] = [dbrx - dtlx, dbry - dtly];

    // Find the minimum amount to scale the user draw-area by to fill the screen.
    const [rx, ry] = [ddx / sdx, ddy / sdy];
    const a = Math.min(rx, ry);

    // Compute the translation to the center of the new coordinates, accounting 
    // for the fact that rx may not equal ry by centering the smaller dimension.
    const [ox, oy] = [(ddx - sdx * a) * 0.5 + dtlx, (ddy - sdy * a) * 0.5 + dtly];

    // At this point, we transform from user to screen coordinates using
    //     (pt - tl) * a + o
    // We can skip some arithmetic in our output function by rewriting as
    //     pt * a - tl * a + o
    // ... and folding the constants into the form
    //     pt * a + b
    const [bx, by] = [-stlx * a + ox, -stly * a + oy];

    return (inp: number | [number, number]) => {
        // Scalar values (such as stroke-width, or radius) are only scaled by a
        // constant, not translated.
        if (typeof inp === 'number') {
            return inp * a;
        }
        const [x, y] = inp;
        return [x * a + bx, y * a + by];
    }
}