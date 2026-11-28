shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx;

uniform sampler2D stone_color : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D stone_normals : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D stone_arm : filter_linear_mipmap_anisotropic, repeat_enable;
varying vec3 shore_pos;

void vertex() {
	shore_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	vec2 p = shore_pos.xz;
	vec2 uv = p * .50;
	vec3 stone = texture(stone_color, uv).rgb;
	vec3 surface = texture(stone_arm, uv).rgb;
	// Saltwater gathers in low stones towards the sea. The broken boundary
	// follows the mortar so it reads as damp paving, even with shadows off.
	float tide = length(p * vec2(.94, 1.06)) + .94 * sin(.56 * p.y + .27 * p.x)
		+ .58 * sin(.91 * p.x - .43 * p.y) + .24 * sin(1.73 * p.y);
	float exposure = smoothstep(5.5, 10.8, tide);
	float damp = exposure * smoothstep(.07, .72, exposure + .38 * (1.0 - surface.r));
	vec3 dry_tint = mix(vec3(.38, .43, .46), vec3(.43, .42, .38), 1.0 - smoothstep(1.8, 6.5, length(p)));
	ALBEDO = stone * mix(dry_tint, vec3(.16, .216, .255), damp);
	ROUGHNESS = mix(clamp(.40 + .60 * surface.g, .40, 1.0), .26 + .29 * surface.g, damp);
	SPECULAR = mix(.35, .68, damp);
	AO = surface.r;
	NORMAL_MAP = texture(stone_normals, uv).rgb;
	NORMAL_MAP_DEPTH = mix(.84, .60, damp);
}
