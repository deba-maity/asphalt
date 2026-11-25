shader_type spatial;
render_mode unshaded, cull_disabled;

uniform float fire_time = 0.0;
varying float heat;
void vertex() {
	float seed = INSTANCE_CUSTOM.r;
	float rise = fract(fire_time * (0.33 + 0.12 * seed) + seed);
	float angle = seed * 35.1 + rise * 3.0;
	float size = smoothstep(0.0, 0.12, rise) * (1.0 - smoothstep(0.63, 1.0, rise));
	VERTEX *= size;
	VERTEX += vec3(cos(angle) * (0.09 + 0.12 * rise) + rise * rise * 0.12, rise * 0.91, sin(angle) * (0.09 + 0.12 * rise));
	heat = 1.0 - rise;
}

void fragment() {
	ALBEDO = mix(vec3(0.81, 0.19, 0.025), vec3(1.0, 0.82, 0.32), heat);
}
