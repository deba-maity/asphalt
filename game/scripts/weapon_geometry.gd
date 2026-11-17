class_name WeaponGeometry
extends RefCounted

static func blade() -> ArrayMesh:
	# Beveled edges and a recessed central fuller. The visible blade remains
	# inside the existing physical base/tip endpoints.
	var st=SurfaceTool.new(); st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var rings=[]
	for row in 4:
		var y=[.365,.21,-.30,-.47][row]
		var width=[.043,.048,.032,.001][row]
		rings.append([Vector3(-width,y,0),Vector3(-width*.58,y,-.012),Vector3(-width*.17,y,-.013),Vector3(0,y,-.007),Vector3(width*.17,y,-.013),Vector3(width*.58,y,-.012),Vector3(width,y,0),Vector3(width*.58,y,.012),Vector3(width*.17,y,.013),Vector3(0,y,.007),Vector3(-width*.17,y,.013),Vector3(-width*.58,y,.012)])
	for row in 3:
		for side in 12:
			var next=(side+1)%12
			for pair in [[row,side],[row+1,side],[row,next],[row,next],[row+1,side],[row+1,next]]:
				st.set_uv(Vector2(float(pair[1])/12,float(pair[0])/3))
				st.add_vertex(rings[pair[0]][pair[1]])
	st.generate_normals()
	return st.commit()

static func guard() -> ArrayMesh:
	var tool=SurfaceTool.new(); tool.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in 18:
		for side in 8:
			for pair in [[i,side],[i+1,side],[i,side+1],[i,side+1],[i+1,side],[i+1,side+1]]:
				var t=float(pair[0])/18; var angle=TAU*pair[1]/8
				var radius=lerpf(.013,.022,sin(t*PI))
				var x=(t-.5)*.31
				tool.set_uv(Vector2(t,float(pair[1])/8))
				tool.add_vertex(Vector3(x,-.14+.032*pow(absf(t-.5)*2,2)+cos(angle)*radius,sin(angle)*radius))
	tool.generate_normals(); return tool.commit()

static func wrapping() -> ArrayMesh:
	var tool=SurfaceTool.new(); tool.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in 160:
		for pair in [[i,0],[i+1,0],[i,1],[i,1],[i+1,0],[i+1,1]]:
			var t=float(pair[0])/160; var angle=t*TAU*9
			tool.set_uv(Vector2(t*9,pair[1]))
			tool.add_vertex(Vector3(sin(angle)*.0255,-.12+t*.19+pair[1]*.007,cos(angle)*.0255))
	tool.generate_normals(); return tool.commit()
