"""Export the browser game with texture sizes matched to their use on screen."""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def export(godot: Path, output: Path) -> None:
    # Godot import settings are shared between export presets. Stage the web
    # settings separately so a browser build cannot alter the Windows assets.
    with tempfile.TemporaryDirectory(prefix="ashen-web-") as temporary:
        staging = Path(temporary)
        project = staging / "game"
        shutil.copytree(ROOT / "game", project, ignore=shutil.ignore_patterns(".godot"))
        court = project / "assets" / "court"
        armor = project / "assets" / "performance" / "textures"
        presets = list(court.rglob("*.import")) + list(armor.glob("knight-*.png.import"))
        for preset in presets:
            name = preset.name.lower()
            surface_mask = name == "arm.jpg.import" or "_arm_" in name or "_rough_" in name
            # The full knight atlas is used natively. Browser characters occupy
            # a fraction of a 720p frame, including on the lock-on camera.
            limit = 512 if surface_mask else 1024
            contents = preset.read_text(encoding="utf-8")
            match = re.search(r"^process/size_limit=(\d+)$", contents, re.MULTILINE)
            if match and (int(match[1]) == 0 or int(match[1]) > limit):
                contents = contents[:match.start(1)] + str(limit) + contents[match.end(1):]
                preset.write_text(contents, encoding="utf-8")
        release = staging / "release"
        release.mkdir()
        base = [str(godot), "--headless", "--path", str(project)]
        subprocess.run(base + ["--editor", "--import", "--quit"], check=True)
        subprocess.run(base + ["--export-release", "Web", str(release / "index.html")], check=True)
        output.mkdir(parents=True, exist_ok=True)
        for asset in release.iterdir():
            if asset.is_file():
                shutil.copy2(asset, output / asset.name)
    print(f"Exported {output / 'index.html'} ({(output / 'index.pck').stat().st_size:,} bytes of game data)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--godot", type=Path, help="Path to the Godot executable")
    parser.add_argument("--output", type=Path, default=ROOT / "exports" / "web")
    args = parser.parse_args()
    pin = json.loads((ROOT / "engine-version.json").read_text(encoding="utf-8"))
    local = ROOT / "tools" / "engine" / f"Godot_v{pin['version']}-{pin['status']}_win64_console.exe"
    executable = args.godot or (local if local.is_file() else shutil.which("godot"))
    if executable is None or not Path(executable).is_file():
        parser.error("Supply --godot with the Godot executable used for this project.")
    engine = Path(executable).expanduser().resolve()
    version = subprocess.check_output([str(engine), "--version"], text=True).strip()
    if not version.startswith(f"{pin['version']}.{pin['status']}."):
        parser.error(f"Use the matching Godot build ({pin['version']} {pin['status']}).")
    export(engine, args.output.expanduser().resolve())
