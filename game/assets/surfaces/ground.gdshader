shader_type spatial;
render_mode diffuse_burley;
uniform sampler2D earth_map : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D normal_map : hint_normal, filter_linear_mipmap, repeat_enable;
uniform vec4 ground_tint : source_color = vec4(.29,.32,.22,1.0);
uniform vec4 path_tint : source_color = vec4(.48,.40,.29,1.0);
varying vec3 world_position;
float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p) {
 vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
 return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
}
void vertex() { world_position=(MODEL_MATRIX*vec4(VERTEX,1.0)).xyz; }
void fragment() {
 vec2 p=world_position.xz;
 float edge=abs(p.x)+noise(p*.7)*.65+noise(p*.15)*.8;
 float path=1.0-smoothstep(2.6,3.8,edge);
 vec3 small=texture(earth_map,p*.65).rgb;
 vec3 large=texture(earth_map,p*.075).rgb;
 float rut=pow(.5+.5*sin(p.x*9.0+noise(p*.3)*2.0),8.0)*.07*path;
 ALBEDO=mix(ground_tint.rgb,path_tint.rgb,path)*small*(.85+large*.55)-rut;
 ROUGHNESS=.96;
 NORMAL_MAP=texture(normal_map,p*.65).rgb;
 NORMAL_MAP_DEPTH=.6;
}
