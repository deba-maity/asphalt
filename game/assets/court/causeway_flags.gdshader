shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx;

uniform sampler2D grain : source_color, repeat_enable, filter_linear_mipmap_anisotropic;
varying vec3 stone;

void vertex() {
	stone = (MODEL_MATRIX * vec4(VERTEX,1.0)).xyz;
}

void fragment() {
	// Each physical flagstone keeps its broad face; the grit is smaller than a joint.
	float fleck = texture(grain,stone.xz * .84).g;
	float wash = texture(grain,stone.xz * .16 + vec2(.33,.41)).r;
	vec3 slate = mix(vec3(.096,.110,.115),vec3(.218,.223,.207),smoothstep(.047,.44,fleck));
	ALBEDO = slate * mix(.82,1.10,smoothstep(.03,.37,wash));
	ROUGHNESS = mix(.73,.91,smoothstep(.04,.46,fleck));
	SPECULAR = .26;
}
