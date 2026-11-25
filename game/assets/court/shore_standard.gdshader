shader_type spatial;
render_mode cull_disabled, diffuse_burley, specular_schlick_ggx;

uniform sampler2D embroidery : source_color, repeat_disable, filter_linear_mipmap_anisotropic;
uniform float wind_time = 0.0;

float drape(vec2 uv, float phase) {
	float pleat = cos(uv.x * 21.0) * (0.032 + 0.025 * uv.y);
	float gust = 0.6 + 0.4 * sin(wind_time * 0.53 + phase);
	float ripple = sin(uv.y * 7.0 - wind_time * 2.3 + phase + uv.x * 3.0);
	float flutter = sin(uv.y * 13.0 - wind_time * 3.3 + uv.x * 7.0);
	return pleat + uv.y * uv.y * (0.12 + gust * (0.135 * ripple + 0.03 * flutter));
}

void vertex() {
	float phase = MODEL_MATRIX[3].x * 0.73 + MODEL_MATRIX[3].z * 0.37;
	VERTEX.z += drape(UV, phase);
	float dz_dx = (drape(UV + vec2(0.005, 0.0), phase) - drape(UV - vec2(0.005, 0.0), phase)) / 0.015;
	float dz_dy = (drape(UV - vec2(0.0, 0.005), phase) - drape(UV + vec2(0.0, 0.005), phase)) / 0.023;
	NORMAL = normalize(vec3(-dz_dx, -dz_dy, 1.0));
}

void fragment() {
	vec3 stitch = texture(embroidery, UV).rgb;
	ALBEDO = stitch;
	ROUGHNESS = 0.91;
	SPECULAR = 0.18;
}
