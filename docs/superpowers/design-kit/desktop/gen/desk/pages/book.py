"""Render the desktop boards.

    python3 -I book.py boards [area ...] [--theme salsa-light]   -> out/boards/<theme>/<area>--<id>.html (standalone, for screenshots)
    python3 -I book.py book                                       -> out/index.html (every board, every theme, one page)

Areas are modules next to this file with SECTION = (id, name) and BOARDS = [frame.Board(...)].
"""
import importlib
import importlib.util
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import frame as F  # noqa: E402
from frame import kit  # noqa: E402

AREAS = ['today', 'moves', 'pos', 'lessons', 'groups', 'music', 'practice', 'settings', 'system']
OUT = os.path.join(HERE, 'out')
THEMES = ['salsa-light', 'salsa-dark', 'bachata-light', 'bachata-dark']

BOARD_CSS = 'a{color:inherit}button{font:inherit}'


def load(names=None):
    mods = []
    for a in names or AREAS:
        if not os.path.exists(os.path.join(HERE, a + '.py')):
            continue
        # by path, under another name: gen/screens has modules of the same names (today, moves, ...)
        spec = importlib.util.spec_from_file_location(f'area_{a}', os.path.join(HERE, a + '.py'))
        m = importlib.util.module_from_spec(spec)
        sys.modules[f'area_{a}'] = m
        spec.loader.exec_module(m)
        mods.append(m)
    return mods


def standalone(html, title):
    return (f'<!doctype html><html lang="en"><head><meta charset="utf-8"><title>{kit.esc(title)}</title>{kit.FONTS_LINK}'
            f'<style>body{{margin:0}}{BOARD_CSS}</style></head><body>{html}</body></html>')


def boards(names, themes):
    for m in load(names):
        sid = m.SECTION[0]
        for b in m.BOARDS:
            for th in themes:
                if th not in b.themes:
                    continue
                d = os.path.join(OUT, 'boards', th)
                os.makedirs(d, exist_ok=True)
                p = os.path.join(d, f'{sid}--{b.id}.html')
                with open(p, 'w') as f:
                    f.write(standalone(b.fn(F.theme(th)), b.title))
                print(p)


def decisions():
    import decisions as D
    return {'settled': D.SETTLED, 'round': D.ROUND}


def book():
    import base64
    import datetime
    import gzip
    prev = set(json.load(open(os.path.join(HERE, 'prev_boards.json')))['keys']) if os.path.exists(os.path.join(HERE, 'prev_boards.json')) else set()
    sections, data = [], {th: {} for th in THEMES}
    for m in load():
        sid, name = m.SECTION
        items = []
        for b in m.BOARDS:
            key = f'{sid}--{b.id}'
            items.append({'key': key, 'title': b.title, 'note': b.note, 'themes': list(b.themes), 'isNew': bool(prev) and key not in prev,
                          'option': b.option, 'rec': b.rec, 'changed': b.changed and key in prev})
            for th in b.themes:
                data[th][key] = b.fn(F.theme(th))
        sections.append({'id': sid, 'name': name, 'boards': items})
    # each theme's boards as base64(gzip(json)): the page unpacks one theme on first use
    packed = {th: base64.b64encode(gzip.compress(json.dumps(d).encode(), 9)).decode() for th, d in data.items()}
    tpl = open(os.path.join(HERE, 'template.html')).read()
    page = (tpl.replace('/*SECTIONS*/null', json.dumps(sections).replace('</', '<\\/'))
               .replace('/*BOARDS*/null', json.dumps(packed))
               .replace('/*BUILT*/null', json.dumps(datetime.date.today().isoformat()))
               .replace('/*DECISIONS*/null', json.dumps(decisions()).replace('</', '<\\/'))
               .replace('<!--FONTS-->', kit.FONTS_LINK))
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'index.html'), 'w') as f:
        f.write(page)
    n = sum(len(s['boards']) for s in sections)
    nn = sum(1 for s in sections for b in s['boards'] if b['isNew'])
    nc = sum(1 for s in sections for b in s['boards'] if b['changed'])
    print(f'{n} boards ({nn} new, {nc} changed), {len(page) // 1024} KB -> {os.path.join(OUT, "index.html")}')


if __name__ == '__main__':
    args = sys.argv[1:]
    themes = ['salsa-light']
    if '--theme' in args:
        i = args.index('--theme')
        themes = args[i + 1].split(',')
        args = args[:i] + args[i + 2:]
    if args and args[0] == 'book':
        book()
    else:
        boards(args[1:] if args else None, themes)
