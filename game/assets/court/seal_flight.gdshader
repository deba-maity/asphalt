shader_type spatial;
render_mode unshaded, cull_disabled, shadows_disabled;

uniform vec3 travel;
uniform float progress = 0.0;
uniform vec4 accent : source_color = vec4(.9,.7,.4,1.0);
varying float core;

void vertex() {
	float seed = INSTANCE_CUSTOM.y;
	float order = INSTANCE_CUSTOM.x;
	float t = clamp((progress - order * .22) / .78, 0.0, 1.0);
	float ease = smoothstep(0.0, 1.0, t);
	float lift = sin(3.14159 * t);
	float phase = seed * 6.28318 + 6.0 * t;
	vec2 fan = vec2(cos(phase), sin(phase));
	vec3 p = travel * ease;
	p.y += lift * (1.0 + seed * .85);
	p.xz += fan * lift * (.12 + .40 * order);
	float life = smoothstep(0.0, .14, t) * (1.0 - smoothstep(.86, 1.0, t));
	VERTEX = VERTEX * life * (.83 + seed) + p;
	core = .40 + .43 * (1.0 - order);
}

void fragment() {
	ALBEDO = mix(accent.rgb, vec3(1.0,.83,.48), core);
	EMISSION = ALBEDO * 1.10;
}
