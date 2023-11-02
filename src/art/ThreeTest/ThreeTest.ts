import Project, { CanvasType, type DetailWebGL, type ResizedDetailWebGL, type UpdateDetailWebGL } from '$lib/base/Project/Project';
import Random from '../utils/ab-random';
import * as THREE from 'three';
import MultipassShader from '../utils/gfx/multipass_shader';
import ShaderTexture from '../utils/gfx/shader_texture';
import SceneManager from '../utils/scene';
import { texture_format } from '../utils/gfx/gfx_utils';
import { map } from '../utils/math';

// Textures
import gradient_tex from './textures/g_map_grey.png';
import curl_tex_src from './textures/curl_tex.png';
import input_tex_src from './textures/input_tex_6.png';

// Shaders
import frag_shdr from './shaders/feedback.frag';
import flow_shdr from './shaders/flow.frag';

let camera: THREE.OrthographicCamera;
let scene: THREE.Scene;
let renderer: THREE.WebGLRenderer;
let scene_RT: THREE.WebGLRenderTarget;
let multipass_shader: MultipassShader;
let flow_shader_texture: ShaderTexture;
let flow_shader_texture_2: ShaderTexture;
let scene_manager: SceneManager;

// Dimensions
const frustrum_size = 100;
const ASPECT = 5.416;
const dpr = window.devicePixelRatio * 2;
let W = window.innerWidth;
let H = W / ASPECT;

// declare var tokenData: any;
// tokenData.hash = "0x2c961b31fb697592bcaa771d2c93200d6c27f4aac2bab9a6c5ee157d6ac71880"; // FINAL BANNER

const R = new Random("0x2c961b31fb697592bcaa771d2c93200d6c27f4aac2bab9a6c5ee157d6ac71880");

let new_row = false;
let prev_rect_y = -1;
let stop_fb = 0.;
let render_noises = true;
let seed = 0.;


export default class ThreeTest extends Project {
    depth_amt = 0.15; // 0 to 1, step 0.05, "Depth Amount"
    depth_res = 3800; // 0 to 8000, step 100, "Depth Resolution"
    depth_thickness = 5; // 0 to 10, step 0.1, "Depth Thickness"
    canvasType = CanvasType.WebGL;

    on_resize(w: number, h: number) {
      const dim = {
        x: h * ASPECT >= w ? w : h * ASPECT,
        y: w / ASPECT >= h ? h : w / ASPECT,
      };

      W = ~~(dim.x);
      H = ~~(dim.y);      

      renderer.setPixelRatio(dpr);
      renderer.setSize(W, H);
      multipass_shader.resize(W * dpr, H * dpr);
      scene_RT.setSize(W * dpr, H * dpr);
    }

