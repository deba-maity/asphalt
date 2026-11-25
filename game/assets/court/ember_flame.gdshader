shader_type spatial;
render_mode unshaded, cull_disabled;

uniform float fire_time = 0.0;

void vertex() {
	float flex = UV.y * UV.y;
	float phase = COLOR.r * 6.2832 + MODEL_MATRIX[3].x * 0.37 + MODEL_MATRIX[3].z * 0.29;
	VERTEX.x += flex * (0.035 * sin(fire_time * 3.8 + phase + UV.y * 3.5) + 0.022 * sin(fire_time * 6.1 + phase));
	VERTEX.z += flex * 0.032 * cos(fire_time * 4.6 + phase + UV.y * 4.0);
	VERTEX.y += flex * 0.036 * sin(fire_time * 4.1 + phase);
}

void fragment() {
	float filament = 0.5 + 0.5 * sin(UV.x * 18.85 + UV.y * 4.0 - fire_time * 2.1);
	float heat = clamp(1.0 - UV.y * 0.95 + filament * 0.17 + COLOR.g * 0.18, 0.0, 1.0);
	vec3 copper = vec3(1.0, 0.095, 0.009);
	vec3 gold = vec3(1.0, 0.52, 0.048);
	vec3 core = vec3(1.0, 0.91, 0.53);
	ALBEDO = mix(mix(copper, gold, smoothstep(0.0, 0.58, heat)), core, smoothstep(0.55, 1.0, heat));
}
