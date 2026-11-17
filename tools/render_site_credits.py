"""Escape complete committed notices into a standalone static license page."""
from pathlib import Path
from html import escape
ROOT=Path(__file__).resolve().parents[1]
sections=[]
for title,path in [('Credits','docs/CREDITS.txt'),('Project license','LICENSE'),('Godot license','docs/GODOT_LICENSE.txt'),('Godot component notices','docs/THIRD_PARTY_NOTICES.txt'),('Trial character and animation assets','docs/PERFORMANCE_ASSET_LICENSE.txt'),('Trial courtyard art','docs/COURT_ASSET_LICENSE.txt'),('Trial foley and instrument recordings','docs/TRIAL_AUDIO_LICENSE.txt')]:
    sections.append('<section><h2>'+title+'</h2><pre>'+escape((ROOT/path).read_text(encoding='utf-8'))+'</pre></section>')
html='''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Credits &amp; licenses — ASHEN VOW</title><link rel="stylesheet" href="styles.css"></head><body><a class="skip" href="#main">Skip to content</a><header class="wrap masthead"><a class="wordmark" href="./">ASHEN VOW</a><a href="./">Back to the game</a></header><main id="main" class="guide wrap"><p class="eyebrow">Original work / shared tools</p><h1>Credits &amp; licenses</h1><p>Original code, writing and score composition are MIT licensed. The trial also uses credited CC0 art, authored animation, foley and orchestral instrument recordings. Engine and asset notices follow in full.</p>'''+''.join(sections)+'</main></body></html>\n'
(ROOT/'site/credits.html').write_text('\n'.join(line.rstrip() for line in html.splitlines())+'\n',encoding='utf-8')
