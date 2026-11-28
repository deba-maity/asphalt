shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx;

uniform float tide_time = 0.0;
uniform float dawn : hint_range(0.0, 1.0) = 0.0;
varying vec2 shore;

float coastline(float angle) {
	return 21.7 + 1.5 * sin(3.0 * angle + 0.2) + 1.1 * cos(5.0 * angle) + 0.52 * sin(9.0 * angle);
}

void vertex() {
	shore = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xz;
	VERTEX.y += .047 * sin(dot(shore, vec2(.19, .29)) - tide_time * .82);
}

void fragment() {
	float reach = length(shore);
	float footprint = max(length(dFdx(shore)), length(dFdy(shore)));
	float detail = 1.0 - smoothstep(.14, 1.20, footprint);
	float broad = 1.0 - smoothstep(1.2, 5.8, footprint);
	float time = tide_time;
	// Intersecting wave trains lose coherence in patches as wind changes.
	float drift = sin(dot(shore, vec2(.083, -.102)) + .19 * time);
	float swell = dot(shore, vec2(.36, .53)) - .71 * time + 1.7 * drift;
	float cross = dot(shore, vec2(.68, -.48)) - .46 * time + 1.2 * sin(swell * .38);
	float chop = dot(shore, vec2(1.80, 2.41)) + 2.3 * sin(cross * .78) - 1.19 * time;
	float wind = .54 + .46 * sin(shore.x * .087 + drift) * sin(shore.y * .118 - time * .12);
	float wave = .55 * sin(swell) + .29 * sin(cross);
	float ripples = sin(chop) * detail * wind;
	float edge = reach - coastline(atan(shore.y, shore.x)) - 1.3;
	// At high tide small waves also break around the pine's island.
	vec2 landing = shore - vec2(6.87, -43.60);
	float angle = atan(landing.y / 6.48, landing.x / 7.67);
	float rim = .49 * sin(angle * 5.) + .34 * cos(angle * 9.);
	float isle = (length(landing / (vec2(7.67, 6.48) + rim)) - 1.0) * 6.9 - .50;
	edge = min(edge, isle);
	float runup = .54 * wave + .17 * ripples + .20 * sin(edge * .32 - time * .73);
	float line = 1.0 - smoothstep(.08, .30 + footprint * .28, abs(edge - runup));
	float broken = smoothstep(-.26, .65, sin(cross * 1.84) + ripples * .7);
	float backwash = 1.0 - smoothstep(.09,.55 + footprint * .25,abs(edge - 1.34 - .45 * wave));
	float foam = (line * broken + .31 * backwash * smoothstep(-.1,.68,sin(chop * .57))) * broad;
	vec3 pool = mix(vec3(.068, .133, .147), vec3(.142, .220, .201), 1.0 - smoothstep(2.0, 16.0, edge));
	pool += (.012 * wave * broad + .008 * ripples) * vec3(.66, .91, 1.0);
	// Broken morning light travels across the channels beyond the old causeway.
	float across_glint = abs(dot(shore - vec2(10.,-37.),vec2(.87,.49)));
	float glint = (1.0 - smoothstep(1.5,20.0,across_glint)) * smoothstep(.25,.83,.53*cos(swell)+.34*cos(cross)+.16*ripples);
	pool += vec3(.16,.098,.040) * glint * dawn * broad;
	ALBEDO = mix(pool, vec3(.68, .72, .66), clamp(foam * .86,0.,1.));
	// Rough water reflects broad sky tones. Narrow reflections belong only
	// to sheltered wind patches, and fade below a screen pixel at distance.
	vec2 slope = vec2(.38, .55) * cos(swell) + vec2(.56, -.43) * cos(cross);
	slope = slope * .040 * broad + vec2(.027, .035) * cos(chop) * detail * wind;
	NORMAL_MAP = vec3(.5 + slope, 1.0);
	ROUGHNESS = .54 + .09 * wind + foam * .21;
	SPECULAR = .34;
	METALLIC = .025;
	ALPHA = 1.0 - smoothstep(72.0, 146.0, reach);
}
