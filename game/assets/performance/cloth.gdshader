shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx;

uniform sampler2D albedo_map : source_color, filter_linear_mipmap_anisotropic;
uniform sampler2D normal_map : hint_normal, filter_linear_mipmap_anisotropic;
uniform sampler2D orm_map : hint_default_white, filter_linear_mipmap_anisotropic;
uniform vec4 albedo_factor : source_color = vec4(1.0);
uniform vec4 cloth_color : source_color = vec4(.31,.12,.09,1.0);
uniform float normal_strength = 1.0;
uniform float metallic_factor = 0.0;
uniform float roughness_factor = 1.0;
uniform bool has_normal = false;
uniform bool has_orm = false;

void fragment() {
	vec4 texel=texture(albedo_map,UV)*albedo_factor;
	float green=(texel.g-max(texel.r,texel.b))/max(.005,texel.g);
	float mask=smoothstep(.12,.35,green);
	float luminance=dot(texel.rgb,vec3(.2126,.7152,.0722));
	// Only replace the original green cloth. Skin, leather and metal retain
	// their authored albedo, normal maps and material response.
	vec3 cloth=cloth_color.rgb*clamp(luminance/.22,.15,2.0);
	ALBEDO=mix(texel.rgb,cloth,mask);
	vec3 orm=texture(orm_map,UV).rgb;
	METALLIC=metallic_factor*(has_orm ? orm.b : 1.0);
	ROUGHNESS=max(.32,roughness_factor*(has_orm ? orm.g : 1.0));
	AO=has_orm ? orm.r : 1.0;
	AO_LIGHT_AFFECT=.45;
	if (has_normal) {
		NORMAL_MAP=texture(normal_map,UV).rgb;
		NORMAL_MAP_DEPTH=normal_strength;
	}
}
