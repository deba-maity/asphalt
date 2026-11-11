"""Original pass-two combat definitions, with explicit telegraph/defense rules."""
from pathlib import Path
import json

root=Path(__file__).resolve().parents[1]/"game/content"
d=json.loads((root/"combat.json").read_text(encoding="utf-8"))

def attack(id, windup, active, recovery, damage, reach, **kw):
    d["attacks"][id]=dict(cost=0,windup=windup,active=active,recovery=recovery,damage=damage,reach=reach,arc=0.0,**kw)

attack("guard_cut",.72,.15,.9,18,2.25)
attack("brute_crush",1.3,.22,1.6,28,2.9,blockable=False,pose="heavy",stamina_damage=45)
attack("bow_shot",1.1,.1,1.5,16,18,projectile=True,pose="bow",tracking=.45)
attack("elite_catch",.62,.18,1.0,21,3.2,tracking=.38)
attack("varo_lunge",.65,.14,.7,19,2.7,tracking=.15)
attack("varo_feint",1.1,.16,1.15,24,2.5,tracking=.2)
attack("kesran_return",.52,.14,.7,19,2.4)
attack("trial_ring",1.0,.22,1.2,18,3.2,blockable=False,parryable=False,pose="heavy")
attack("trial_echo",.8,.15,1.2,15,2.8,blockable=False,pose="heavy")
attack("serit_throw",.85,.1,1.0,19,17,projectile=True,pose="bow")
attack("serit_cleave",.95,.23,1.2,28,3.0,blockable=False,pose="heavy")
attack("halvek_cut",.7,.18,.55,21,2.6)
attack("halvek_seal",1.22,.23,1.6,32,3.1,blockable=False,parryable=False,pose="heavy")
attack("opening_counter",.2,.2,.7,58,2.85,counter=True,pose="heavy")
d["attacks"]["opening_counter"]["cost"]=22

def enemy(id, behavior, health, speed, attacks, color, scale=1.0, **kw):
    d["enemies"][id]=dict(health=health,speed=speed,notice=12,attacks=attacks,color=color,scale=scale,behavior=behavior,**kw)

enemy("ledger_guard","guard",78,2.0,["guard_cut"],"596c74")
enemy("ledger_brute","heavy",110,1.8,["brute_crush"],"735b48",1.14)
enemy("ledger_archer","ranged",52,2.5,["bow_shot"],"7c7854")
enemy("ledger_elite","elite",92,2.9,["guard_cut","elite_catch"],"514966",1.03)
enemy("captain_varo","varo",170,2.8,["varo_lunge","varo_lunge","varo_feint"],"843f3b",1.08,boss=True,name="Captain Varo")
enemy("lieutenant_kesran","kesran",205,2.1,["guard_cut","kesran_return","brute_crush"],"445d71",1.1,boss=True,name="Lieutenant Kesran")
enemy("still_warden","warden",190,1.7,["trial_ring","trial_echo"],"8497a1",1.2,boss=True,name="The Still Warden")
enemy("marshal_serit","serit",235,2.4,["serit_cleave","serit_throw","elite_catch"],"574d6b",1.12,boss=True,name="Marshal Serit")
enemy("halvek","halvek",310,2.4,["halvek_cut","guard_cut","halvek_cut"],"9a8757",1.1,boss=True,name="Halvek · Keeper of the Ledger",phase2=["halvek_seal","serit_throw","elite_catch"])
for e in d["enemies"].values(): e.setdefault("behavior","aggressive")
for a in d["attacks"].values():
    for key,value in dict(tracking=.12,interruptible=True,blockable=True,parryable=True,dodgeable=True,stamina_damage=0,posture=10,cue="swing",pose="light").items(): a.setdefault(key,value)
for id in ["heavy","foreman_slam"]: d["attacks"][id]["pose"]="heavy"
for id in ["heavy","opening_counter","brute_crush","halvek_seal"]: d["attacks"][id]["posture"]=55
d["ashstep"]=dict(duration=.5,invulnerable_start=.04,invulnerable_end=.36,speed=11.5,cost=1.0,counter_window=2.5)
(root/"combat.json").write_text(json.dumps(d,indent=2)+"\n",encoding="utf-8")
print("Authored",len(d["enemies"]),"enemy types and",len(d["attacks"]),"attacks.")
