varying vec4 v_color;

void main() {
	v_color = vec4(instanceColor, 1.);
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
}