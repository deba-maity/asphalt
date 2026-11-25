shader_type spatial;
render_mode unshaded, cull_disabled, shadows_disabled;

uniform vec2 approach = vec2(0.0, 1.0);
uniform float ready = 0.0;
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
	if (coverage < .018) discard;
	ALBEDO = mix(vec3(.91,.64,.25), vec3(.52,.94,.76), ready);
	ALPHA = coverage * .86;
}
