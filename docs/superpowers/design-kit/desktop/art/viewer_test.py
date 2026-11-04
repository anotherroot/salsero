import os, sys
from playwright.sync_api import sync_playwright
f, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch()
    errs = []
    # desktop: pick art by clicking, zoom a group-mode board
    pg = b.new_page(viewport={'width': 1440, 'height': 900}); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + f); pg.wait_for_timeout(1200)
    pg.click('#arts button[data-key="couple"]'); pg.wait_for_timeout(600)
    pg.screenshot(path=f'{out}/viewer-couple.png')
    pg.goto('file://' + f + '#moves--group-mode'); pg.wait_for_timeout(1500)
    pg.keyboard.press('Enter'); pg.wait_for_timeout(1500)
    for a in ['waves', 'dancer']:
        pg.evaluate(f"document.querySelector('#arts button[data-key=\"{a}\"]').click()"); pg.wait_for_timeout(500)
        pg.screenshot(path=f'{out}/zoom-group-{a}.png')
    print('stored:', pg.evaluate("localStorage.getItem('art')"), 'html attr:', pg.evaluate("document.documentElement.dataset.bandArt"))
    # phone: cycle with the bar's button
    c = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    ph = c.new_page(); ph.on('pageerror', lambda e: errs.append(str(e)))
    ph.goto('file://' + f); ph.wait_for_timeout(1200)
    ph.click('#m-art'); ph.click('#m-art'); ph.wait_for_timeout(300)
    ph.click('#m-next'); ph.wait_for_timeout(1200)
    ph.screenshot(path=f'{out}/phone.png')
    print('phone art:', ph.evaluate("document.documentElement.dataset.bandArt"), ph.inner_text('#m-art'))
    print('errors:', errs or 'none')
    b.close()
