import * as THREE from 'three';
import {
  IUniform,
} from "three";
import { GUI } from 'dat.gui';
import Random from './utils/ab-random';
import { createNoise2D, createNoise3D } from 'simplex-noise';
import MultipassShader from './gfx/multipass_shader';
import ShaderTexture from './gfx/shader_texture';
import { transformFn } from './utils/transform';
import { texture_format } from './gfx/gfx_utils';
import SceneManager from './scene';
import { map } from './utils/math';
import { saveAs } from 'file-saver';

// Shaders
import frag_shdr from '../shaders/feedback.frag';
import flow_shdr from '../shaders/flow.frag';

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
const DEFAULT_W = 800;
const dpr = window.devicePixelRatio * 2;
let W = window.innerWidth;
let H = W / ASPECT;
let M = W / DEFAULT_W;

declare var tokenData: any;
console.log(tokenData.hash);
// tokenData.hash = "0xfc184f9ab3d89e021e523e1fd79301a88949fc5e10ee48f2517c0d2890ac67a7";
// tokenData.hash = "0x02947d8c7a8213aa1e08b0d1a21993daf9371f9a583c67b1e7af226dd77e1e94";
// tokenData.hash = "0x6da0e943d1c3c498bf27a3267ef92a345af5b55656a8ff9d7441c1b32759976f";
// tokenData.hash = "0xeaff480e0672241524882fd921521cac3a57c7ff2735a82134cf19c1372b1423";
// tokenData.hash = "0xc33f6127772a2751ba29d500dfaa90744f1807e02106904af3bf87f1e6ed5a3c";


// tokenData.hash = "0x5dac8cd9b4f475f8e87ce446746dc7ef0560a3e1759b4c57f044ac7a5a07095a"; // FINAL COMPOSITION!!
// tokenData.hash = "0xbf2e4bb008435499a3652b17e8681acee7f954e3ccabf6c01f23e6727882fb25"; // FINAL SPLATTERS!!

tokenData.hash = "0x2c961b31fb697592bcaa771d2c93200d6c27f4aac2bab9a6c5ee157d6ac71880"; // FINAL BANNER

const R = new Random(tokenData.hash);
const dummy = new THREE.Object3D();
const dummy_color = new THREE.Color();
const noise2D = createNoise2D(R.prng);
const noise3D = createNoise3D(R.prng);
const clock = new THREE.Clock();

let depth_amt = 0.15;
let depth_res = 3800;
let depth_thickness = 5;

const thumbnail = /HeadlessChrome/.test(window.navigator.userAgent); // check if thumbnail mode?

const DEV = import.meta.env.DEV;
const STAGING = (import.meta.env.MODE === "staging");
if (DEV && !STAGING) {
  const visual_params: VisualParams = {
    depth_amt: depth_amt,
    depth_res: depth_res,
    depth_thickness: depth_thickness
  };

  const gui = new GUI();
  const visual = gui.addFolder("Visual Params");
  visual.add(visual_params, 'depth_amt', 0, 1, 0.05).listen().onChange(function () {
    depth_amt = visual_params.depth_amt;
  });
  visual.add(visual_params, 'depth_res', 0, 8000, 100).listen().onChange(function () {
    depth_res = visual_params.depth_res;
  });
  visual.add(visual_params, 'depth_thickness', 0, 10, 0.1).listen().onChange(function () {
    depth_thickness = visual_params.depth_thickness;
  });
  visual.open();
}

let new_row = false;
let prev_rect_y = -1;
let stop_fb = 0.;
let render_noises = true;
let seed = 0.;

// initialize audio
// const audio_ctx = new (window.AudioContext || window.webkitAudioContext)();
// immediately suspend
// audio_ctx.suspend();

// audio_ctx.audioWorklet.addModule(workletURL).then(() => {
init();
render();
// });


