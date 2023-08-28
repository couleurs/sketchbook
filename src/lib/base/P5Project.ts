/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-empty-function */

import Project from '$lib/base/Project';
import P5 from 'p5';

/**
 * A simple base class for P5-based projects.
 */
export default class P5Project extends Project {
    /**
     * P5 lifecycle functions. Override these with your P5 code. P5 runs in "instance mode", so all
     * library functionality must be accessed through the p5 object passed to each function.
     */
    public preload(p5: P5) {}
    public setup(p5: P5) {
        // By default, create a canvas that fills the container div.
        p5.createCanvas(this.container.clientWidth, this.container.clientHeight);
        p5.windowResized = () => {
            p5.resizeCanvas(this.container.clientWidth, this.container.clientHeight);
        };
    }
    public draw(p5: P5) {}

    /**
     * Project superclass overrides; you shouldn't need to change these.
     */
    useSharedCanvas = false;
    init() {
        const processingFn = (p5: P5) => {
            p5.preload = this.preload.bind(this, p5);
            p5.setup = this.setup.bind(this, p5);
            p5.draw = this.draw.bind(this, p5);
        };
        new P5(processingFn);
    }
}