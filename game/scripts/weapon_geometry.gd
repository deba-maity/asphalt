class_name WeaponGeometry
extends RefCounted

static func blade() -> ArrayMesh:
	# Diamond cross-section with a sharpened taper, rather than a flat box.
	var st=SurfaceTool.new(); st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var rings=[]
	for row in 4:
		var y=[.365,.21,-.30,-.47][row]
		var width=[.043,.048,.032,.001][row]
		rings.append([Vector3(-width,y,0),Vector3(0,y,-.014),Vector3(width,y,0),Vector3(0,y,.014)])
	for row in 3:
		for side in 4:
			var next=(side+1)%4
			for p in [rings[row][side],rings[row+1][side],rings[row][next],rings[row][next],rings[row+1][side],rings[row+1][next]]: st.add_vertex(p)
	st.generate_normals()
	return st.commit()
