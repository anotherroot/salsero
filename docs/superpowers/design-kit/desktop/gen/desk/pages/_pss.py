"""Shared helpers for the Practice, Settings and System areas: load a mobile screen module by path
(its name clashes with an area module), and render areas by file path for checking.

    python3 -I _pss.py practice settings system --theme salsa-light,salsa-dark
"""
import importlib.util
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SCREENS = os.path.join(os.path.dirname(os.path.dirname(HERE)), 'screens')
if HERE not in sys.path:
    sys.path.insert(0, HERE)
import frame as F  # noqa: E402
from frame import kit, ts, icon, CREAM  # noqa: E402


def _load(name, path):
    if name in sys.modules:
        return sys.modules[name]
    spec = importlib.util.spec_from_file_location(name, path)
    m = importlib.util.module_from_spec(spec)
    sys.modules[name] = m
    spec.loader.exec_module(m)
    return m


def mobile(name):
    """gen/screens/<name>.py, loaded as mobile_<name>."""
    return _load('mobile_' + name, os.path.join(SCREENS, name + '.py'))


def area(name):
    """pages/<name>.py, loaded as area_<name> (what book.py should do too)."""
    return _load('area_' + name, os.path.join(HERE, name + '.py'))


def settings_frame(t, title, body, **kw):
    """F.frame with Settings lit. desk.side_item asks for a filled 'sliders' icon, which the kit does not
    have, so draw the frame unlit and swap the Settings item for a lit one with the outline icon."""
    html = F.frame(t, None, title, body, **kw)
    off = F.desk.side_item(t, 'settings', 'Settings', False)
    on = (f'<a href="#" aria-current="page" style="height: 48px; padding: 0 18px 0 14px; border-radius: 24px; background: {CREAM}; color: {t["band"]}; '
          f'display: flex; align-items: center; gap: 12px; text-decoration: none; font-size: 16px; font-weight: 800">'
          f'{icon("settings", 24, t["band"], stroke=2.4)}Settings</a>')
    assert off in html
    return html.replace(off, on, 1)


def bone(t, w, h, r=6, extra=''):
    return f'<span aria-hidden="true" style="display: block; width: {w}; height: {h}px; border-radius: {r}px; background: {t["skeleton"]}; flex: none; {extra}"></span>'


def para(t, text, color=None, size=15):
    return f'<p style="margin: 0 4px; font-size: {size}px; line-height: 1.5; color: {color or t["ink2"]}">{text}</p>'


def caption(t, text, top=0):
    return f'<p style="margin: {top}px 16px 0; font-size: 13px; line-height: 1.4; color: {t["muted"]}">{text}</p>'


def nav_bar(t):
    """The navigation progress bar along the top edge of the window (cream)."""
    return (f'<div aria-hidden="true" style="position: absolute; left: 0; right: 0; top: 0; height: 3px; overflow: hidden; z-index: 5">'
            f'<div style="position: absolute; left: 22%; width: 40%; height: 3px; border-radius: 0 2px 2px 0; background: {CREAM}"></div></div>')


if __name__ == '__main__':
    import book
    args = sys.argv[1:]
    themes = ['salsa-light']
    if '--theme' in args:
        i = args.index('--theme')
        themes = args[i + 1].split(',')
        args = args[:i] + args[i + 2:]
    for a in args:
        m = area(a)
        sid = m.SECTION[0]
        for b in m.BOARDS:
            for th in themes:
                if th not in b.themes:
                    continue
                d = os.path.join(book.OUT, 'boards', th)
                os.makedirs(d, exist_ok=True)
                p = os.path.join(d, f'{sid}--{b.id}.html')
                with open(p, 'w') as f:
                    f.write(book.standalone(b.fn(F.theme(th)), b.title))
                print(p)
