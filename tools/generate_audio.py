"""Original deterministic synthesis; stdlib only. Runtime WAVs are committed."""
from pathlib import Path
import math
import random
import struct
import wave

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "game/assets/audio"
OUT.mkdir(parents=True, exist_ok=True)
RATE = 22050
random.seed(85171)


def write(name, duration, sample):
    data = bytearray()
    previous = 0.0
    for i in range(int(RATE * duration)):
        t = i / RATE
        noise = random.uniform(-1, 1)
        previous = previous * 0.95 + noise * 0.05
        value = sample(t, noise, previous)
        data.extend(struct.pack("<h", int(max(-1, min(1, value)) * 32760)))
    with wave.open(str(OUT / f"{name}.wav"), "wb") as f:
        f.setparams((1, 2, RATE, 0, "NONE", "not compressed"))
        f.writeframes(data)


write("swing", .25, lambda t, n, p: n * math.sin(t/.25*math.pi)**2 * .25)
write("hit", .23, lambda t, n, p: (n*.4+math.sin(t*650)*.35)*math.exp(-t*24))
write("guard", .4, lambda t, n, p: (math.sin(t*1900)+math.sin(t*3121))*.22*math.exp(-t*14))
write("parry", .8, lambda t, n, p: (math.sin(t*3450)+math.sin(t*5170))*.2*math.exp(-t*6))
write("heal", 1.1, lambda t, n, p: math.sin(t*(1700+t*900))*.12*math.sin(t/1.1*math.pi)**2)
write("reward", 1.6, lambda t, n, p: sum(math.sin(t*2*math.pi*f)*math.exp(-max(0,t-j*.2)*4) if t>j*.2 else 0 for j,f in enumerate([261.63,329.63,392,523.25]))*.10)
write("hearth_wind", 12, lambda t, n, p: p*.25 + sum(math.sin(t*2*math.pi*f) for f in [130.833333,196,261.666667])*.015*(.5-.5*math.cos(t/12*2*math.pi)))
print("Generated seven original PCM WAV assets.")

write("step_earth", .16, lambda t,n,p: (p*.8+n*.07)*math.exp(-t*36))
write("step_stone", .16, lambda t,n,p: (n*.2+math.sin(t*1700)*.1)*math.exp(-t*45))
# Integer-frequency loops: analytic periodic wind/drone avoids a random-noise seam.
for name, tones in [("amb_wind",[61,83,109]),("amb_river",[93,137,181]),("amb_ashes",[49,73,98])]:
    write(name, 8, lambda t,n,p,fs=tones: sum(math.sin(t*2*math.pi*f)*(.018+.009*math.cos(t*2*math.pi/8)) for f in fs))


def score(t, combat=False):
    # Original four-bar motif; bell envelope dies away before the loop seam.
    notes=[196,220,261.6256,220,174.6141,196,164.8138,196]
    index=int(t/1.5)
    local=t%1.5
    f=notes[index%8]
    envelope=math.exp(-local*(7 if combat else 4))*min(1,local/.02)
    tail=max(0,min(1,(12-t)/.1))
    tone=(math.sin(2*math.pi*f*t)+.25*math.sin(2*math.pi*f*2*t))*.075*envelope
    if combat:
        beat=t%.375
        tone+=math.sin(beat*(350-beat*160))*.07*math.exp(-beat*25)*min(1,beat/.01)
    return tone*tail

write("music_calm",12,lambda t,n,p: score(t))
write("music_combat",12,lambda t,n,p: score(t,True))
print("Generated footsteps, three ambient loops and two original synchronized music stems.")
