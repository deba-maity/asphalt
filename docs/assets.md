# Asset pipeline and provenance — pass two

The original source strategy remains: intentionally stylized, hard-jointed characters and editable in-place poses. No purchased assets, downloaded animation packs, franchise material, unknown-license files, external services or generated images are used as 3D models. Original code, writing, meshes and synthesized sounds are MIT-licensed; authorship and runtime/source mappings are in [manifest.json](../game/assets/manifest.json).

Eighteen baked runtime character scenes are committed: Rayan, five settlement NPC variants, the original bandit/scout/foreman, and nine later enemy/boss variants. The common articulated rig retains the original proportions and explicit right-hand weapon grip. Guard/Kesran/Halvek have shields; the bowman has a bow/quiver and authored draw pose; brutes/Serit have wider weapons; elites/Warden have headgear. Three small black loops provide the original Ledger symbol. These are deliberately simple hard-jointed variants, not distinct production-quality skinned character models.

The Counting Shore uses economical floating geometry, a moon/bowl motif, cool lighting and a bounded ring. The mill and village are reused in changed states with different lighting, access, inhabitants and objectives. Separate fortress, bridge, court and memorial construction gives the journey different contexts. All geometry and sounds are original. The existing seven synthesized WAVs are retained for offline feedback; there is no voice acting or scored soundtrack.

```powershell
# Source generation, no graphics window required:
python .\tools\author_campaign.py
python .\tools\author_combat.py
& .\tools\engine\Godot_v4.7.2-stable_win64_console.exe --headless --path game --script res://tests/bake_characters.gd
python .\tools\generate_audio.py
```

Edit `figure.gd` for geometry/role attachments, `poses.json` for joint targets, and the authoring scripts for later content/combat definitions. Rebake after geometry changes; pose data is read directly. Generated runtime assets/data are committed, so the player needs no generator or Blender. Blender was not available in the locations inspected during pass one. Coordinate policy remains one metre/unit, Y up, -Z forward, approximately 1.9m adult height, and 0.64 child scale.

Known limitations: hard joints, approximate stride matching, no foot-IK, skin deformation, fingers, facial motion or motion capture; simple shader/material palette, terrain, scenery silhouettes and combat gestures. The authored betrayal has a short skippable fall using the existing death pose under a separate story state. Additional animation, environmental detail, camera/cinematic framing and sound assessment belong to pass three. No complete rendered pass-two inspection was performed after the user's Remote Desktop instruction; headless checks cannot establish art or audio quality.

Godot is the official unmodified 4.7.2 standard build. `GODOT_LICENSE.txt` and engine-generated `THIRD_PARTY_NOTICES.txt` accompany exports. Default font notices follow Godot's distribution; SystemFont can ask for locally installed Georgia/Liberation Serif for the title, without redistributing OS font files. The engine ZIP checksum and matching Windows-template version remain pinned. No new third-party asset license obligations were introduced.
