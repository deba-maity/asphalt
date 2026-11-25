shader_type spatial;
render_mode cull_disabled, diffuse_burley, specular_schlick_ggx;

uniform vec4 metal_color : source_color = vec4(.38,.27,.14,1.0);
uniform float heat : hint_range(0.0,1.0) = 0.0;

void fragment() {
	float edge = COLOR.r;
	ALBEDO = metal_color.rgb * (.62 + .56 * edge);
	METALLIC = .73;
	ROUGHNESS = .37 + .19 * (1.0 - edge);
	EMISSION = vec3(1.0,.28,.053) * smoothstep(.55,.94,edge) * heat * 1.4;
}
