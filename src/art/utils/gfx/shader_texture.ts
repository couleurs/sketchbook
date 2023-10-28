import {
    Mesh,
    ShaderMaterial,
    WebGLRenderer,
    OrthographicCamera,
    type IUniform,
    WebGLRenderTarget,
    RepeatWrapping,
    LinearFilter,
    RGBAFormat,
    Scene,
} from "three";
import { texture_format, fullscreen_quad } from "./gfx_utils";
import passthrough_vert_shader from "../../ThreeTest/shaders/passthrough.vert";

class ShaderTexture {
    private scene: Scene;
    private render_target: WebGLRenderTarget;
    private renderer: WebGLRenderer;
    private camera: OrthographicCamera;

    constructor(shader: string, width: number, height: number, renderer: WebGLRenderer, camera: OrthographicCamera, uniforms: { [key: string]: IUniform }) {
        const material = new ShaderMaterial({
            uniforms: uniforms,
            vertexShader: passthrough_vert_shader,
            fragmentShader: shader
        });
        const mesh = new Mesh(fullscreen_quad(camera), material);
        this.scene = new Scene();
        this.scene.add(mesh);
        this.renderer = renderer;
        this.camera = camera;
        const type = texture_format(this.renderer);
        this.render_target = new WebGLRenderTarget(width, height, {
            wrapS: RepeatWrapping,
            wrapT: RepeatWrapping,
            minFilter: LinearFilter,
            magFilter: LinearFilter,
            format: RGBAFormat,
            stencilBuffer: false,
            type: type
        });
    }

    render() {
        this.renderer.setRenderTarget(this.render_target);
        this.renderer.render(this.scene, this.camera);
        this.renderer.setRenderTarget(null);
    }

    texture() {
        return this.render_target.texture;
    }
}

export default ShaderTexture;