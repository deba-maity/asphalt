shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx;

uniform sampler2D carvings : source_color, filter_linear_mipmap_anisotropic, repeat_disable;
uniform int panel : hint_range(0, 2) = 0;
uniform float kindled : hint_range(0.0, 1.0) = 0.0;

void fragment() {
	// Keep the neighbouring panel out of the footprint of the mip filter.
	vec2 uv = (clamp(UV, vec2(.004), vec2(.996)) + vec2(float(panel), 0.0)) / vec2(3.0, 1.0);
	vec3 pigment = texture(carvings, uv).rgb;
	float gilt = smoothstep(.013, .17, pigment.r - pigment.b);
	float light = smoothstep(0.0, 1.0, kindled);
	vec3 stone = mix(pigment * vec3(.72, .81, .88), pigment, .32 + .68 * light);
	ALBEDO = stone;
	METALLIC = .27 * gilt;
	ROUGHNESS = mix(.93, .53, gilt);
	// Warm metal catches the remembered ember, leaving recesses in shadow.
	float advance = smoothstep(UV.y - .08, UV.y + .08, kindled * 1.16 - .08);
	float ridge = smoothstep(.045, .55, dot(pigment, vec3(.25, .63, .12)));
	EMISSION = vec3(.76, .37, .11) * gilt * (.032 + .42 * advance * (.32 + .68 * ridge));
}