    init({container, canvas}: DetailWebGL) {
      seed = R.rn(0, 10);

      // Initialize Graphics 
      camera = new THREE.OrthographicCamera(frustrum_size * ASPECT / -2, frustrum_size * ASPECT / 2, frustrum_size / 2, -frustrum_size / 2, 0, 10);
      scene = new THREE.Scene();
      scene_manager = new SceneManager();
      scene_manager.populate(scene);

      renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        preserveDrawingBuffer: true
      });
      renderer.setPixelRatio(dpr);
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.autoClear = false;
      renderer.autoClearColor = false;

      const type = texture_format(renderer);
      scene_RT = new THREE.WebGLRenderTarget(W * dpr, H * dpr, {
        wrapS: THREE.ClampToEdgeWrapping,
        wrapT: THREE.ClampToEdgeWrapping,
        type: type
      });

      const uniforms: { [key: string]: THREE.IUniform } = {}

      const flow_w = 1024;
      const flow_h = 1024;
      const flow_uniforms: { [key: string]: THREE.IUniform } = {
        u_resolution: { value: new THREE.Vector2(flow_w, flow_h) },
        u_seed: { value: seed },
        u_frequency: { value: new THREE.Vector2(.0025, .25) }
      };
      flow_shader_texture = new ShaderTexture(flow_shdr, flow_w, flow_h, renderer, camera, flow_uniforms);

      const flow2_uniforms: { [key: string]: THREE.IUniform } = {
        u_resolution: { value: new THREE.Vector2(flow_w, flow_h) },
        u_seed: { value: seed },
        u_frequency: { value: new THREE.Vector2(.0025, R.rc([2.5, .25, .1, .025, .01])) }
      };
      flow_shader_texture_2 = new ShaderTexture(flow_shdr, flow_w, flow_h, renderer, camera, flow2_uniforms);

      const texture = new THREE.TextureLoader().load(gradient_tex);
      const input_tex = new THREE.TextureLoader().load(input_tex_src);
      const curl_tex = new THREE.TextureLoader().load(curl_tex_src);
      curl_tex.wrapS = THREE.RepeatWrapping;
      curl_tex.wrapT = THREE.RepeatWrapping;
      curl_tex.minFilter = THREE.LinearFilter;

      uniforms.u_gradientTex = { value: texture };
      uniforms.u_curlTex = { value: curl_tex };
      uniforms.u_inputTex = { value: input_tex };
      multipass_shader = new MultipassShader(renderer, camera, uniforms);
      multipass_shader.load(frag_shdr);

      this.on_resize(container.clientWidth, container.clientHeight);
    }

    resized({container}: ResizedDetailWebGL) {
      this.on_resize(container.clientWidth, container.clientHeight);
    }

    update({time}: UpdateDetailWebGL) {
      if (render_noises) {
        render_noises = false;
        flow_shader_texture.render();
        flow_shader_texture_2.render();
        multipass_shader.update_uniform("u_flowTex1", { value: flow_shader_texture.texture() });
        multipass_shader.update_uniform("u_flowTex2", { value: flow_shader_texture_2.texture() });
      }
    
      // renderer.setRenderTarget(scene_RT);
      // renderer.clear();
      // renderer.render(scene, camera);
    
      renderer.setRenderTarget(null);
      renderer.clear();
    
      // update uniforms
      const t = (time / 1000) * 50;
      const num_rects = 10;
    
      const tick = (Math.floor(t) / num_rects);
      let rect_x = tick % 1;
      // console.log(rect_x);
      let rect_y = (Math.floor(tick) / num_rects);// % 1;
    
    
    
      if (rect_y != prev_rect_y) {
        new_row = true;
        prev_rect_y = rect_y;
      }
    
      const margin = .0;
      const size_scale_base = .05;
      let size_scale = size_scale_base * (1 - 2 * margin);
      if (rect_y > (1 - size_scale_base)) {
        size_scale = 0;
      }
    
      if (rect_y > 2) {
        stop_fb = 1;
      }
    
      rect_x = map(rect_x, 0, 1, margin, 1 - margin);
      rect_y = map(rect_y, 0, 1, margin, 1 - margin);
    
      // Boundary check
      const condition_1 = (rect_x + .1 * size_scale) - (1 - margin) > .001;
      const condition_2 = rect_y - (1 - margin) > .001;
      if (condition_1 || condition_2) {
        size_scale = 0;
      }
    
      // const dist_strength = map(tick % 1, 0, 1, 0, .05);
    
      if (new_row) {
        const thickness = R.rc([10, 50, 80]);
        const size = 1;//R.rcw([1, .8, .6], [.5, .2, .1]);
        const mult = R.rn(.0, .9);
        multipass_shader.update_uniform("u_thickness", { value: thickness });
        multipass_shader.update_uniform("u_size", { value: size });
        multipass_shader.update_uniform("u_alpha_mult", { value: mult });
        new_row = false;
      }
    
      multipass_shader.update_uniform("u_time", { value: t });
      multipass_shader.update_uniform("u_seed", { value: seed });
      multipass_shader.update_uniform("u_pos", { value: new THREE.Vector2(rect_x, rect_y) });
      multipass_shader.update_uniform("u_margin", { value: margin });
      multipass_shader.update_uniform("u_size_scale", { value: size_scale });
      multipass_shader.update_uniform("u_rot", { value: 0 });
      multipass_shader.update_uniform("u_depth_amt", { value: this.depth_amt });
      multipass_shader.update_uniform("u_depth_res", { value: this.depth_res });
      multipass_shader.update_uniform("u_depth_thickness", { value: this.depth_thickness });
      multipass_shader.update_uniform("u_stop_fb", { value: stop_fb });
    
      multipass_shader.set_scene_texture(scene_RT.texture);
      multipass_shader.render();
    }
}