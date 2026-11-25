shader_type spatial;
render_mode cull_disabled, diffuse_burley, specular_schlick_ggx;

uniform float height = -0.15;
uniform float ground_y = 0.0;
uniform vec4 ash : source_color = vec4(.4,.65,.6,1.0);
uniform vec4 tint : source_color = vec4(.55,.59,.60,1.0);
uniform sampler2D color_map : source_color, hint_default_white, filter_linear_mipmap;
uniform sampler2D normal_map : hint_normal, filter_linear_mipmap;
uniform float metal = .42;

varying vec3 place;

void vertex() {
	place = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	float grain = sin(place.x * 32.1 + place.z * 23.6) * sin(place.y * 25.7 - place.x * 7.0);
	float boundary = height - (place.y - ground_y) + grain * .046;
	if (boundary < 0.0) discard;
	float edge = 1.0 - smoothstep(.008, .18, boundary);
	float cooling = 1.0 - smoothstep(.1, .55, boundary);
	vec3 base = texture(color_map, UV).rgb * tint.rgb;
	ALBEDO = mix(base, ash.rgb, edge * .77);
	EMISSION = ash.rgb * (edge * 1.8 + cooling * .18);
	NORMAL_MAP = texture(normal_map, UV).rgb;
	ROUGHNESS = .59;
	METALLIC = metal;
}
