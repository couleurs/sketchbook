import {
    WebGLRenderer,
    FloatType,
    UnsignedByteType,
    HalfFloatType,
    type TextureDataType,
    PlaneGeometry,
    OrthographicCamera
} from "three";

export const texture_format = (renderer: WebGLRenderer): TextureDataType => {
    let type: TextureDataType = FloatType;

    if (!renderer.capabilities.floatFragmentTextures) {
        type = UnsignedByteType;
    }
    else if (!renderer.capabilities.isWebGL2) {
        type = HalfFloatType;
    }
    else if ((/(iPad|iPhone|iPod)/g.test(navigator.userAgent))) { // mobile -> half float textures    
        type = HalfFloatType;
    }

    return type;
}

export const fullscreen_quad = (camera: OrthographicCamera): PlaneGeometry => {
    return new PlaneGeometry(camera.right - camera.left, camera.top - camera.bottom);
}