function init() {
  if (DEV) {
    console.log("### VISUAL DEBUG START ###");
    console.log("### VISUAL DEBUG END ###");
  }

  seed = R.rn(0, 10);

  // Initialize Graphics 
  camera = new THREE.OrthographicCamera(frustrum_size * ASPECT / -2, frustrum_size * ASPECT / 2, frustrum_size / 2, -frustrum_size / 2, 0, 10);
  scene = new THREE.Scene();
  scene_manager = new SceneManager();
  scene_manager.populate(scene);

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true
  });
  renderer.setPixelRatio(dpr);
  renderer.setSize(W, H);
  renderer.autoClear = false;
  renderer.autoClearColor = false;

  let type = texture_format(renderer);
  scene_RT = new THREE.WebGLRenderTarget(W * dpr, H * dpr, {
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    type: type
  });

  const uniforms: { [key: string]: IUniform } = {}

  const flow_w = 1024;
  const flow_h = 1024;
  const flow_uniforms: { [key: string]: IUniform } = {
    u_resolution: { value: new THREE.Vector2(flow_w, flow_h) },
    u_seed: { value: seed },
    u_frequency: { value: new THREE.Vector2(.0025, .25) }
  };
  flow_shader_texture = new ShaderTexture(flow_shdr, flow_w, flow_h, renderer, camera, flow_uniforms);

  const flow2_uniforms: { [key: string]: IUniform } = {
    u_resolution: { value: new THREE.Vector2(flow_w, flow_h) },
    u_seed: { value: seed },
    u_frequency: { value: new THREE.Vector2(.0025, R.rc([2.5, .25, .1, .025, .01])) }
  };
  flow_shader_texture_2 = new ShaderTexture(flow_shdr, flow_w, flow_h, renderer, camera, flow2_uniforms);

  const texture = new THREE.TextureLoader().load('textures/g_map_grey.png');
  const input_tex = new THREE.TextureLoader().load('textures/input_tex_6.png');
  const curl_tex = new THREE.TextureLoader().load('textures/curl_tex.png');
  curl_tex.wrapS = THREE.RepeatWrapping;
  curl_tex.wrapT = THREE.RepeatWrapping;
  curl_tex.minFilter = THREE.LinearFilter;

  uniforms.u_gradientTex = { value: texture };
  uniforms.u_curlTex = { value: curl_tex };
  uniforms.u_inputTex = { value: input_tex };
  multipass_shader = new MultipassShader(renderer, camera, uniforms);
  multipass_shader.load(frag_shdr);

  if (DEV) {
    let main = document.getElementsByTagName("main")[0];
    main.prepend(renderer.domElement);
  }
  else {
    document.body.appendChild(renderer.domElement);
  }

  window.addEventListener('resize', onWindowResize);
  window.addEventListener("click", on_click);
  window.addEventListener('touchend', function (e) {
    on_click();
    e.preventDefault();
  });

  //add event listener for key press
  window.addEventListener('keydown', function (e) {
    on_keydown(e);
  });


  onWindowResize();
}

function onWindowResize() {
  let w = window.innerWidth;
  let h = window.innerHeight;
  let dim = {
    x: h * ASPECT >= w ? w : h * ASPECT,
    y: w / ASPECT >= h ? h : w / ASPECT,
  };

  W = ~~(dim.x);
  H = ~~(dim.y);
  M = W / DEFAULT_W;

  renderer.setPixelRatio(dpr);
  renderer.setSize(W, H);
  multipass_shader.resize(W * dpr, H * dpr);
  scene_RT.setSize(W * dpr, H * dpr);

  console.log("width, height, scale, devicePixelRatio", W, H, M, dpr);
}



function render() {
  // if (!stop_render) {
  requestAnimationFrame(render);
  // }

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
  let t = clock.getElapsedTime() * 50;
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
    let thickness = R.rc([10, 50, 80]);
    let size = 1;//R.rcw([1, .8, .6], [.5, .2, .1]);
    let mult = R.rn(.0, .9);
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
  multipass_shader.update_uniform("u_depth_amt", { value: depth_amt });
  multipass_shader.update_uniform("u_depth_res", { value: depth_res });
  multipass_shader.update_uniform("u_depth_thickness", { value: depth_thickness });
  multipass_shader.update_uniform("u_stop_fb", { value: stop_fb });

  multipass_shader.set_scene_texture(scene_RT.texture);
  multipass_shader.render();
}

function on_click() {
}

function on_keydown(event: KeyboardEvent) {
  if (event.keyCode == 32) {
    console.log("spacebar pressed");
    const canvas = renderer.domElement;
    const dataURL = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    document.body.appendChild(link);
    link.href = dataURL;
    link.download = "image.png";
    link.click();
    document.body.removeChild(link);

    // save canvas as png using saveAs and Blob
    // const canvas = renderer.domElement;
    // const dataURL = canvas.toDataURL("image/png");    
    // saveAs(blob, "image.png");
    // canvas.toBlob(function (blob) {
    //   if (blob) {
    //     saveAs(blob, "image.png");
    //   }
    // });
  }
}


