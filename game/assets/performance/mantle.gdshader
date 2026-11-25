shader_type spatial;
render_mode cull_disabled, diffuse_burley, specular_schlick_ggx;

uniform vec4 cloth_color : source_color = vec4(.21,.09,.065,1.0);
uniform vec4 trim_color : source_color = vec4(.42,.32,.17,1.0);
uniform sampler2D cloth_map : source_color, filter_linear_mipmap_anisotropic;
uniform sampler2D cloth_normal : hint_normal, filter_linear_mipmap_anisotropic;
uniform int oath = -1;
uniform float heat : hint_range(0.0,1.0) = 0.0;

float line_segment(vec2 p, vec2 a, vec2 b, float width) {
	vec2 segment=b-a;
	float distance=length(p-a-segment*clamp(dot(p-a,segment)/dot(segment,segment),0.0,1.0));
	return 1.0-smoothstep(width,width+.003,distance);
}

void fragment() {
	vec3 weave=texture(cloth_map,UV*vec2(3.0,4.0)).rgb;
	float edge=min(min(UV.x,1.0-UV.x),1.0-UV.y);
	float border=smoothstep(.018,.023,edge)*(1.0-smoothstep(.034,.039,edge));
	float seam=(1.0-smoothstep(.002,.004,abs(edge-.047)))*step(.48,fract((UV.x+UV.y)*95.0));
	vec2 p=(UV-vec2(.50,.33))*vec2(1.0,1.3);
	float ring=1.0-smoothstep(.004,.008,abs(length(p)-.11));
	// An interrupted seal and the diagonal vow stroke, drawn in UV space.
	ring*=step(.025,abs(p.x+.018));
	float stroke=line_segment(p,vec2(-.035,-.14),vec2(.035,.14),.005);
	float emblem=max(ring,stroke)*.6;
	if (oath >= 0) {
		// Each teaching echo wears another bar of the shore's device.
		float stitch = 0.0;
		for (int i = 0; i < 3; i++) {
			if (i > oath) break;
			float y = .03 + .046 * float(i);
			float wave = abs(p.y - y - .012 * sin(28.0 * p.x));
			stitch = max(stitch,(1.0-smoothstep(.006,.013,wave))*(1.0-smoothstep(.105,.119,abs(p.x))));
		}
		float sun = (1.0-smoothstep(.004,.012,abs(length(p-vec2(0.,-.03))-.081)))*step(p.y,-.030);
		emblem = max(sun, stitch) * .90;
	}
	float wear=.88+.12*sin(UV.y*51.0+sin(UV.x*39.0));
	vec3 base=cloth_color.rgb*mix(vec3(.75),weave,0.55)*wear;
	ALBEDO=mix(base,trim_color.rgb*weave,max(max(border,seam*.65),emblem));
	EMISSION=vec3(.89,.27,.055)*heat*emblem*.8;
	ROUGHNESS=.95;
	NORMAL_MAP=texture(cloth_normal,UV*vec2(3.0,4.0)).rgb;
	NORMAL_MAP_DEPTH=.4;
	// The geometry already carries the split hem. No alpha/transparency pass.
}
