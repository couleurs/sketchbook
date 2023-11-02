import Project, {
    type Detail2D,
    type ResizedDetail2D,
    type UpdateDetail2D
} from '$lib/base/Project/Project';
import BeachImage from './images/beach.jpg';
import Random from '../utils/ab-random';
import { map } from '../utils/math';
import { genTokenData } from '../utils/token_data';

const tokenData = genTokenData(0);
const R = new Random(tokenData.hash);

export default class GranularSynth extends Project {
    #img: HTMLImageElement;
    #aspect = 1;
    #current_dest_x = 0;
    #canvas_to_image_ratio = 1;

    offset = 100; // 0 to 1000, step 1, "Offset"

    baseImage = async (result: HTMLImageElement) => {
        this.#img = result;
        this.#aspect = this.#img.width / this.#img.height;

        if (this.container) {
            this.on_resize(this.container.clientWidth, this.container.clientHeight);
        }
    };

    constructor() {
        super();
        this.#img = new Image();
        this.#img.src = BeachImage;
        this.#aspect = this.#img.width / this.#img.height;
    }

    init({ container }: Detail2D) {
        this.on_resize(container.clientWidth, container.clientHeight);
    }

    on_resize(w: number, h: number) {
        if (!this.canvas) return;

        const dim = {
            x: h * this.#aspect >= w ? w : h * this.#aspect,
            y: w / this.#aspect >= h ? h : w / this.#aspect
        };

        this.canvas.width = ~~dim.x;
        this.canvas.height = ~~dim.y;

        this.canvas.style.width = `${dim.x}px`;
        this.canvas.style.height = `${dim.y}px`;

        this.#canvas_to_image_ratio = this.canvas.width / this.#img.width;
    }

    resized({ container }: ResizedDetail2D) {
        this.on_resize(container.clientWidth, container.clientHeight);
        console.log('resized');
    }

    redraw() {
        const ctx = this.canvas?.getContext('2d');
        if (!this.canvas || !ctx) return;
        if (this.#current_dest_x > this.canvas.width) return;
        this.#current_dest_x = 0;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    update({ time }: UpdateDetail2D) {
        const ctx = this.canvas?.getContext('2d');
        if (!this.canvas || !ctx) return;
        if (this.#current_dest_x > this.canvas.width) return;

        // DEBUG HALF
        // Draw left half source image for debug
        ctx.clearRect(0, 0, this.canvas.width / 2, this.canvas.height);
        ctx.drawImage(
            this.#img,
            0,
            0,
            this.canvas.width / (2 * this.#canvas_to_image_ratio),
            this.canvas.height / this.#canvas_to_image_ratio,
            0,
            0,
            this.canvas.width / 2,
            this.canvas.height
        );

        ctx.fillStyle = '#34b00c';
        ctx.fillRect(this.offset, 0, 5, this.canvas.height);
        console.log(this.offset);

        // DRAW HALF
        const t = time / 1000; // convert to seconds
        const draw_w = R.ri(10, 100);
        // const start_x = map(t, 0, 100, 0, this.#img.width);
        // const end_x = start_x + this.playhead_w;
        const x = R.ri(0, this.canvas.width - draw_w);

        // ctx.drawImage(
        //     this.#img,
        //     x,
        //     0,
        //     draw_w / this.#canvas_to_image_ratio,
        //     this.#img.height,
        //     this.#current_dest_x,
        //     0,
        //     draw_w,
        //     this.canvas.height
        // );

        this.#current_dest_x += draw_w;

        // ctx.drawImage(this.#img, 0, 0, 200, this.canvas.height);
    }
}
