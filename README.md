# Nightshift and Ashen Vow

Play either game in a desktop browser or on a phone. Each game has its own source branch.

| Game | Play | Source and controls |
| --- | --- | --- |
| Nightshift | [Start a race](https://deba-maity.github.io/asphalt/nightshift/) | [Nightshift README](https://github.com/deba-maity/asphalt/blob/nightshift/README.md) |
| Ashen Vow | [Begin the journey](https://deba-maity.github.io/asphalt/ashen-vow/play/) | [Ashen Vow README](https://github.com/deba-maity/asphalt/blob/ashen-vow/README.md) |

In **Nightshift**, choose **Hit the Streets**, pick a mode, district and vehicle, then choose **Deploy**. Hold **W** or **Up** to accelerate. Use **A/D** or **Left/Right** to steer through the green gates.

In **Ashen Vow**, choose **Begin journey · The Counting Shore** for the story and combat tutorial. Walk to the ember with **WASD** and press **E** to listen. **Warden duel** opens a separate boss practice fight.

## First checkout on Windows

Install Git. Open PowerShell in the parent folder where you want to keep the games.

### Nightshift

Install Node.js 22 or newer, then run:

```powershell
git clone --single-branch --branch nightshift https://github.com/deba-maity/asphalt.git nightshift
Set-Location .\nightshift
npm ci
npm run dev
```

Open [Nightshift on your PC](http://localhost:5173) and keep that terminal running. Press **Ctrl+C** there when you finish.

### Ashen Vow

Open PowerShell in the parent folder and run:

```powershell
git clone --single-branch --branch ashen-vow https://github.com/deba-maity/asphalt.git ashen-vow
Set-Location .\ashen-vow
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\setup.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\launch.ps1
```

Setup downloads the pinned Godot engine and imports the art on the first run. Use the launch command for later sessions.

## Pull updates into existing folders

Close the game or stop its dev server. From the parent folder containing both checkouts, run either block.

**Update and start Nightshift**

```powershell
Set-Location .\nightshift
git pull --ff-only origin nightshift
npm ci
npm run dev
```

**Update and start Ashen Vow**

```powershell
Set-Location .\ashen-vow
git pull --ff-only origin ashen-vow
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\setup.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\launch.ps1
```

If your terminal is already inside the game's folder, start with the `git pull` line. The two branch guides above also cover multiplayer, controls and local builds.
