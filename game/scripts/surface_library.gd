class_name SurfaceLibrary
extends RefCounted

# Shared immutable materials. Fixed palette/texture set survives zone changes.
# 512px maps and ordinary Compatibility materials keep the integrated-GPU path.
static var cache: Dictionary={}
static var maps: Dictionary={}

static func material(kind: String, tint: Color, scale: float=1.0, triplanar: bool=true) -> StandardMaterial3D:
	var key=kind+tint.to_html()+str(scale)+str(triplanar)
	if cache.has(key): return cache[key]
	if not maps.has(kind):
		maps[kind]=[load("res://assets/surfaces/"+kind+".png"),load("res://assets/surfaces/"+kind+"_normal.png")]
	var m=StandardMaterial3D.new()
	m.albedo_color=tint
	m.albedo_texture=maps[kind][0]
	m.normal_enabled=true
	m.normal_texture=maps[kind][1]
	m.normal_scale=.65
	m.roughness=.91 if kind in ["earth","cloth","plaster"] else (.38 if kind=="steel" else .76)
	m.metallic=.78 if kind=="steel" else 0.0
	m.uv1_triplanar=triplanar
	m.uv1_world_triplanar=triplanar
	m.uv1_scale=Vector3.ONE*scale
	m.texture_filter=BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	cache[key]=m
	return m

static func apply(node: Node, kind: String, tint: Color, scale: float=1.0) -> void:
	if node is MeshInstance3D: node.material_override=material(kind,tint,scale)
	else:
		for child in node.get_children():
			if child is MeshInstance3D: child.material_override=material(kind,tint,scale)
