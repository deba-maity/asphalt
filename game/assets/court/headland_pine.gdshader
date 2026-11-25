shader_type spatial;
render_mode unshaded, cull_disabled;

uniform sampler2D boughs : source_color, repeat_disable, filter_linear_mipmap_anisotropic;
uniform float wind_time = 0.0;

void vertex() {
	float canopy = pow(1.0 - UV.y, 2.1);
	float gust = sin(wind_time * .64) + .35 * sin(wind_time * 1.51 + UV.x * 3.0);
	VERTEX.x += canopy * .085 * gust;
	VERTEX.z += canopy * .046 * sin(wind_time * .91 + UV.x * 2.9);
}

void fragment() {
	vec4 tree = texture(boughs, UV);
	ALBEDO = tree.rgb * vec3(.83, .90, .91);
	ALPHA = tree.a;
	ALPHA_SCISSOR_THRESHOLD = .27;
}
