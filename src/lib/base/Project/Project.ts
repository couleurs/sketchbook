/**
 * A base class for all projects in src/art. You can subclass this directly to create Sketchbook
 * projects that use the HTML canvas element directly, or you can subclass one of the more
 * specialized project types in this directory. See the docs for more info.
 */

/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-unused-vars */

export default class Project {
    /**
     * A canvas element that this project can draw to. This will be set automatically before init
     * is called, and the size will be set to fill to the container div (its parent). It will be
     * undefined if accessed in a project's constructor, or when using CanvasType.None (below).
     */
    canvas?: HTMLCanvasElement;

    /**
     * A div element that this project will use as a container. This will be set automatically
     * before init is called, and the container div will fill as much space as possible (dependant
     * on your layout configuration). It is only undefined if accessed in a project's constructor.
     */
    container?: HTMLDivElement;

    /**
     * The canvasType used by this project; similarly typed canvases will be reused as new projects
     * are loaded. The canvasType selected should match the type of context you expect to use with
     * this.canvas.getContext(), or CanvasType.None if you don't need a canvas.
     */
    canvasType = CanvasType.Context2D;

    /**
     * init is called once when the project is first loaded, after this.canvas and this.container
     * become available. Override this with any custom initialization behavior.
     */
    public init() {}

    /**
     * update is called continuously in a requestAnimationFrame loop. Override this with your custom
     * drawing code. The detail object contains the following:
     * - frame: the current frame number (0 at project load, incremented by 1 for each update call)
     * - time: milliseconds passed since project load (i.e. since init was called)
     */
    public update(detail: { frame: number; time: number }) {}

    /**
     * paramChanged is called when a parameter is changed in the UI. The detail object contains the
     * following:
     * - paramKey: the key of the parameter that was changed
     */
    public paramChanged(detail: { paramKey: string }) {}

    /**
     * resized is called when the container div and/or active canvas is resized. The detail object
     * contains the following:
     * - containerSize: the new size of the container div, in pixels
     * - canvasSize: the new size of the canvas, in pixels (only available if using a canvas)
     */
    public resized(detail: { containerSize: [number, number]; canvasSize?: [number, number] }) {}

    /**
     * destroy is called when the project is unloaded, i.e. when another project is selected.
     * Override this with any custom cleanup behavior.
     */
    public destroy() {
        // By default, clear the shared canvas when the project is unloaded.
        const context = this.canvas?.getContext('2d');
        if (context && this.canvas) {
            context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }
}

/**
 * The type of canvas context that will be used by a project.
 */
export enum CanvasType {
    Context2D = '2d',
    WebGL = 'webgl',
    None = 'none'
}
