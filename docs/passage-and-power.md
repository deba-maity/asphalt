# Passage and lower-power revision — 0.8.0-rc.1

The main Play option now begins with motivation and a guided ramp into combat. Rayan was betrayed by Avel on the Copper Stair. Mira and Isha are already dead; he returns to expose their killers and preserve their names. The Keeper's price is the sound of Isha's voice. The opening explicitly asks the player to accept that cost before combat begins. The three teachers are echoes, not additional living victims.

## Encounter progression

| Encounter | Health | Damage multiplier | Animation rate | Lesson |
|---|---:|---:|---:|---|
| First Echo | 60 | 0.25 | 0.78 | Move, lock on, find blade reach and chain light attacks |
| Patient Echo | 90 | 0.35 | 0.84 | Guard normal cuts or roll clear; evade the raised cleave |
| Resolute Echo | 125 | 0.50 | 0.92 | Wait through a short combination, use heavy openings and healing |
| Cinder Warden | 340 | 1.00 | 1.00 | Original full encounter, including the second phase |

The lessons give more time before attacking and longer recovery between patterns. Health and draughts refill between encounters. Hints adapt to movement, techniques, health and stamina. No perfect parry is required to proceed. A loss retries the current encounter; the direct Warden option remains available. The final result resolves the return and its cost. Campaign Continue and archived chapter saves remain separate.

Slowing a teaching opponent changes its authored animation rate and wall-clock attack phases together. Clip-space hit windows remain unchanged. Physical blade tests at 30 and 60 physics ticks verify one contact per opening light/heavy swing and the intended damage; progression tests cover the screens, retries, save isolation and display budgets. These fixtures verify rules and contact alignment, not whether a human finds the lessons appropriately easy.

## Work and rendering budgets

Display presets offer Lower power (30 FPS / 540p / no MSAA or sun shadows), Balanced (60 FPS / 720p / 2× MSAA), and Sharper (60 FPS / 1080p / 2× MSAA). Existing saved preferences are retained. Physics frequency and damage timing do not change with display presets.

Menus, briefing/results, pause and the journal suspend the world subtree, including cloth. Idle UI updates are capped at 30 FPS; loss of focus pauses play and uses a 10 FPS budget with the engine's low-processor mode. Resuming restores the selected display cap and world processing. Trial HUD text refreshes at 10 Hz while bars, attack cues and the projected lock indicator retain their normal cadence. It no longer constructs unused campaign navigation text every trial frame.

These changes remove unnecessary rendering and simulation. Temperatures and power consumption were not measured on the user's laptop, so they do not prove a thermal improvement on that hardware.

## Validation

The full headless source and six-chapter campaign/Continue suites passed at both 30 and 60 physics ticks. The passage adds 77 checks, including twelve checks of actual slow-motion blade contact/damage. Runtime fingerprint: `be5fba9a1c76b0e2f5df8947733d8c876cce041edc8f77349505ccba32771ac3`.

The real-time endurance runs and packaged verification are recorded separately when completed. No graphical game window, desktop gameplay input, physical-controller test or audio listening session was used on the Remote Desktop. Headless verification cannot establish native rendering quality, frame rate or subjective combat feel.

The character art and existing motion foundation remain as documented in [the armor revision](armored-trial.md). This pass adds onboarding, encounter tuning and resource budgets; it does not claim a new AAA animation production.
