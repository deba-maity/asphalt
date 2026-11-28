shader_type spatial;
render_mode unshaded, cull_disabled, shadows_disabled;

uniform float shore_time = 0.0;
varying float wing;

void vertex() {
	float phase = INSTANCE_CUSTOM.r * 6.28318;
	float tier = INSTANCE_CUSTOM.g;
	float angle = phase + shore_time * (.118 + .018 * tier);
	float radius = 12.0 + 6.0 * tier;
	vec3 centre = vec3(cos(angle) * radius, 11.2 + 4.1 * tier + .64 * sin(angle * 2.0), sin(angle) * (7.0 + tier * 3.2));
	// Alternate several beats with a banked glide around the offshore rock.
	wing = abs(VERTEX.x);
	float flap = .31 * sin(shore_time * 5.8 + phase) * smoothstep(.18,.83,sin(shore_time*.55 + phase));
	VERTEX.y += flap * wing * wing;
	VERTEX.y += VERTEX.x * (.09 + .13 * sin(angle + tier));
	vec2 forward = normalize(vec2(-radius * sin(angle), (7.0 + tier * 3.2) * cos(angle)));
	vec2 side = vec2(-forward.y, forward.x);
	VERTEX.xz = side * VERTEX.x - forward * VERTEX.z;
	VERTEX += centre;
}

void fragment() {
	ALBEDO = mix(vec3(.44, .455, .43), vec3(.085, .103, .111), smoothstep(.61, .95, wing));
}
