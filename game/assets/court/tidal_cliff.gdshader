shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx;

uniform sampler2D grain : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
varying vec3 rock;

void vertex() {
	rock = VERTEX;
}

void fragment() {
	float mineral = texture(grain, UV * vec2(.65,.48)).g;
	float bedding = rock.y * 6.8 + rock.x * .22 + rock.z * .27 + mineral * 1.8;
	float seam = 1.0 - smoothstep(.08, .30 + min(fwidth(bedding), .35), abs(sin(bedding)));
	float wet = 1.0 - smoothstep(-1.57, -.63, rock.y + mineral * .24);
	float lichen = smoothstep(-.12, .42, rock.y) * smoothstep(.09,.31,mineral);
	vec3 slate = mix(vec3(.090,.104,.111), vec3(.25,.218,.176), smoothstep(.035,.43,mineral));
	slate *= 1.0 - .28 * seam;
	ALBEDO = mix(slate, vec3(.235,.24,.149), lichen * .49) * (1.0 - wet * .45);
	ROUGHNESS = mix(.91,.41,wet);
	SPECULAR = mix(.22,.43,wet);
}
