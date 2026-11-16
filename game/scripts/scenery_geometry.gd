class_name SceneryGeometry
extends RefCounted

# Original reusable tree/rock meshes. Opaque leaves avoid alpha overdraw.
static var cache: Dictionary={}

static func branch(st: SurfaceTool, start: Vector3, end: Vector3, radius: float, taper: float) -> void:
	var axis=(end-start).normalized()
	var tangent=axis.cross(Vector3.FORWARD).normalized()
	if tangent.length_squared()<.1: tangent=Vector3.RIGHT
	var bitangent=axis.cross(tangent).normalized()
	for i in 9:
		var a=TAU*i/9; var b=TAU*(i+1)/9
		var n=tangent*cos(a)+bitangent*sin(a)
		var m=tangent*cos(b)+bitangent*sin(b)
		for p in [start+n*radius,start+m*radius,end+n*taper,start+m*radius,end+m*taper,end+n*taper]: st.add_vertex(p)

static func tree(variant: int, foliage: bool) -> ArrayMesh:
	var key="tree"+str(variant)+str(foliage)
	if cache.has(key): return cache[key]
	var random=RandomNumberGenerator.new(); random.seed=9351+variant*271
	var st=SurfaceTool.new(); st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var previous=Vector3.ZERO
	for level in 8:
		var center=Vector3(sin(level*.62+variant)*.14,(level+1)*.66,cos(level*.8)*.12)
		if not foliage: branch(st,previous,center,lerpf(.23,.055,level/8.0),lerpf(.23,.055,(level+1)/8.0))
		previous=center
		if level<2: continue
		for side in 3:
			var angle=level*2.37+side*TAU/3+variant
			var direction=Vector3(cos(angle),.25+random.randf()*.25,sin(angle))
			var reach=lerpf(2.05,.55,(level-2)/6.0)*random.randf_range(.8,1.2)
			var tip=center+direction*reach
			if not foliage: branch(st,center,tip,.065*(1-level*.08),.012)
			for twig in 5:
				var base=center.lerp(tip,.35+twig*.13)
				var fan=Vector3(cos(angle+twig*.8),.4,sin(angle+twig*.8))*.6
				if not foliage: branch(st,base,base+fan,.018,.004)
				else:
					for leaf in 11:
						var at=base+fan*(leaf/11.0)+Vector3(random.randf_range(-.15,.15),random.randf_range(-.1,.15),random.randf_range(-.15,.15))
						var yaw=random.randf()*TAU
						var along=Vector3(cos(yaw),random.randf_range(-.2,.5),sin(yaw))*.25
						var across=Vector3(-sin(yaw),.15,cos(yaw))*.095
						st.set_color(Color("657056").lerp(Color("a2a576"),random.randf()*.6))
						for p in [at-along,at+across,at+Vector3.UP*.025,at-along,at+Vector3.UP*.025,at-across,at+Vector3.UP*.025,at+across,at+along,at-across,at+Vector3.UP*.025,at+along]: st.add_vertex(p)
	st.generate_normals()
	cache[key]=st.commit()
	return cache[key]

static func rock(variant: int) -> ArrayMesh:
	var key="rock"+str(variant)
	if cache.has(key): return cache[key]
	var st=SurfaceTool.new(); st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var rings=[]
	for row in 10:
		var ring=[]
		var elevation=PI*row/9
		for col in 15:
			var azimuth=TAU*col/15
			var p=Vector3(sin(elevation)*cos(azimuth),cos(elevation),sin(elevation)*sin(azimuth))
			var distortion=1+.12*sin(azimuth*3+variant+elevation*5)+.08*cos(azimuth*7-elevation*3)
			p*=distortion*.5
			p.y=maxf(-.18,p.y)
			ring.append(p)
		rings.append(ring)
	for row in 9:
		for col in 15:
			var next=(col+1)%15
			for p in [rings[row][col],rings[row+1][col],rings[row][next],rings[row][next],rings[row+1][col],rings[row+1][next]]: st.add_vertex(p)
	st.generate_normals()
	cache[key]=st.commit()
	return cache[key]

static func leaves_material(theme: String="morning") -> ShaderMaterial:
	var key="leaves_material_"+("cinders" if theme=="cinders" else "green")
	if cache.has(key): return cache[key]
	var m=ShaderMaterial.new()
	m.shader=preload("res://assets/surfaces/foliage.gdshader")
	m.set_shader_parameter("tint",Color("77695d") if theme=="cinders" else Color.WHITE)
	cache[key]=m
	return m

static func grass() -> ArrayMesh:
	if cache.has("grass"): return cache.grass
	var st=SurfaceTool.new(); st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in 13:
		var angle=i*2.399
		var at=Vector3(cos(angle),0,sin(angle))*.09*sqrt(i)
		var across=Vector3(cos(angle),0,sin(angle))*.025
		var tip=at+Vector3(sin(angle)*.13,.22+(i%4)*.07,cos(angle)*.13)
		st.set_color(Color("737650").lightened((i%3)*.035))
		for p in [at-across,at+across,tip]: st.add_vertex(p)
	st.generate_normals(); cache.grass=st.commit()
	return cache.grass
