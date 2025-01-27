import Project from '$lib/base/Project/Project';

export default class FirstProject extends Project {
    rectSize = 0.5; // "Rect Size"
    rectColor = '#34b00c'; // "Rect Color"

    update() {
        const ctx = this.canvas?.getContext('2d');
        if (!this.canvas || !ctx) return;

        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.fillStyle = this.rectColor;
        ctx.fillRect(
            (this.canvas.width * (1.0 - this.rectSize)) / 2,
            (this.canvas.height * (1.0 - this.rectSize)) / 2,
            this.canvas.width * this.rectSize,
            this.canvas.height * this.rectSize
        );
    }
}