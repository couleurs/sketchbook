import {
    ShaderMaterial,
    Vector2,    
    type IUniform,
    WebGLRenderer,
    WebGLRenderTarget,
    LinearFilter,
    RGBAFormat,
    Scene,
    Mesh,
    OrthographicCamera,    
    RepeatWrapping
} from "three";
import { texture_format, fullscreen_quad } from "./gfx_utils";
import passthrough_vert_shader from "../../ThreeTest/shaders/passthrough.vert";

class MultipassShader {
    private render_targets: WebGLRenderTarget[] = [];
    private materials: ShaderMaterial[] = [];
    private final_material: ShaderMaterial = new ShaderMaterial();
    private uniforms: { [key: string]: IUniform } = {};
    private renderer: WebGLRenderer;
    private camera: OrthographicCamera;
    private scene: Scene;
    private mesh: Mesh;

    constructor(renderer: WebGLRenderer, camera: OrthographicCamera, uniforms: { [key: string]: IUniform }) {
        this.renderer = renderer;
        this.uniforms = uniforms;
        this.uniforms.u_resolution = { value: new Vector2(0, 0) };
        this.camera = camera;

        this.scene = new Scene();
        this.mesh = new Mesh(fullscreen_quad(camera), undefined);
        this.scene.add(this.mesh);
    }

    load(shader: string) {
        const found_buffers = shader.match(/(?:^\s*)((?:#if|#elif)(?:\s*)(defined\s*\(\s*BUFFER_)(\d+)(?:\s*\))|(?:#ifdef)(?:\s*BUFFER_)(\d+)(?:\s*))/gm);
        if (found_buffers) {
            for (let i = 0; i < found_buffers.length; i++) {
                this.add_render_pass(1, 1, i, shader);
            }
        }

        this.final_material = this.create_shdr_mat(this.uniforms, shader);
    }

    update_uniform(key: string, value: IUniform) {
        this.uniforms[key] = value;
    }

    render() {
        // iterate over render targets and render them
        for (let i = 0; i < this.render_targets.length; i++) {
            const render_target = this.render_targets[i];
            const material = this.materials[i];

            this.mesh.material = material;
            this.renderer.setRenderTarget(render_target);
            // this.renderer.clear();
            this.renderer.render(this.scene, this.camera);
            this.uniforms[`u_buffer${i}`] = { value: render_target.texture };
        }

        // render final pass
        this.mesh.material = this.final_material;
        this.renderer.setRenderTarget(null);
        // this.renderer.clear();
        this.renderer.render(this.scene, this.camera);
    }

    resize(width: number, height: number) {
        this.uniforms.u_resolution.value = new Vector2(width, height);

        // iterate over render targets and resize them
        for (let i = 0; i < this.render_targets.length; i++) {
            const render_target = this.render_targets[i];
            render_target.setSize(width, height);
        }
    }

    set_scene_texture(texture: THREE.Texture) {
        this.uniforms.u_sceneTex = { value: texture };
    }

    private add_render_pass(width: number, height: number, index: number, shader: string) {
        // Create material
        const material = this.create_shdr_mat(this.uniforms, `#define BUFFER_${index}\n${shader}`);
        this.materials.push(material);
        this.uniforms[`u_buffer${index}`] = { value: null };

        // Create render target        
        const render_target = this.create_render_target(width, height);
        this.render_targets.push(render_target);
    }

    private create_shdr_mat(uniforms: { [key: string]: IUniform }, frag_shader: string) {
        const material = new ShaderMaterial({
            uniforms: uniforms,
            vertexShader: passthrough_vert_shader,
            fragmentShader: frag_shader
        });
        return material;
    }

    private create_render_target(width: number, height: number) {
        let type = texture_format(this.renderer);

        // see defaults at https://threejs.org/docs/#api/en/renderers/WebGLRenderTarget
        const render_target = new WebGLRenderTarget(width, height, {
            wrapS: RepeatWrapping,
            wrapT: RepeatWrapping,
            minFilter: LinearFilter,
            magFilter: LinearFilter,
            format: RGBAFormat,
            stencilBuffer: false,
            type: type
        });

        return render_target;
    }
}

export default MultipassShader;