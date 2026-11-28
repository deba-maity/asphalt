shader_type spatial;
render_mode unshaded, cull_disabled, shadows_disabled;

uniform vec2 approach = vec2(0.0, 1.0);
uniform float ready = 0.0;
uniform bool footwork = false;
varying vec2 spot;

void vertex() { spot = VERTEX.xz; }

void fragment() {
	float radius = length(spot);
	vec2 spoke = spot / max(.001, radius);
	float front = dot(spoke, approach);
	float arc = smoothstep(.30, .70, front);
	float stroke = 1.0 - smoothstep(.019, .040, abs(radius - 1.53));
	float tick = (1.0 - smoothstep(.045, .11, abs(sin(atan(spot.y, spot.x) * 12.0))))
		* (1.0 - smoothstep(.043,.085,abs(radius - 1.54)));
	// An extra line marks a ready stance even to a player who cannot
	// distinguish the ochre and pale turquoise guides.
	float inner = ready * (1.0 - smoothstep(.012, .030, abs(radius - 1.43)));
	float grit = .76 + .24 * sin(spot.x * 81.0) * sin(spot.y * 79.0);
	float coverage = max(max(stroke, tick), inner) * arc * grit;
	if (footwork) {
		vec2 facing = approach;
		float across = dot(spot, vec2(-facing.y, facing.x));
		float distance = abs(across);
		float forward = dot(spot, facing);
		// Boot toes and heels are separated by a tread gap. Their alternating
		// offset makes the direction legible without animation or colour cues.
		coverage = 0.0;
		for (int i = 0; i < 3; i++) {
			float along = distance - (.59 + .59 * float(i));
			float offset = forward + .11 * cos(float(i) * 3.14159);
			float sole = length(vec2((along-.044)/.145, offset/.077));
			float heel = length(vec2((along+.127)/.050, offset/.067));
			coverage = max(coverage, (1.0-smoothstep(.75,1.04,min(sole,heel))) * (.68 + .13 * float(i)));
		}
		coverage *= grit;
	}
	if (coverage < .018) discard;
	ALBEDO = mix(vec3(.91,.64,.25), vec3(.52,.94,.76), footwork ? 1.0 : ready);
	ALPHA = coverage * .86;
}
