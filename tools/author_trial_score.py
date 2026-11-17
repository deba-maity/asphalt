"""Original 16-bar D-minor encounter score using pinned CC0 orchestral samples.

Requires NumPy and SoundFile for optional offline regeneration. The game uses
committed stereo PCM stems; no synthesis or network is needed at runtime.
The sample recordings remain CC0; composition and integration are original MIT.
"""
from pathlib import Path
import hashlib
import json
import urllib.request
import wave
import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'game/assets/trial_audio'
CACHE = ROOT/'tools/cache/score'
RATE = 44100
BEAT = .75
LENGTH = 48
COUNT = RATE*LENGTH
RNG = np.random.default_rng(7251)


def sources():
    provenance = json.loads((OUT/'score_sources.json').read_text(encoding='utf-8'))
    CACHE.mkdir(parents=True, exist_ok=True)
    for record in provenance['files']:
        path = CACHE/record['file']
        if not path.exists(): path.write_bytes(urllib.request.urlopen(record['url'], timeout=60).read())
        if hashlib.sha256(path.read_bytes()).hexdigest() != record['sha256']:
            raise ValueError('Sample digest mismatch: '+path.name)


def instrument(name):
    data, rate = sf.read(CACHE/name, always_2d=True, dtype='float32')
    if data.shape[1] == 1: data = np.repeat(data, 2, axis=1)
    data -= data.mean(axis=0)
    data /= max(.001, float(abs(data).max()))
    return data, rate


def note(sample, semitones, duration, attack=.025, release=.15):
    data, rate = sample
    count = int((duration+release)*RATE)
    indices = np.arange(count)*(rate/RATE)*2**(semitones/12)
    result = np.column_stack([np.interp(indices, np.arange(len(data)), data[:, channel], right=0) for channel in range(2)])
    time = np.arange(count)/RATE
    envelope = np.minimum(1, time/max(.001, attack))
    envelope *= np.clip((duration+release-time)/release, 0, 1)
    return result*envelope[:, None]


def place(track, sound, start, gain=1, pan=0):
    first = int(round(start*RATE)) % COUNT
    sound = sound*np.array([np.sqrt((1-pan)/2), np.sqrt((1+pan)/2)])*gain
    part = min(len(sound), COUNT-first)
    track[first:first+part] += sound[:part]
    if part<len(sound): track[:len(sound)-part] += sound[part:]


def room(track):
    # Circular convolution includes the previous phrase's decay at the loop
    # boundary, rather than cutting the reverb tail and producing a click.
    impulse = np.zeros((COUNT, 2))
    size = int(RATE*2.7); time = np.arange(size)/RATE
    for channel in range(2):
        noise = RNG.standard_normal(size)
        noise = np.convolve(noise, np.ones(11)/11, mode='same')
        noise *= np.exp(-time*2.6)*np.clip((time-.025)/.04, 0, 1)
        noise /= np.sqrt(np.sum(noise*noise))
        impulse[:size, channel] = noise
    wet = np.fft.irfft(np.fft.rfft(track, axis=0)*np.fft.rfft(impulse, axis=0), n=COUNT, axis=0)
    return track*.82+wet*.18


def main():
    sources()
    cello = instrument('susvib_C1_v1_1.wav')  # recorded C2, MIDI 36
    spiccato = [instrument(f'spic_C1_v2_RR{i}.wav') for i in [1, 2]]
    violin = instrument('VlnEns_susVib_D3_v1.wav')  # recorded D4, MIDI 62
    horn = instrument('MOHorn_sus_D2_v2_1.wav')  # recorded D3, MIDI 50
    drum = instrument('BDrumNewhit_v3_rr1_Sum.wav')
    cymbal = instrument('cymbal-crash1_pp_rr1.wav')
    base = np.zeros((COUNT, 2)); intensity = np.zeros_like(base)
    # Common harmonic vocabulary, original voicing/rhythm/phrase arrangement.
    harmony = [(38, [57, 62, 65]), (34, [53, 57, 62]), (43, [55, 58, 62]), (33, [52, 57, 61])]
    motif = [[62, 65, 64, 62], [62, 60, 57, 53], [55, 58, 62, 65], [64, 62, 61, 57]]
    for bar in range(16):
        root, chord = harmony[bar % 4]; start = bar*BEAT*4
        # Quiet low strings with staggered bow changes; broad spacing leaves
        # the sword/footstep transients readable in the middle frequencies.
        place(base, note(cello, root-36, 2.85, .18, .35), start, .23, .2)
        for voice, pitch in enumerate(chord[:2]):
            place(base, note(violin, pitch-62, 2.7, .3, .4), start+voice*.06, .065, -.25+voice*.3)
        if bar>=4:
            for beat, pitch in enumerate(motif[bar%4]):
                if (bar+beat)%3==0: continue
                place(base, note(violin, pitch-62, .64, .09, .23), start+beat*BEAT, .10 if bar<12 else .075, -.18)
        pattern = [root, root+7, root+12, root+7, root, root+7, root+12, root+7]
        for step, pitch in enumerate(pattern):
            gain = (.15 if step%2==0 else .10)*RNG.uniform(.91, 1.07)
            place(intensity, note(spiccato[step%2], pitch-36, .28, .008, .18), start+step*BEAT/2, gain, .12)
        place(intensity, note(drum, -2, 1.8, .004, .4), start, .17)
        place(intensity, note(drum, 0, 1.2, .004, .3), start+BEAT*2.5, .085)
        if bar%4 in [0,3]:
            place(intensity, note(horn, root+12-50, 2.5, .16, .4), start+.12, .14, .05)
        if bar%4==3:
            place(intensity, note(cymbal, -3, 2.2, .012, .8), start+BEAT*3, .045, -.1)
    base = room(base); intensity = room(intensity)
    gain = .78/max(float(abs(base+intensity).max()), .01)
    report = {'seconds': LENGTH, 'sample_rate': RATE, 'tempo_bpm': 80, 'bars': 16, 'stems': {}}
    for name, data in [('score_base', base*gain), ('score_intensity', intensity*gain)]:
        path = OUT/(name+'.wav')
        with wave.open(str(path), 'wb') as stream:
            stream.setnchannels(2); stream.setsampwidth(2); stream.setframerate(RATE)
            stream.writeframes((np.clip(data, -1, 1)*32767).astype('<i2').tobytes())
        decoded, rate = sf.read(path, always_2d=True)
        stats = {'frames': len(decoded), 'peak': float(abs(decoded).max()),
                 'rms': float(np.sqrt(np.mean(decoded*decoded))),
                 'loop_boundary_step': float(abs(decoded[-1]-decoded[0]).max()),
                 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'bytes': path.stat().st_size}
        if not np.isfinite(decoded).all() or stats['peak']>=.95 or len(decoded)!=COUNT or rate!=RATE:
            raise ValueError('Score validation failed: '+name)
        report['stems'][name] = stats
    (OUT/'score.json').write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__': main()
