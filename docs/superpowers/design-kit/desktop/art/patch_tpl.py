import sys
p = sys.argv[1]; s = open(p).read()
def sub(old, new, n=1):
    global s
    assert s.count(old) >= 1, old[:60]
    s = s.replace(old, new, n)
sub('</style>\n\n<div class="mbar"',
    '/* the band\'s art: frame.py root() draws an empty [data-art-layer]; <html data-band-art> picks what it shows */\n'
    '.mbar .art { font-size: 13px; min-width: 64px; }\n'
    '/*ART*/\n/*/ART*/\n'
    '</style>\n\n<div class="mbar"')
sub('  <button type="button" class="thm" id="m-theme"',
    '  <button type="button" class="art" id="m-art" aria-label="Next band art">Plain</button>\n  <button type="button" class="thm" id="m-theme"')
sub('    <div class="ctl"><button type="button" class="chk" id="only-new"',
    '    <div class="ctl" role="group" aria-labelledby="art-l">\n'
    '      <span class="ctl-label" id="art-l">Band</span>\n'
    '      <div class="seg" id="arts"></div>\n'
    '    </div>\n'
    '    <div class="ctl"><button type="button" class="chk" id="only-new"')
sub("<kbd>T</kbd> next theme</p>", "<kbd>T</kbd> next theme · <kbd>B</kbd> next band art</p>")
sub("  // only new\n",
    "  // band art\n"
    "  const ARTS = [\n"
    "    { key: 'none', name: 'Plain' }, { key: 'gradient', name: 'Fade' }, { key: 'couple', name: 'Couple' },\n"
    "    { key: 'dancer', name: 'Dancer' }, { key: 'waves', name: 'Waves' }, { key: 'dots', name: 'Dots' }, { key: 'glow', name: 'Glow' },\n"
    "  ];\n"
    "  let art = ARTS.some(a => a.key === store.get('art')) ? store.get('art') : 'none';\n"
    "  const ab = document.getElementById('arts');\n"
    "  ARTS.forEach(a => {\n"
    "    const b = document.createElement('button');\n"
    "    b.type = 'button'; b.dataset.key = a.key; b.textContent = a.name;\n"
    "    b.addEventListener('click', () => setArt(a.key));\n"
    "    ab.appendChild(b);\n"
    "  });\n"
    "  function setArt(key) {\n"
    "    art = key; store.set('art', key);\n"
    "    document.documentElement.dataset.bandArt = key;\n"
    "    ab.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.key === key ? 'true' : 'false'));\n"
    "    const a = ARTS.find(x => x.key === key), m = document.getElementById('m-art');\n"
    "    m.textContent = a.name; m.setAttribute('aria-label', `Band art: ${a.name}. Next band art`);\n"
    "  }\n"
    "  const nextArt = () => setArt(ARTS[(ARTS.findIndex(a => a.key === art) + 1) % ARTS.length].key);\n"
    "  document.getElementById('m-art').addEventListener('click', nextArt);\n"
    "  setArt(art);\n\n"
    "  // only new\n")
sub("      else if (e.key === 't') nextTheme();\n", "      else if (e.key === 't') nextTheme();\n      else if (e.key === 'b') nextArt();\n")
sub("    else if (e.key === 't') nextTheme();\n", "    else if (e.key === 't') nextTheme();\n    else if (e.key === 'b') nextArt();\n")
open(p, 'w').write(s); print('ok')
