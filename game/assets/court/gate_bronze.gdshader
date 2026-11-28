shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx;

uniform float remembered : hint_range(0.0, 3.0) = 0.0;

void fragment() {
	float lit = smoothstep(COLOR.r * 3.0 - .85, COLOR.r * 3.0, remembered);
	ALBEDO = mix(vec3(.25, .139, .064), vec3(.63, .38, .14), lit);
	METALLIC = .63;
	ROUGHNESS = mix(.52, .39, lit);
	EMISSION = lit * vec3(.40, .17, .032);
}
