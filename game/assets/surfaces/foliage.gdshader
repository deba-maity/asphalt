shader_type spatial;
render_mode cull_disabled, diffuse_burley;
uniform vec4 tint : source_color = vec4(1.0);
void vertex() {
 vec3 world=(MODEL_MATRIX*vec4(VERTEX,1.0)).xyz;
 float gust=sin(TIME*1.3+world.x*.25+world.z*.19);
 float flutter=sin(TIME*3.2+world.x*2.1+world.z*1.7)*.18;
 float weight=clamp(VERTEX.y*.035,0.0,.075);
 VERTEX.x+=(gust+flutter)*weight;
 VERTEX.z+=cos(TIME*.9+world.x*.21)*weight*.45;
}
void fragment() {
 ALBEDO=COLOR.rgb*tint.rgb;
 ROUGHNESS=.95;
}
