"""Screenshot boards with each band art: ./run.sh art/harness.py OUTDIR css board.html..."""
import os, sys
from playwright.sync_api import sync_playwright
out, cssf, files = sys.argv[1], sys.argv[2], sys.argv[3:]
os.makedirs(out, exist_ok=True)
css = open(cssf).read()
ARTS = ['none', 'gradient', 'couple', 'dancer', 'waves', 'dots', 'glow']
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1440, 'height': 900})
    for f in files:
        html = open(f).read()
        body = html.split('<body>', 1)[1].rsplit('</body>', 1)[0]
        head = html.split('<head>', 1)[1].split('</head>', 1)[0]
        for a in (os.environ.get('ARTS', '').split(',') if os.environ.get('ARTS') else ARTS):
            doc = f'<!doctype html><html data-band-art="{a}"><head>{head}<style>{css}</style></head><body><div class="board">{body}</div></body></html>'
            pg.set_content(doc); pg.wait_for_timeout(400)
            name = os.path.basename(os.path.dirname(f)) + '--' + os.path.basename(f).replace('.html', '') + '--' + a + '.png'
            pg.screenshot(path=os.path.join(out, name)); print(name)
    b.close()
