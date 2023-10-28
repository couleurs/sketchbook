import {
    Scene,
    CircleGeometry,
    MeshBasicMaterial,
    Mesh,
    Color
} from "three";

class SceneManager {
    constructor() {
    }

    populate(scene: Scene) {
        scene.remove.apply(scene, scene.children);

        const geometry = new CircleGeometry(1, 32);
        const material = new MeshBasicMaterial({ color: new Color(0xffffff) });
        const circle = new Mesh(geometry, material);

        for (let i = -5; i <= 5; i++) {
            for (let j = -5; j <= 5; j++) {
                let circleClone = circle.clone();
                circleClone.position.set(i * 3, j * 3, 0);
                scene.add(circleClone);
            }
        }
    }

    update() {

    }
}

export default SceneManager;