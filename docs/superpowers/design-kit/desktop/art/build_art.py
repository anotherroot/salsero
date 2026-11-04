"""Build the band-art CSS (data-URI SVGs) and write it into template.html between /*ART*/ markers.
   python3 -I build_art.py TEMPLATE  (or with --css OUT to only write a css file)"""
import sys
from urllib.parse import quote

def uri(svg):
    return 'url("data:image/svg+xml,' + quote(svg, safe=" =:/'-.,;()") + '")'

import os
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "shapes.py")).read())

# --- flowing curves along the band row and down the side. viewBox 1440 x 900 ---
def waves():
    paths = ''
    for i in range(7):
        y = 18 + i * 9
        x = 120 + i * 14
        d = (f'M1440 {y} C1180 {y + 40} 980 {y - 30} 720 {y + 10} S300 {y + 70} {x + 60} {y + 60} '
             f'S{x - 40} 260 {x - 30} 420 S{x + 40} 700 {x - 70} 900')
        col, op = ('#fff', 0.13) if i % 3 == 0 else ('#000', 0.12)
        w = 2.4 if i % 3 == 0 else 1.6
        paths += f"<path d='{d}' fill='none' stroke='{col}' stroke-opacity='{op}' stroke-width='{w}'/>"
    return f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 900' preserveAspectRatio='none'>{paths}</svg>"

GRADIENT = 'linear-gradient(155deg, rgba(255,255,255,.16) 0%, rgba(255,255,255,0) 32%, rgba(0,0,0,0) 45%, rgba(0,0,0,.22) 100%)'
SIDE_SHADE = 'linear-gradient(to bottom, rgba(0,0,0,0) 35%, rgba(0,0,0,.12) 100%)'

def css():
    L = '[data-band-art="{k}"] .board [data-art-layer]'
    rules = {
        'gradient': f'background: {GRADIENT};',
        'couple': (f'background: {uri(COUPLE.replace("OP", ".16"))} no-repeat 6px 404px / 176px 370px, {SIDE_SHADE};'),
        'dancer': (f'background: {uri(DANCER.replace("OP", ".15"))} no-repeat -4px 392px / 196px 412px, {SIDE_SHADE};'),
        'waves': f'background: {uri(waves())} no-repeat 0 0 / 1440px 900px, {SIDE_SHADE};',
        'dots': ('background: radial-gradient(circle, rgba(0,0,0,.22) 1.5px, transparent 1.9px) 0 0 / 11px 11px; '
                 '-webkit-mask-image: linear-gradient(200deg, transparent 18%, #000 85%); mask-image: linear-gradient(200deg, transparent 18%, #000 85%);'),
        'glow': ('background: radial-gradient(ellipse 560px 200px at 110px 30px, rgba(255,255,255,.22), rgba(255,255,255,0) 70%), '
                 'radial-gradient(ellipse 300px 260px at 1440px 0, rgba(0,0,0,.14), rgba(0,0,0,0) 70%), '
                 'linear-gradient(to bottom, rgba(0,0,0,0) 30%, rgba(0,0,0,.18) 100%);'),
    }
    return '\n'.join(L.format(k=k) + ' { ' + v + ' }' for k, v in rules.items())

if __name__ == '__main__':
    out = css()
    if sys.argv[1] == '--css':
        open(sys.argv[2], 'w').write(out)
    else:
        p = sys.argv[1]; s = open(p).read()
        a, b = s.index('/*ART*/'), s.index('/*/ART*/')
        s = s[:a] + '/*ART*/\n' + out + '\n' + s[b:]
        open(p, 'w').write(s)
    print(len(out), 'bytes of art css')
