"""Editable original campaign authoring source. Generates local JSON and zone scenes."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1] / "game"
CONTENT = ROOT / "content"
SCENES = ROOT / "scenes/zones"
SCENES.mkdir(parents=True, exist_ok=True)


def dump(path, data):
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


chapters = [
    ("ch01_bread_steel", "Bread and Steel", "zone_hearthmere"),
    ("ch02_night_cinders", "Night of Cinders", "zone_cinder_errand"),
    ("ch03_road_revenge", "The Road of Revenge", "zone_sere_mill"),
    ("ch04_between_ashes", "Between Ashes", "zone_counting_shore"),
    ("ch05_returned", "The Returned", "zone_mill_return"),
    ("ch06_last_dawn", "The Last Dawn", "zone_dawn_approach"),
]
manifest = {"chapters": [{"id": c, "title": t, "entry": z, "number": i+1} for i, (c, t, z) in enumerate(chapters)], "zones": {}, "speculative_budget_mb": 24}
manifest["zones"]["zone_hearthmere"] = {"chapter": chapters[0][0], "scene": "res://scenes/zones/hearthmere.tscn", "data": "res://content/chapter_01.json", "checkpoint": "cp_home", "checkpoints": {"cp_home": [0,0,7], "cp_road_shrine": [0,0,-34]}, "estimate_mb": 6}


def lines(*pairs):
    return [list(p) for p in pairs]


def interaction(id, name, pos, dialogue, flag="", requires=(), effect="", optional=False, transition="", choice=False):
    return dict(id=id, name=name, position=pos, dialogue=dialogue, flag=flag, requires=list(requires), effect=effect, optional=optional, transition=transition, choice=choice)


def encounter(id, z, kinds, requires=(), boss="", reward=0):
    return {"id": id, "flag": "evt_"+id+"_clear", "center": [0,0,z], "requires": list(requires), "boss": boss, "reward": reward,
            "enemies": [{"id": id+"_"+str(i), "kind": kind, "position": [(-1.5 if i == 0 else 2.5) if len(kinds)>1 else 0,0,z-i*3]} for i, kind in enumerate(kinds)]}


def quest(id, text, target, until, requires=()):
    return dict(id=id, text=text, target=target, until=until, requires=list(requires))


def zone(id, chapter, title, theme, length, objects, encounters, quests, next_zone="", npcs=(), extra=None):
    cp = "cp_"+id.removeprefix("zone_")
    d = dict(id=chapter, zone_id=id, title=title, theme=theme, length=length, npcs=list(npcs), objects=objects, encounters=encounters, quests=quests, next=next_zone,
             checkpoints=[dict(id=cp, position=[0,0,7], label=title)], zones=[dict(id=id,title=title,north=-length)])
    if extra: d.update(extra)
    for enc in encounters:
        if enc["boss"]:
            d["checkpoints"].append(dict(id="cp_before_"+enc["boss"],position=[0,0,enc["center"][2]+14],label="Before "+enc["boss"].removeprefix("boss_")))
    dump(CONTENT / (id+".json"),d)
    kinds = sorted({e["kind"] for enc in encounters for e in enc["enemies"]})
    actors = sorted(set(kinds + [n.get("asset","oren") for n in npcs]))
    resources = ['[ext_resource type="Script" path="res://scripts/campaign_zone.gd" id="1"]']
    resources += [f'[ext_resource type="PackedScene" path="res://assets/characters/{a}.tscn" id="a{i}"]' for i,a in enumerate(actors)]
    array = ', '.join(f'ExtResource("a{i}")' for i in range(len(actors)))
    (SCENES / (id+".tscn")).write_text(f'[gd_scene load_steps={len(resources)+1} format=3]\n\n'+"\n".join(resources)+f'\n\n[node name="{id}" type="Node3D"]\nscript = ExtResource("1")\nzone_id = "{id}"\nactor_resources = Array[PackedScene]([{array}])\n', encoding="utf-8")
    manifest["zones"][id] = dict(chapter=chapter,scene=f"res://scenes/zones/{id}.tscn", data=f"res://content/{id}.json",checkpoint=cp,checkpoints={p["id"]:p["position"] for p in d["checkpoints"]},estimate_mb=4+len(actors))


def npc(id,name,pos,asset="oren"):
    return dict(id=id,name=name,position=pos,asset=asset)


c2=chapters[1][0]
zone("zone_cinder_errand",c2,"The morning road","morning",42,[
    interaction("obj_morning_note","Mira's errand",[-3,0,5],lines(("Mira","Edda's fever has broken. Will you fetch willow bark from the south orchard?"),("Isha","I kept the last crust. It is a boat now."),("Rayan","Then don't sail it in the soup.")),"evt_errand_started"),
    interaction("obj_willow","Willow bark",[3,0,-29],lines(("Rayan","Enough for Edda. The orchard keeper has tied it with blue thread, just as Mira asked.")),"evt_willow",["evt_errand_started"]),
    interaction("exit_home","Return by the village lane",[0,0,-38],lines(("Rayan","No cooking smoke. Why is the bell quiet?")),requires=["evt_willow"],transition="zone_cinder_home")
],[],[
    quest("q_errand","Read Mira's morning errand.",[-3,0,5],"evt_errand_started"),quest("q_willow","Fetch bark at the orchard shelter.",[3,0,-29],"evt_willow",["evt_errand_started"]),quest("q_return","Return to Hearthmere.",[0,0,-38],"evt_home_arrival",["evt_willow"])
],"zone_cinder_home",[npc("npc_memory_mira","Mira",[-4,0,5],"mira"),npc("npc_memory_isha","Isha",[-5,0,5],"isha")])
zone("zone_cinder_home",c2,"Hearthmere · after the bell","cinders",70,[
    interaction("obj_bird","Isha's wooden bird",[-3,0,5],lines(("Rayan","The wing is tied with her yellow thread. She said a broken thing could still be a bird."),("Rayan","Mira? Isha?")),"evt_bird_found"),
    interaction("obj_seam","Mira's sewing basket",[-5,0,-3],lines(("Rayan","Names, stitched under the lining. Mira hid a list here. The lining has been cut away.")),"discovery_seam",optional=True),
    interaction("npc_edda","Edda · survivor",[4,0,-5],lines(("Edda","I was at the well. Mira put Isha behind her. The captain asked for a courier's list."),("Rayan","Where are they?"),("Edda","At your doorstep. Tova covered them. I'm so sorry."),("Rayan","Who?"),("Edda","The Cinder Ledger. Three black loops. Captain Varo left north, with men still searching the houses.")),"evt_edda_testimony",["evt_bird_found"]),
    interaction("obj_varo_seal","Varo's dispatch case",[1,0,-56],lines(("Varo's dispatch","Deliver the copied register to Lieutenant Kesran at Sere Mill. Seal every witness account. — H."),("Rayan","A register. They killed them for a page.")),"evt_varo_evidence",["evt_cinder_captain_clear"]),
    interaction("exit_mill","Leave for Sere Mill",[0,0,-66],lines(("Edda","I will stay. Someone has to speak their names here."),("Rayan","Mira. Isha. Keep them safe from silence.")),requires=["evt_varo_evidence"],effect="complete_chapter",transition="zone_sere_mill")
],[encounter("cinder_pursuit",-23,["road_bandit","wood_scout"],["evt_edda_testimony"]),encounter("cinder_captain",-49,["captain_varo"],["evt_cinder_pursuit_clear"],"boss_varo",20)], [
    quest("q_bird","Search your doorstep.",[-3,0,5],"evt_bird_found"),quest("q_edda","Find Edda by the well.",[4,0,-5],"evt_edda_testimony",["evt_bird_found"]),quest("q_raiders","Pursue the raiders beyond the gate.",[0,0,-23],"evt_cinder_pursuit_clear",["evt_edda_testimony"]),quest("q_varo","Defeat Captain Varo at the old road.",[0,0,-49],"evt_cinder_captain_clear",["evt_cinder_pursuit_clear"]),quest("q_case","Read Varo's sealed dispatch.",[1,0,-56],"evt_varo_evidence",["evt_cinder_captain_clear"]),quest("q_leave_home","Leave for Sere Mill.",[0,0,-66],"ch02_complete",["evt_varo_evidence"])
],"zone_sere_mill",[npc("npc_edda_body","Edda",[4,0,-5],"tova")])
c3=chapters[2][0]
zone("zone_sere_mill",c3,"Sere Fen · riverside mill","mill",79,[
    interaction("obj_mill_notice","The mill gate",[3,0,1],lines(("Confiscation order","Every boat, every road, every name entered in the Ledger. Unregistered passage is theft.")),"discovery_levy",optional=True),
    interaction("npc_neri","Neri · imprisoned courier",[-4,0,-30],lines(("Neri","Mira mended my coat. Found the register sewn inside. She copied the names of families scheduled for a 'cleansing'."),("Rayan","Why didn't she tell me?"),("Neri","She was trying to get them out before you had to fight anyone. Your wife wasn't waiting to be saved."),("Neri","Take this whetstone. Turn the heavy edge across a guard, not into it.")),"evt_neri_rescued",["evt_mill_guard_clear"],"tempered_edge"),
    interaction("obj_mill_bench","Oren's repair kit · 20 crowns",[5,0,-36],lines(("Oren's note","A deeper draught bottle. If you're still on that road, take what you need. Pay Tova when you can.")),"purchase_deep_flask",["evt_neri_rescued"],"deep_flask",True,choice=True),
    interaction("obj_ferry_ledger","Ferry witness list",[-5,0,-59],lines(("Register","Hearthmere: copies outstanding. Family of Mira, seamstress. Witness disposal authorized by Halvek."),("Rayan","Not a levy. A sentence, written before they came.")),"evt_ferry_list",["evt_ferry_watch_clear"]),
    interaction("exit_stair","Boat to the Copper Stair",[0,0,-75],lines(("Neri","Kesran commands the stair. Avel claims he can get us through after Kesran falls."),("Rayan","Then we go together.")),requires=["evt_ferry_list"],transition="zone_copper_stair")
],[encounter("mill_guard",-21,["ledger_guard","ledger_archer"]),encounter("ferry_watch",-51,["ledger_brute","ledger_guard"],["evt_neri_rescued"],reward=15)],[
    quest("q_mill_guard","Break the mill guard and its bowman.",[0,0,-21],"evt_mill_guard_clear"),quest("q_rescue","Free Neri beside the wheel.",[-4,0,-30],"evt_neri_rescued",["evt_mill_guard_clear"]),quest("q_ferry","Use heavy attacks to break guards at the ferry.",[0,0,-51],"evt_ferry_watch_clear",["evt_neri_rescued"]),quest("q_list","Read the ferry witness list.",[-5,0,-59],"evt_ferry_list",["evt_ferry_watch_clear"]),quest("q_boat","Take the boat to the Copper Stair.",[0,0,-75],"evt_stair_arrival",["evt_ferry_list"])
],"zone_copper_stair",[npc("npc_neri_body","Neri",[-4,0,-30],"saren")])
zone("zone_copper_stair",c3,"The Copper Stair","fortress",81,[
    interaction("npc_avel","Avel · gate captain",[4,0,1],lines(("Avel","Kesran holds the inner gate. Defeat him and I can open the road to Halvek."),("Rayan","Why would you help?"),("Avel","A man grows tired of signing orders he cannot bear to read.")),"evt_avel_promise"),
    interaction("obj_betrayal","The inner passage",[0,0,-74],lines(("Kesran","You think Halvek fears your sword? He fears a name he cannot erase."),("Avel","Lower your blade, Rayan. The passage is open."),("Rayan","You said Neri could come."),("Avel","I said I could open a road."),("Narration","The bowstrings answer behind him. The fight is already won. The betrayal is not another battle."),("Rayan","Mira. I was coming home.")),requires=["evt_stair_lieutenant_clear"],effect="story_death",transition="zone_counting_shore")
],[encounter("stair_patrol",-22,["ledger_guard","ledger_brute"],["evt_avel_promise"]),encounter("stair_lieutenant",-58,["lieutenant_kesran"],["evt_stair_patrol_clear"],"boss_kesran",25)],[
    quest("q_avel","Hear Avel at the gate.",[4,0,1],"evt_avel_promise"),quest("q_stair_patrol","Clear the occupied stair approach.",[0,0,-22],"evt_stair_patrol_clear",["evt_avel_promise"]),quest("q_kesran","Defeat Lieutenant Kesran. This fight can be won.",[0,0,-58],"evt_stair_lieutenant_clear",["evt_stair_patrol_clear"]),quest("q_passage","Meet Avel at the opened passage.",[0,0,-74],"evt_story_death",["evt_stair_lieutenant_clear"])
],"zone_counting_shore",[npc("npc_avel_body","Avel",[4,0,1],"saren")])
c4=chapters[3][0]
zone("zone_counting_shore",c4,"The Counting Shore","ashes",83,[
    interaction("obj_bowl","A broken moon",[-4,0,-7],lines(("Isha's memory","Oren says the moon is a bowl. I think someone dropped it."),("Rayan","I remember the words. Why can't I hear you?")),"evt_shore_memory"),
    interaction("npc_keeper","The Keeper",[4,0,-18],lines(("Keeper","Your death is behind you. Your anger is not a door."),("Rayan","Give me a road back."),("Keeper","Earn one. I will lend you a step between blows. Returning takes the sound of the voice you came here to keep."),("Rayan","Her words?"),("Keeper","You may keep her words. Never again her voice. Choose with that knowledge.")),"evt_trial_choice",["evt_shore_memory"],"lend_ashstep",choice=True),
    interaction("obj_trial_help","The first ash mark",[-4,0,-28],lines(("Ash mark","{ashstep} / left trigger: Ashstep. Three Resolve charges. Step as the Warden's gold ring closes; an exact evasion opens a heavy counter. Parrying also opens a counter. Strikes and parries restore Resolve.")),"discovery_ash_mark",optional=True),
    interaction("exit_return","Choose the living road",[0,0,-78],lines(("Keeper","The trial is yours. The price remains."),("Rayan","Isha told me to keep the last crust. I can carry that, even in silence."),("Keeper","Then go. This road opens once.")),requires=["evt_trial_warden_clear","evt_ashstep_evade","evt_shore_crossed"],effect="resurrection",transition="zone_mill_return",choice=True)
],[encounter("trial_warden",-40,["still_warden"],["evt_trial_choice"],"boss_warden",0)],[
    quest("q_memory","Follow the broken moon to a memory.",[-4,0,-7],"evt_shore_memory"),quest("q_choice","Choose the Keeper's trial.",[4,0,-18],"evt_trial_choice",["evt_shore_memory"]),quest("q_ash_tutorial","{ashstep}: evade a Warden blow with Ashstep, then heavy-counter.",[0,0,-40],"evt_ashstep_evade",["evt_trial_choice"]),quest("q_trial","Defeat the Still Warden.",[0,0,-40],"evt_trial_warden_clear",["evt_ashstep_evade"]),quest("q_shore_gate","Ashstep through the pale veil ahead.",[0,0,-61],"evt_shore_crossed",["evt_trial_warden_clear"]),quest("q_return_life","Choose the living road and its cost.",[0,0,-78],"evt_resurrected",["evt_shore_crossed"])
],"zone_mill_return",[npc("npc_keeper_body","The Keeper",[4,0,-18],"oren")],{"ward_z":-61,"ward_flag":"evt_shore_crossed"})
c5=chapters[4][0]
zone("zone_mill_return",c5,"Sere Mill · the drained channel","returned",82,[
    interaction("npc_neri_return","Neri",[4,0,1],lines(("Neri","I watched them carry you out. I couldn't stop them."),("Rayan","You can help me finish this."),("Neri","Serit's hunters watch for desperate dodges. Don't spend your new step without a way back.")),"evt_return_witness"),
    interaction("obj_mira_letter","A lining beneath the millstone",[-5,0,-13],lines(("Mira's letter","Rayan, if this reaches you first: they were children on a list. I could not put the coat back as if I hadn't seen it. Guard people, not their gates. — M."),("Rayan","You were already on this road before me.")),"discovery_mira_letter",optional=True),
    interaction("obj_marshal_orders","Serit's marked route",[3,0,-64],lines(("Serit's orders","Halvek has withdrawn to the Dawn Court. No witnesses past the last bridge. His own guard may not leave."),("Neri","He is closing the book on all of us.")),"evt_serit_route",["evt_return_marshal_clear"]),
    interaction("exit_dawn","Take the last bridge road",[0,0,-77],lines(("Rayan","Then we open it.")),requires=["evt_serit_route"],effect="complete_chapter",transition="zone_dawn_approach")
],[encounter("return_hunters",-36,["ledger_elite","ledger_archer"],["evt_mill_veil_crossed"]),encounter("return_marshal",-57,["marshal_serit"],["evt_return_hunters_clear"],"boss_serit",30)],[
    quest("q_return_witness","Speak to Neri by the drained mill.",[4,0,1],"evt_return_witness"),quest("q_return_veil","Ashstep through the Ledger's ward.",[0,0,-24],"evt_mill_veil_crossed",["evt_return_witness"]),quest("q_hunters","Break the hunter and bowman. Vary your defense.",[0,0,-36],"evt_return_hunters_clear",["evt_mill_veil_crossed"]),quest("q_serit","Defeat Marshal Serit at the dry lock.",[0,0,-57],"evt_return_marshal_clear",["evt_return_hunters_clear"]),quest("q_route","Read the marshal's last orders.",[3,0,-64],"evt_serit_route",["evt_return_marshal_clear"]),quest("q_last_bridge","Take the road to the Dawn Court.",[0,0,-77],"ch05_complete",["evt_serit_route"])
],"zone_dawn_approach",[npc("npc_neri_return_body","Neri",[4,0,1],"saren")],{"ward_z":-24,"ward_flag":"evt_mill_veil_crossed"})
c6=chapters[5][0]
zone("zone_dawn_approach",c6,"The last bridge","dawn",73,[
    interaction("obj_last_register","The last register",[-4,0,-31],lines(("Neri","Here. Every family paid for the privilege of surviving. Every refusal marked for fire."),("Rayan","Mira copied this so they could leave. Keep it. This has to outlive him.")),"evt_last_register",["evt_dawn_bridge_clear"]),
    interaction("obj_guard_confession","A guard's abandoned pack",[5,0,-46],lines(("Unsent letter","He has barred the court from inside. We guard a man who counts our children too.")),"discovery_guard_letter",optional=True),
    interaction("exit_court","Enter the Dawn Court",[0,0,-68],lines(("Neri","I will open the outer gate for the people in the book."),("Rayan","Leave it open when I return.")),requires=["evt_last_register","evt_dawn_gate_clear"],transition="zone_dawn_court")
],[encounter("dawn_bridge",-22,["ledger_guard","ledger_archer"]),encounter("dawn_gate",-54,["ledger_elite","ledger_brute"],["evt_last_register"])],[
    quest("q_last_guard","Take the last bridge.",[0,0,-22],"evt_dawn_bridge_clear"),quest("q_register","Save the original register.",[-4,0,-31],"evt_last_register",["evt_dawn_bridge_clear"]),quest("q_gate_elites","Clear the inner gate.",[0,0,-54],"evt_dawn_gate_clear",["evt_last_register"]),quest("q_court","Enter the Dawn Court.",[0,0,-68],"evt_court_arrival",["evt_dawn_gate_clear"])
],"zone_dawn_court")
zone("zone_dawn_court",c6,"The Dawn Court","court",69,[
    interaction("obj_halvek","Halvek · keeper of the Ledger",[0,0,-9],lines(("Halvek","Your wife could have handed back a coat. Instead she gave strangers a way out."),("Rayan","You killed a child to recover your list."),("Halvek","An order must be believed. Fear is cheaper than a garrison."),("Rayan","Then see what your savings bought.")),"evt_halvek_confronted"),
    interaction("obj_court_end","The broken seal",[0,0,-53],lines(("Halvek","If you burn the book, no one will know what was owed."),("Rayan","They will know what you did. Neri has the names."),("Narration","Rayan cuts the three-loop seal from the counting table. Beyond the gate, the first travelers step onto an unclaimed road.")),"evt_ledger_broken",["evt_final_halvek_clear"]),
    interaction("exit_memorial","Return to Hearthmere",[0,0,-64],lines(("Neri","Will you hear them again?"),("Rayan","No. That was the price. But I still know what they asked of me.")),requires=["evt_ledger_broken"],transition="zone_memorial")
],[encounter("final_halvek",-35,["halvek"],["evt_halvek_confronted"],"boss_halvek",0)],[
    quest("q_halvek_words","Face Halvek at the court entrance.",[0,0,-9],"evt_halvek_confronted"),quest("q_halvek","Defeat Halvek. His broken seal changes his stance.",[0,0,-35],"evt_final_halvek_clear",["evt_halvek_confronted"]),quest("q_broken_ledger","Cut the Ledger's seal.",[0,0,-53],"evt_ledger_broken",["evt_final_halvek_clear"]),quest("q_home_again","Return to Hearthmere.",[0,0,-64],"evt_memorial_arrival",["evt_ledger_broken"])
],"zone_memorial")
zone("zone_memorial",c6,"Hearthmere · after the last dawn","memorial",36,[
    interaction("obj_bowl_memorial","Oren's clay bowl",[5,0,3],lines(("Oren","It doesn't leak. I thought that might matter."),("Rayan","It does.")),"evt_bowl_placed"),
    interaction("obj_bird_memorial","Set down the wooden bird",[-3,0,-4],lines(("Rayan","A broken thing can still be a bird.")),"evt_bird_placed",["evt_bowl_placed"]),
    interaction("obj_memorial","Mira and Isha's memorial",[0,0,-15],lines(("Narration","He leaves the last crust in the bowl. He remembers the joke about the soup. He cannot recover the sound of her laughter."),("Rayan","Mira. Isha. I came home."),("Narration","At the gate a traveler asks for the north road. Rayan rises. He knows the way.")),"campaign_complete",["evt_bird_placed"],"ending")
],[],[
    quest("q_bowl","Bring Oren's bowl to the memorial.",[5,0,3],"evt_bowl_placed"),quest("q_bird_rest","Set down Isha's wooden bird.",[-3,0,-4],"evt_bird_placed",["evt_bowl_placed"]),quest("q_memorial","Keep the last crust.",[0,0,-15],"campaign_complete",["evt_bird_placed"])
],npcs=[npc("npc_oren_memorial","Oren",[6,0,3],"oren")])

(SCENES / "hearthmere.tscn").write_text('[gd_scene load_steps=2 format=3]\n[ext_resource type="Script" path="res://scripts/world.gd" id="1"]\n[node name="Hearthmere" type="Node3D"]\nscript = ExtResource("1")\n',encoding="utf-8")
dump(CONTENT / "campaign.json",manifest)
print(f"Authored {len(chapters)} chapters and {len(manifest['zones'])} packaged zones.")
