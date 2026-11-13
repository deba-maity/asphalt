class_name SceneryDetails
extends RefCounted

static func bowl(parent: Node3D, at: Vector3) -> void:
	Figure.cylinder(parent,.23,.34,.10,at+Vector3.UP*.06,Color("a27658"),10)
	Figure.cylinder(parent,.23,.29,.035,at+Vector3.UP*.125,Color("4c4840"),10)
	Figure.box(parent,Vector3(.17,.035,.10),at+Vector3(.04,.15,0),Color("c7aa69"))

static func bird(parent: Node3D, at: Vector3) -> void:
	Figure.box(parent,Vector3(.22,.12,.12),at+Vector3.UP*.1,Color("bc9b65"))
	Figure.box(parent,Vector3(.08,.11,.10),at+Vector3(.11,.17,0),Color("bb9862"))
	var wing=Figure.box(parent,Vector3(.14,.025,.22),at+Vector3(-.02,.15,0),Color("9d8158"))
	wing.rotation.z=-.2
	Figure.box(parent,Vector3(.025,.055,.23),at+Vector3(.0,.16,0),Color("e5c86f"))

static func ledger(parent: Node3D, at: Vector3, cloth: bool=false) -> void:
	Figure.box(parent,Vector3(.55,.09,.38),at+Vector3.UP*.06,Color("765e53"))
	Figure.box(parent,Vector3(.48,.025,.32),at+Vector3.UP*.12,Color("d4c9a8"))
	for i in 4: Figure.box(parent,Vector3(.3,.005,.012),at+Vector3(0,.135,-.1+i*.055),Color("77766c"))
	if cloth: Figure.box(parent,Vector3(.12,.03,.42),at+Vector3(.1,.15,0),Color("7c98a0"))

static func lantern(parent: Node3D, at: Vector3, dark: bool=false) -> void:
	var iron=Color("484e4c")
	Figure.box(parent,Vector3(.25,.32,.25),at,Color("504e45") if dark else Color("dfbe82"))
	for x in [-.15,.15]:
		for z in [-.15,.15]: Figure.box(parent,Vector3(.035,.4,.035),at+Vector3(x,0,z),iron)
	Figure.cylinder(parent,.24,.08,.18,at+Vector3.UP*.28,iron,4)

static func insignia(parent: Node3D, at: Vector3) -> void:
	Figure.box(parent,Vector3(.65,.8,.035),at,Color("a29478"))
	for i in 3:
		var ring=MeshInstance3D.new()
		var shape=TorusMesh.new()
		shape.inner_radius=.055; shape.outer_radius=.082
		shape.rings=10; shape.ring_segments=4
		ring.mesh=shape
		ring.material_override=Figure.material(Color("303b3f"))
		ring.rotation.x=PI/2
		ring.position=at+Vector3(-.17+i*.17,0,-.035)
		parent.add_child(ring)

static func village(world: Node3D, theme: String) -> void:
	var burnt=theme=="cinders"
	# Keep detailed props off the traversable central lane and interaction roots.
	Figure.box(world,Vector3(1.6,.12,.65),Vector3(-6.1,.60,6.1),Color("806348"))
	for x in [-6.7,-5.5]: Figure.box(world,Vector3(.12,.6,.4),Vector3(x,.3,6.1),Color("665746"))
	bowl(world,Vector3(-6.3,.67,6.1))
	bird(world,Vector3(-5.7,.67,6.1))
	lantern(world,Vector3(-5,2.1,5.2),burnt)
	# Bakery awning and bread tray; shelter silhouette marks the market.
	for x in [-7.5,-4.5]: Figure.cylinder(world,.065,.065,2.35,Vector3(x,1.18,-2.4),Color("745e46"),6)
	var awning=Figure.box(world,Vector3(3.4,.06,1.6),Vector3(-6,2.4,-2.7),Color("857960") if burnt else Color("ae7957"))
	awning.rotation.x=.1
	Figure.box(world,Vector3(1.7,.07,.6),Vector3(3,.65,-9.8),Color("786044"))
	ledger(world,Vector3(3,.7,-9.8),true)
	lantern(world,Vector3(4.45,2.4,-11.5),burnt)
	if theme=="memorial":
		bowl(world,Vector3(.5,.0,-14.5))
		bird(world,Vector3(-.5,.0,-14.5))
	if burnt: ledger(world,Vector3(-4.7,.05,-3),true)

static func object_prop(world: Node3D, id: String, at: Vector3) -> void:
	if "bird" in id: bird(world,at+Vector3.UP*.6)
	elif "bowl" in id or id=="obj_memorial": bowl(world,at+Vector3.UP*.6)
	elif "note" in id or "list" in id or "register" in id or "letter" in id or "seal" in id or "orders" in id or "ledger" in id:
		ledger(world,at+Vector3.UP*.6,"letter" in id)
	elif "willow" in id:
		for i in 5:
			var stick=Figure.box(world,Vector3(.035,.035,.45),at+Vector3(i*.04,.6,0),Color("997b53"))
			stick.rotation.y=i*.05
	elif "varo" in id:
		ledger(world,at+Vector3.UP*.6)
		insignia(world,at+Vector3(0,1.0,.2))

static func route(world: Node3D, theme: String, length: float) -> void:
	var stone=theme in ["fortress","court","dawn"]
	for i in int(length/16):
		var z=-8-i*16
		var side=-1 if i%2==0 else 1
		var at=Vector3(side*5.5,0,z)
		Figure.cylinder(world,.12,.1,2,at+Vector3.UP,Color("797665"),6)
		lantern(world,at+Vector3.UP*2.1,theme=="cinders")
		if stone: insignia(world,at+Vector3(0,1,.15))
	if theme=="court":
		# Radial stone strips echo the Ledger seal; no collision inside the duel space.
		for i in 12:
			var a=i*TAU/12
			var tile=Figure.box(world,Vector3(.3,.018,3.0),Vector3(sin(a)*9,.18,-35+cos(a)*9),Color("6e7e80"))
			tile.rotation.y=a
		insignia(world,Vector3(0,1.8,-55.5))
