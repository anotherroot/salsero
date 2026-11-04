"""salsaapp design kit: the approved "C4 · Final picks" look as Python building blocks.

Every function returns an HTML string with inline styles only, every element
closed (SVG children included), every attribute quoted. Import it with::

    import sys; sys.path.insert(0, '<scratchpad>/gen/kit'); import kit
    t = kit.THEMES[('salsa', 'light')]

Conventions
-----------
* A theme ``t`` is a plain dict of tokens (see ``THEMES``). Never hard-code a
  colour in a screen: take it from ``t`` so the same function draws light and dark.
* One screen = one function ``screen(t) -> html`` returning ``kit.phone(...)``
  (usually through ``kit.page``). ``kit.artboard`` draws it in both modes.
* Ids: call ``kit.uid('tempo')`` for every ``<input id>``; the counter keeps ids
  unique when the same screen is drawn twice on one artboard.
* State parameters draw a control frozen in that state ('pressed', 'focused',
  'disabled', ...). Focus everywhere = 2px accent ring + soft 4px halo.
* Sizes: 44px minimum hit area; icons 24px on a 24 grid with 2px rounded
  strokes (28px in the tab bar); band title Bricolage 800 46px.
"""

import itertools
import html as _html

# --------------------------------------------------------------------------
# colour maths (also used by the contrast audit)
# --------------------------------------------------------------------------


def _rgb(c):
    c = c.lstrip('#')
    if len(c) == 3:
        c = ''.join(ch * 2 for ch in c)
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


def _hex(rgb):
    return '#' + ''.join(f'{max(0, min(255, round(v))):02x}' for v in rgb)


def mix(a, b, w):
    """Opaque blend: ``w`` parts of colour ``a`` over ``1-w`` parts of ``b`` (both #hex)."""
    ra, rb = _rgb(a), _rgb(b)
    return _hex(tuple(ra[i] * w + rb[i] * (1 - w) for i in range(3)))


def rgba(c, alpha):
    """'#rrggbb' + alpha -> 'rgba(r,g,b,a)'."""
    r, g, b = _rgb(c)
    return f'rgba({r},{g},{b},{alpha})'


def _parse(c, over='#ffffff'):
    """Any '#hex' or 'rgba(...)' -> opaque (r,g,b), composited over ``over``."""
    c = c.strip()
    if c.startswith('rgba'):
        r, g, b, a = [float(x) for x in c[c.index('(') + 1:c.index(')')].split(',')]
        o = _parse(over)
        return tuple(v * a + o[i] * (1 - a) for i, v in enumerate((r, g, b)))
    if c.startswith('#') and len(c) == 9:
        a = int(c[7:9], 16) / 255
        o = _parse(over)
        return tuple(v * a + o[i] * (1 - a) for i, v in enumerate(_rgb(c[:7])))
    return _rgb(c)


def _lum(rgb):
    def ch(v):
        v /= 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = rgb
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)


def contrast(fg, bg, under='#ffffff'):
    """WCAG contrast ratio of ``fg`` on ``bg`` (rgba is composited over ``under``)."""
    b = _parse(bg, under)
    f = _parse(fg, _hex(b))
    l1, l2 = sorted((_lum(f), _lum(b)), reverse=True)
    return (l1 + 0.05) / (l2 + 0.05)


# --------------------------------------------------------------------------
# themes
# --------------------------------------------------------------------------

CREAM = '#FFF3E4'

_LIGHT = dict(
    ground='#f2f2f5', surface='#ffffff', raised='#ffffff', sheet_bg='#f2f2f5', field='#f2f2f5',
    hairline='#e3e3e8', field_line='#cfcfd6', ink='#111114', ink2='#3d3d44', muted='#6e6e76', chevron='#a8a8b0',
    chip='#e6e3e6', chip_ink='#111114', step='#ececf0', tab_bg='#f9f9fb', tab_line='#dcdce2',
    done='#1e7a4f', on_done='#ffffff', done_soft='#e3f3ea',
    danger='#c4183c', on_danger='#ffffff', danger_soft='#fde8ec',
    warn='#a34a06', warn_soft='#fdf0e1',
    pressed='rgba(17,17,20,0.06)', scrim='rgba(17,17,20,0.44)',
    disabled_bg='#e6e6ea', disabled_ink='#8a8a92',
    skeleton='#e6e6ea', skeleton_hi='#efeff2',
    switch_off='#b4b4bc', thumb='#ffffff', grabber='#c9c9d0',
    inverse_bg='#26262b', inverse_ink='#f4f4f6',
)
_DARK = dict(
    ground='#0b0b0d', surface='#1c1c1f', raised='#242428', sheet_bg='#141416', field='#0b0b0d',
    hairline='#2c2c31', field_line='#3a3a40', ink='#f4f4f6', ink2='#c8c8ce', muted='#98989f', chevron='#6e6e76',
    chip='#2c2c31', chip_ink='#f4f4f6', step='#2c2c31', tab_bg='#121214', tab_line='#2c2c31',
    done='#5cc98f', on_done='#0b0b0d', done_soft='#173226',
    danger='#ff5c7a', on_danger='#1a0509', danger_soft='#3a1520',
    warn='#f0a04b', warn_soft='#33240f',
    pressed='rgba(255,255,255,0.07)', scrim='rgba(0,0,0,0.62)',
    disabled_bg='#232327', disabled_ink='#6a6a72',
    skeleton='#2e2e34', skeleton_hi='#28282d',
    switch_off='#4a4a52', thumb='#ffffff', grabber='#4a4a52',
    inverse_bg='#ececf0', inverse_ink='#111114',
)


def _theme(dance, mode, base, **dance_tokens):
    t = dict(base)
    t.update(dance=dance, mode=mode, cream=CREAM, band_ink=CREAM)
    t.update(dance_tokens)
    a = t['accent']
    t['accent_soft'] = mix(a, t['surface'], 0.12 if mode == 'light' else 0.18)
    t['accent_soft_pressed'] = mix(a, t['surface'], 0.22 if mode == 'light' else 0.28)
    t['accent_pressed'] = mix(a, '#000000', 0.84) if mode == 'light' else mix(a, '#000000', 0.82)
    t['danger_pressed'] = mix(t['danger'], '#000000', 0.84)
    t['focus'] = a
    t['focus_halo'] = a + '33'
    t['tab_tint'] = rgba(a, 0.12)   # the active tab's pill, exactly as approved
    t['band_track'] = 'rgba(255,243,228,0.16)'
    return t


THEMES = {
    ('salsa', 'light'): _theme(
        'salsa', 'light', _LIGHT, band='#D2401E', band_small='#ffffff', accent='#d2401e', accent_text='#b3340f',
        on_accent='#ffffff', status='#b8330f', inverse_accent='#ff8a6b',
        shadow='0 8px 24px rgba(90,20,0,0.16), 0 1px 3px rgba(90,20,0,0.08)', band_shadow='rgba(80,14,0,0.22)'),
    ('salsa', 'dark'): _theme(
        'salsa', 'dark', _DARK, band='#D2401E', band_small='#ffffff', accent='#ff6b47',
        accent_text='#ff7a59', on_accent='#0b0b0d', status='#ff8a6b', inverse_accent='#b3340f',
        shadow='0 8px 24px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.06)', band_shadow='rgba(0,0,0,0.3)'),
    ('bachata', 'light'): _theme(
        'bachata', 'light', _LIGHT, band='#6B1D4F', band_small=CREAM, accent='#8e2a66', accent_text='#8e2a66',
        on_accent='#ffffff', status='#8e2a66', inverse_accent='#f07aae',
        shadow='0 8px 24px rgba(40,0,24,0.16)', band_shadow='rgba(30,0,18,0.3)'),
    ('bachata', 'dark'): _theme(
        'bachata', 'dark', _DARK, band='#6B1D4F', band_small=CREAM, accent='#f07aae',
        accent_text='#f07aae', on_accent='#2a0716', status='#f07aae', inverse_accent='#8e2a66',
        shadow='0 8px 24px rgba(0,0,0,0.5)', band_shadow='rgba(0,0,0,0.3)'),
}
"""Theme tokens, keyed (dance, mode). Roles:

band / band_ink (cream: title, icons) / band_small (text under 24px on the band) /
band_track (segmented track on the band) / band_shadow;
ground (page) = sheet colour, surface (cards, groups), raised (dialogs),
sheet_bg (bottom sheets), field (inputs inside a card);
hairline, field_line (input outline), ink, ink2 (body copy), muted (meta),
chevron (decorative only);
accent, accent_text (small accent text), accent_soft (tonal bg), accent_pressed,
accent_soft_pressed, on_accent, status (overdue / "not in a routine");
done, on_done, done_soft; danger, on_danger, danger_soft, danger_pressed;
warn, warn_soft; focus, focus_halo; chip, chip_ink, step (stepper buttons);
tab_bg, tab_line, tab_tint; pressed (overlay), scrim, shadow (floating card);
disabled_bg, disabled_ink; skeleton, skeleton_hi; switch_off, thumb, grabber;
inverse_bg, inverse_ink, inverse_accent (toasts); cream; dance; mode.
"""


def _media(dance):
    t = dict(THEMES[(dance, 'dark')])
    t.update(mode='media', ground='#000000', surface='#1c1c1f', raised='#1c1c1f', sheet_bg='#141416',
             band='#000000', band_small='rgba(255,255,255,0.78)', ink='#ffffff', ink2='rgba(255,255,255,0.82)',
             muted='rgba(255,255,255,0.64)', hairline='rgba(255,255,255,0.16)',
             glass='rgba(28,28,31,0.72)', glass_line='rgba(255,255,255,0.12)',
             top_scrim='linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0))',
             bottom_scrim='linear-gradient(rgba(0,0,0,0), rgba(0,0,0,0.72))',
             track='rgba(255,255,255,0.24)', section='rgba(255,255,255,0.18)')
    return t


MEDIA = {d: _media(d) for d in ('salsa', 'bachata')}
"""Full-screen video player palette, keyed by dance: the dark theme with a black
ground plus ``glass`` (controls floating over video), ``glass_line``,
``top_scrim`` / ``bottom_scrim`` (CSS gradients over the picture), ``track``
(the timeline), ``section`` (a saved section on the timeline). Usable as ``t``."""


def theme(dance, mode):
    """THEMES[(dance, mode)], or MEDIA[dance] when mode == 'media'."""
    return MEDIA[dance] if mode == 'media' else THEMES[(dance, mode)]


# --------------------------------------------------------------------------
# type
# --------------------------------------------------------------------------

FONTS_LINK = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
              '<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800'
              '&amp;family=Manrope:wght@400;500;600;700;800&amp;display=swap" rel="stylesheet">')
BRIC = "font-family: 'Bricolage Grotesque', Manrope, sans-serif"
MANROPE = 'font-family: Manrope, system-ui, sans-serif'

TYPE = {
    # name: (family, size, weight, line-height, letter-spacing, use)
    'display':  ('Bricolage', 46, 800, '1', '-0.02em', 'Band title on every main and pushed screen'),
    'display_s': ('Bricolage', 30, 800, '1.05', '-0.015em', 'Compact band title (long names: a figure, a lesson)'),
    'hero':     ('Bricolage', 25, 800, '1.1', '-0.01em', 'Hero card title (Start session)'),
    'headline': ('Bricolage', 22, 800, '1.15', '-0.005em', 'Sheet and dialog titles, the big Play button'),
    'number_l': ('Bricolage', 40, 800, '1', '-0.01em', 'Big numbers: a stopwatch, a count'),
    'title':    ('Manrope', 16, 700, '1.3', '0', 'Row titles, field values, labels in a row'),
    'body':     ('Manrope', 16, 500, '1.45', '0', 'Paragraphs, notes'),
    'subtitle': ('Manrope', 15, 600, '1.3', '0', 'The date or subtitle under the band title'),
    'button':   ('Manrope', 16, 800, '1', '0', 'Button labels (15 in small buttons and the segmented switch)'),
    'number':   ('Manrope', 18, 800, '1', '0', 'Numbers in fields (tempo), tabular figures'),
    'meta':     ('Manrope', 13, 400, '1.35', '0', 'Second line of a row'),
    'label':    ('Manrope', 13, 700, '1.3', '0', 'Section labels, field labels'),
    'chip':     ('Manrope', 14, 600, '1', '0', 'Chips (800 when selected), tab label'),
    'caption':  ('Manrope', 12, 700, '1.3', '0', 'Captions, badges, helper text under a focused field'),
}
"""The type scale. ``ts(name)`` turns an entry into inline CSS."""


def ts(name, color=None):
    """Inline CSS for a TYPE entry (+ optional colour)."""
    fam, size, weight, lh, ls, _ = TYPE[name]
    f = BRIC if fam == 'Bricolage' else MANROPE
    css = f'{f}; font-size: {size}px; line-height: {lh}; font-weight: {weight}; letter-spacing: {ls}'
    if name in ('number', 'number_l'):
        css += '; font-variant-numeric: tabular-nums'
    if color:
        css += f'; color: {color}'
    return css


SPACE = [4, 8, 12, 16, 20, 24, 32, 48]
"""Spacing steps in px. Screen gutter 16 (band 20), gap between groups 8, section top 14."""

RADII = {'xs': 8, 'sm': 12, 'field': 14, 'group': 16, 'card': 22, 'sheet': 28, 'pill': 999, 'phone': 44}
"""Corner radii: field 14 (text fields), group 16 (list groups, banners), card 22 (hero, video tile),
sheet 28 (the sheet over the band, bottom sheets, dialogs), pill (buttons, chips, search, switches)."""

SR = ('position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); '
      'white-space: nowrap; margin: -1px; padding: 0; border: 0')
"""Visually hidden (screen-reader-only) style."""

BTN = 'border: 0; background: none; padding: 0; display: flex; align-items: center; justify-content: center; cursor: pointer'

_ids = itertools.count(1)


def uid(prefix='f'):
    """A document-unique id (``prefix-N``) for inputs and aria-describedby."""
    return f'{prefix}-{next(_ids)}'


def esc(s):
    """HTML-escape plain text (content passed to blocks is treated as HTML)."""
    return _html.escape(s, quote=True)


# --------------------------------------------------------------------------
# icons
# --------------------------------------------------------------------------

_D = '<path d="{}"></path>'


def _p(*ds):
    return ''.join(_D.format(d) for d in ds)


def _dots(*ds):
    return ''.join(f'<path d="{d}" stroke-width="3"></path>' for d in ds)


ICONS = {
    # tabs (exactly the approved glyphs)
    'calendar': '<rect x="3.5" y="5" width="17" height="15.5" rx="3"></rect>' + _p('M3.5 10h17M8 3v4M16 3v4'),
    'footprints': ('<ellipse cx="7.5" cy="7.5" rx="3" ry="4"></ellipse><ellipse cx="7.8" cy="15.4" rx="2" ry="1.7"></ellipse>'
                   '<ellipse cx="16.5" cy="11" rx="3" ry="4"></ellipse><ellipse cx="16.2" cy="18.9" rx="2" ry="1.7"></ellipse>'),
    'lessons': '<rect x="3" y="5" width="18" height="14" rx="3.5"></rect>' + _p('M10 9.5v5l4.5-2.5z'),
    'music': _p('M9 18V6l11-2v12') + '<circle cx="6.5" cy="18" r="2.5"></circle><circle cx="17.5" cy="16" r="2.5"></circle>',
    'sliders': _p('M4 7h9M17 7h3M4 17h3M11 17h9') + '<circle cx="15" cy="7" r="2"></circle><circle cx="9" cy="17" r="2"></circle>',
    # actions
    'plus': _p('M12 5v14M5 12h14'),
    'minus': _p('M5 12h14'),
    'back': _p('M15 5l-7 7 7 7'),
    'chevron-right': _p('M9 6l6 6-6 6'),
    'chevron-left': _p('M15 6l-6 6 6 6'),
    'chevron-down': _p('M6 9l6 6 6-6'),
    'chevron-up': _p('M6 15l6-6 6 6'),
    'close': _p('M6 6l12 12M18 6L6 18'),
    'check': _p('M5 12.5l4.5 4.5L19 7.5'),
    'search': '<circle cx="11" cy="11" r="6.5"></circle>' + _p('M16 16l4 4'),
    'play': _p('M8 5.5v13l11-6.5z'),
    'pause': '<rect x="6.5" y="5" width="3.5" height="14" rx="1.2"></rect><rect x="14" y="5" width="3.5" height="14" rx="1.2"></rect>',
    'stop': '<rect x="6" y="6" width="12" height="12" rx="2.5"></rect>',
    'skip-back': _p('M18 6.5L10 12l8 5.5z', 'M6 6v12'),
    'skip-forward': _p('M6 6.5L14 12l-8 5.5z', 'M18 6v12'),
    'trash': _p('M4 7h16M10 11v6M14 11v6', 'M6 7l1 12.2A2 2 0 0 0 9 21h6a2 2 0 0 0 2-1.8L18 7',
                'M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7'),
    'edit': _p('M4 20h4L19 9l-4-4L4 16z', 'M13.5 6.5l4 4'),
    'more': _dots('M5 12h.01M12 12h.01M19 12h.01'),
    'more-vertical': _dots('M12 5h.01M12 12h.01M12 19h.01'),
    'link': _p('M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1', 'M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1'),
    'unlink': _p('M15.5 12.5l3-3a4 4 0 0 0-5.66-5.66l-2 2', 'M8.5 11.5l-3 3a4 4 0 0 0 5.66 5.66l2-2',
                 'M8 3v2.5M3 8h2.5M16 21v-2.5M21 16h-2.5'),
    'video': '<rect x="3" y="6" width="12.5" height="12" rx="3"></rect>' + _p('M15.5 10.5l5.5-3.2v9.4l-5.5-3.2'),
    'mic': '<rect x="9" y="3" width="6" height="11" rx="3"></rect>' + _p('M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6'),
    'volume': _p('M4 9.5h3.5L12 6v12l-4.5-3.5H4z', 'M15.5 9.5a3.5 3.5 0 0 1 0 5'),
    'volume-off': _p('M4 9.5h3.5L12 6v12l-4.5-3.5H4z', 'M16 10l4 4M20 10l-4 4'),
    'upload': _p('M12 15V4M7.5 8.5L12 4l4.5 4.5', 'M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3'),
    'download': _p('M12 4v11M7.5 10.5L12 15l4.5-4.5', 'M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3'),
    'share': ('<circle cx="18" cy="5.5" r="2.5"></circle><circle cx="6" cy="12" r="2.5"></circle><circle cx="18" cy="18.5" r="2.5"></circle>'
              + _p('M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1')),
    'star': _p('M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z'),
    'clock': '<circle cx="12" cy="12" r="8.5"></circle>' + _p('M12 7.5V12l3 2'),
    'repeat': _p('M17 2.5l3 3-3 3', 'M4 11V9.5a4 4 0 0 1 4-4h12', 'M7 21.5l-3-3 3-3', 'M20 13v1.5a4 4 0 0 1-4 4H4'),
    'mirror': _p('M12 3v18', 'M9 7L3.5 17H9z', 'M15 7l5.5 10H15z'),
    'scissors': '<circle cx="6" cy="7" r="2.5"></circle><circle cx="6" cy="17" r="2.5"></circle>' + _p('M8.2 8.4L20 17M8.2 15.6L20 7'),
    'bookmark': _p('M7 3.5h10a1 1 0 0 1 1 1V21l-6-4-6 4V4.5a1 1 0 0 1 1-1z'),
    'drag': _dots('M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01'),
    'filter': _p('M4 5h16l-6 7.5V19l-4 2v-8.5z'),
    'sort': _p('M7 4v16M3.5 16.5L7 20l3.5-3.5', 'M17 20V4M13.5 7.5L17 4l3.5 3.5'),
    'warning': _p('M10.3 4.6a2 2 0 0 1 3.4 0l7.5 13a2 2 0 0 1-1.7 3H4.5a2 2 0 0 1-1.7-3z', 'M12 10v4M12 17h.01'),
    'info': '<circle cx="12" cy="12" r="9"></circle>' + _p('M12 11v5M12 8h.01'),
    'check-circle': '<circle cx="12" cy="12" r="9"></circle>' + _p('M8 12.5l2.8 2.8L16.5 9.5'),
    'eye': _p('M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z') + '<circle cx="12" cy="12" r="3"></circle>',
    'eye-off': _p('M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z', 'M4 4l16 16') + '<circle cx="12" cy="12" r="3"></circle>',
    'heart': _p('M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.2 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z'),
    'people': ('<circle cx="8.5" cy="8" r="3"></circle><circle cx="16.5" cy="9" r="2.5"></circle>'
               + _p('M3 19.5a5.5 5.5 0 0 1 11 0', 'M15 14.6a4.5 4.5 0 0 1 6 4.9')),
    'solo': '<circle cx="12" cy="7.5" r="3.5"></circle>' + _p('M5 20.5a7 7 0 0 1 14 0'),
    'metronome': _p('M9.2 3.5h5.6L19 20.5H5z', 'M12 16L16.5 7', 'M7 16h10'),
    'list': _p('M9 6h11M9 12h11M9 18h11', 'M4 6h1M4 12h1M4 18h1'),
    'grid': ('<rect x="3.5" y="3.5" width="7" height="7" rx="2"></rect><rect x="13.5" y="3.5" width="7" height="7" rx="2"></rect>'
             '<rect x="3.5" y="13.5" width="7" height="7" rx="2"></rect><rect x="13.5" y="13.5" width="7" height="7" rx="2"></rect>'),
    'graph': ('<circle cx="5" cy="6" r="2"></circle><circle cx="19" cy="6" r="2"></circle><circle cx="12" cy="18" r="2.5"></circle>'
              + _p('M7 6h10M6.1 7.8l4.6 8.1M17.9 7.8l-4.6 8.1')),
    'route': ('<circle cx="6" cy="19" r="2.2"></circle><circle cx="18" cy="5" r="2.2"></circle>'
              + _p('M8.2 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.8')),
    'undo': _p('M9 14L4 9l5-5', 'M4 9h10.5a5.5 5.5 0 0 1 0 11H11'),
    'redo': _p('M15 14l5-5-5-5', 'M20 9H9.5a5.5 5.5 0 0 0 0 11H13'),
    'external': _p('M14 4h6v6M20 4l-9 9', 'M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4'),
    'youtube': '<rect x="2.5" y="5.5" width="19" height="13" rx="4"></rect><path d="M10 9.3v5.4l4.6-2.7z" fill="currentColor"></path>',
    'refresh': _p('M20 11a8 8 0 0 0-14.6-4.5M4 3.5v3.5h3.5', 'M4 13a8 8 0 0 0 14.6 4.5M20 20.5V17h-3.5'),
    'logout': _p('M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4', 'M15 16.5L19.5 12 15 7.5M19.5 12H9'),
    'phone': '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"></rect>' + _p('M11 18.5h2'),
    'bell': _p('M6 16v-5a6 6 0 0 1 12 0v5l1.5 2.5h-15z', 'M10 21a2 2 0 0 0 4 0'),
    'note': _p('M6.5 3.5h8L19 8v11.5a1 1 0 0 1-1 1H6.5a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1z', 'M14 3.5V8h5', 'M9 12.5h6M9 16h4'),
    'speed': _p('M4.5 17.5a8 8 0 1 1 15 0', 'M12 14l3.5-4.5'),
    'expand': _p('M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'),
    'image': '<rect x="3.5" y="4.5" width="17" height="15" rx="3"></rect><circle cx="9" cy="10" r="1.8"></circle>' + _p('M20.5 16l-5-5-9 8.5'),
    'sun': '<circle cx="12" cy="12" r="4"></circle>' + _p('M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4'),
    'moon': _p('M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z'),
    'key': '<circle cx="8" cy="15" r="4"></circle>' + _p('M11 12l8.5-8.5M16.5 6.5l2.5 2.5M14 9l2 2'),
    'flag': _p('M5 21V4', 'M5 4h12l-2.5 4 2.5 4H5'),
    'circle': '<circle cx="12" cy="12" r="9"></circle>',
}
"""Outline glyphs on a 24 grid (2px rounded strokes). See ALIASES for the role names."""

ALIASES = {
    'today': 'calendar', 'moves': 'footprints', 'figures': 'footprints', 'play-rect': 'lessons', 'note-music': 'music',
    'settings': 'sliders', 'chevron': 'chevron-right', 'pencil': 'edit', 'spot': 'bookmark', 'loop': 'repeat',
    'trim': 'scissors', 'partner': 'people', 'positions': 'graph', 'routine': 'route', 'reminder': 'bell',
    'device': 'phone', 'speaker': 'volume', 'mute': 'volume-off', 'notes': 'note', 'rate': 'speed',
    'fullscreen': 'expand', 'delete': 'trash', 'add': 'plus', 'x': 'close', 'done': 'check-circle',
}

# Filled variants. '{c}' = colour, '{bg}' = the colour behind (for knocked-out details).
FILLED = {
    'calendar': ('<rect x="3.5" y="5" width="17" height="15.5" rx="3" fill="{c}"></rect><path d="M3.5 10h17" stroke="{bg}" stroke-width="2"></path>'
                 '<path d="M8 3v4M16 3v4" stroke="{c}" stroke-width="2" stroke-linecap="round"></path>'),
    'footprints': ('<g fill="{c}"><ellipse cx="7.5" cy="7.5" rx="3.3" ry="4.3"></ellipse><ellipse cx="7.8" cy="15.6" rx="2.2" ry="1.9"></ellipse>'
                   '<ellipse cx="16.5" cy="11" rx="3.3" ry="4.3"></ellipse><ellipse cx="16.2" cy="19.1" rx="2.2" ry="1.9"></ellipse></g>'),
    'lessons': '<rect x="2.5" y="4.5" width="19" height="15" rx="4" fill="{c}"></rect><path d="M10 9v6l5-3z" fill="{bg}"></path>',
    'music': ('<path d="M9 18V7" stroke="{c}" stroke-width="2.4"></path><path d="M20 16V5" stroke="{c}" stroke-width="2.4"></path>'
              '<path d="M7.8 5.2l13.4-2.4v4.2L7.8 9.4z" fill="{c}"></path><circle cx="6.5" cy="18" r="3" fill="{c}"></circle>'
              '<circle cx="17.5" cy="16" r="3" fill="{c}"></circle>'),
    'play': '<path d="M8 5.5v13l11-6.5z" fill="{c}"></path>',
    'pause': '<rect x="6" y="5" width="4.5" height="14" rx="1.5" fill="{c}"></rect><rect x="13.5" y="5" width="4.5" height="14" rx="1.5" fill="{c}"></rect>',
    'stop': '<rect x="5.5" y="5.5" width="13" height="13" rx="3" fill="{c}"></rect>',
    'star': '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" fill="{c}" stroke="{c}" stroke-width="2" stroke-linejoin="round"></path>',
    'heart': '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.2 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" fill="{c}" stroke="{c}" stroke-width="2" stroke-linejoin="round"></path>',
    'bookmark': '<path d="M7 3.5h10a1 1 0 0 1 1 1V21l-6-4-6 4V4.5a1 1 0 0 1 1-1z" fill="{c}" stroke="{c}" stroke-width="2" stroke-linejoin="round"></path>',
    'bell': ('<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2.5h-15z" fill="{c}" stroke="{c}" stroke-width="2" stroke-linejoin="round"></path>'
             '<path d="M10 21a2 2 0 0 0 4 0" fill="none" stroke="{c}" stroke-width="2" stroke-linecap="round"></path>'),
    'check-circle': ('<circle cx="12" cy="12" r="10" fill="{c}"></circle><path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="{bg}" '
                     'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>'),
    'info': ('<circle cx="12" cy="12" r="10" fill="{c}"></circle><path d="M12 11v5.5M12 7.5h.01" fill="none" stroke="{bg}" '
             'stroke-width="2.2" stroke-linecap="round"></path>'),
    'warning': ('<path d="M10.3 4.6a2 2 0 0 1 3.4 0l7.5 13a2 2 0 0 1-1.7 3H4.5a2 2 0 0 1-1.7-3z" fill="{c}" stroke="{c}" stroke-width="1.5" stroke-linejoin="round"></path>'
                '<path d="M12 9.5v4.5M12 17h.01" fill="none" stroke="{bg}" stroke-width="2.2" stroke-linecap="round"></path>'),
    'circle': '<circle cx="12" cy="12" r="10" fill="{c}"></circle>',
}


def icon(name, size=24, color='currentColor', filled=False, bg='#ffffff', style='', stroke=2):
    """An icon as inline SVG, aria-hidden. ``name`` from ICONS (or ALIASES).

    filled=True uses FILLED[name] (tabs, transport, star, heart, bookmark, bell,
    check-circle, info, warning, circle); ``bg`` is the colour behind it, used for
    knocked-out details. ``style`` is extra inline CSS on the <svg>."""
    name = ALIASES.get(name, name)
    st = f' style="flex: none; {style}"' if style else ' style="flex: none"'
    if filled:
        inner = FILLED[name].replace('{c}', color).replace('{bg}', bg)
        return f'<svg aria-hidden="true" width="{size}" height="{size}" viewBox="0 0 24 24"{st}>{inner}</svg>'
    col = '' if color == 'currentColor' else f' color="{color}"'
    st = st[:-1] + (f'; color: {color}"' if color != 'currentColor' else '"')
    return (f'<svg aria-hidden="true" width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            f'stroke-width="{stroke}" stroke-linecap="round" stroke-linejoin="round"{st}>{ICONS[name]}</svg>')


def icon_names():
    """All outline icon names, in drawing order."""
    return list(ICONS)


# --------------------------------------------------------------------------
# focus, small helpers
# --------------------------------------------------------------------------


def ring(t, on=None, color=None):
    """Focus box-shadow. Without ``on``: 2px ring + 4px halo hugging the element
    (fields, outlines, bare controls; the approved tempo field). With ``on`` (the
    colour behind a FILLED control): a 2px gap in that colour first, so the ring
    reads around an accent-filled button."""
    c = color or t['focus']
    halo = c + '33' if c.startswith('#') and len(c) == 7 else t['focus_halo']
    if on:
        return f'0 0 0 2px {on}, 0 0 0 4px {c}, 0 0 0 8px {halo}'
    return f'0 0 0 2px {c}, 0 0 0 6px {halo}'


def spinner(t, size=20, color=None, track=None):
    """A static loading spinner (an arc on a faint track), aria-hidden."""
    c = color or t['accent']
    tr = track or rgba(_hex(_parse(c)), 0.25)
    return (f'<svg aria-hidden="true" width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" style="flex: none">'
            f'<circle cx="12" cy="12" r="9" stroke="{tr}" stroke-width="2.5"></circle>'
            f'<path d="M12 3a9 9 0 0 1 9 9" stroke="{c}" stroke-width="2.5" stroke-linecap="round"></path></svg>')


def chevron(t, direction='right'):
    """The 20px trailing chevron of a navigating row."""
    return icon('chevron-' + direction, 20, t['chevron'])


def done_check(t, size=24):
    """The filled done check (green circle) of a finished row."""
    return icon('check-circle', size, t['done'], filled=True, bg=t['on_done'])


def log_button(t, name, state='default'):
    """The approved bare accent "+" (44px hit area) that logs a set. ``name`` is spoken: "Log <name>"."""
    return icon_button(t, 'plus', f'Log {name}', 'bare', state, color=t['accent'])


def row_value(t, text):
    """A trailing value in a row (grey, 16px), e.g. "Built-in"."""
    return f'<span style="font-size: 16px; color: {t["muted"]}; white-space: nowrap">{text}</span>'


# --------------------------------------------------------------------------
# frame, band, sheet, page
# --------------------------------------------------------------------------


def phone(t, inner, label=None, bg=None):
    """A 390x844 phone (radius 44, 10px dark bezel), no status bar. ``inner`` is
    stacked in a flex column; overlays (tab bar, sheets, toasts) are absolute."""
    note = f'<!-- {label} -->' if label else ''
    return (f'{note}<div style="width: 390px; height: 844px; flex: none; border-radius: 44px; overflow: hidden; '
            f'background: {bg or t["ground"]}; color: {t["ink"]}; {MANROPE}; position: relative; '
            f'box-shadow: 0 0 0 10px #111114, 0 24px 60px rgba(0,0,0,0.2); display: flex; flex-direction: column">{inner}</div>')


def band_button(t, name, label, state='default', filled=False):
    """A bare cream icon on the band (Settings, New, Back), 44px hit area, 24px glyph."""
    sh = ''
    if state == 'pressed':
        sh = 'background: rgba(255,243,228,0.16); border-radius: 22px;'
    elif state == 'focused':
        sh = f'border-radius: 22px; box-shadow: 0 0 0 2px {CREAM}, 0 0 0 6px rgba(255,243,228,0.3);'
    dis = ' disabled' if state == 'disabled' else ''
    col = 'rgba(255,243,228,0.45)' if state == 'disabled' else CREAM
    return (f'<button type="button" aria-label="{label}"{dis} style="width: 44px; height: 44px; flex: none; {BTN}; {sh}">'
            f'{icon(name, 24, col, filled=filled, bg=t["band"])}</button>')


def band_title(t, text, tall=True, tag='h2'):
    """The band title: Bricolage 800, 46px (tall) or 30px (compact), cream."""
    return (f'<{tag} style="margin: 0; {ts("display" if tall else "display_s")}; color: {CREAM}; '
            f'overflow-wrap: anywhere">{text}</{tag}>')


def band_header(t, title, subtitle=None, left=None, right=None, extra=None, tall=True, hero=False, bottom=None):
    """The solid dance-colour band at the top of a screen.

    title: text; subtitle: the line under it (date, "Count only"), white/cream 15px;
    left: html at the left of the title (``band_button(t, 'back', 'Back to Today')``);
    right: html or list of html at the right of the title row (band_button);
    extra: html under the title (``segmented(...)``, a search field), 22px below;
    tall: 46px title (default) or a compact 30px title for long names;
    hero: leave room (92px) for a hero card straddling the sheet edge;
    bottom: override the bottom padding (default 92 hero / 50 extra / 52)."""
    if isinstance(right, (list, tuple)):
        right = ''.join(right)
    b = bottom if bottom is not None else (92 if hero else 50 if extra else 52)
    top = 30 if tall else 22
    lead = (f'<div style="flex: 1; min-width: 0; display: flex; align-items: center; gap: 4px; margin-left: -10px">'
            f'{left}{band_title(t, title, tall)}</div>') if left else f'<div style="flex: 1; min-width: 0">{band_title(t, title, tall)}</div>'
    r = f'<div style="display: flex; align-items: center; margin-right: -10px">{right}</div>' if right else ''
    sub = ''
    if subtitle:
        ind = 'padding-left: 38px; ' if left else ''
        sub = f'<span style="{ind}{ts("subtitle", t["band_small"])}">{subtitle}</span>'
    ex = f'<div style="margin-top: 16px">{extra}</div>' if extra else ''
    return (f'<header style="background: {t["band"]}; padding: {top}px 20px {b}px; display: flex; flex-direction: column; gap: 6px; flex: none">'
            f'<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px">{lead}{r}</div>'
            f'{sub}{ex}</header>')


def sheet(t, inner, pad='20px 16px 0', gap=8):
    """The content sheet: overlaps the band by 28px with 28px rounded top corners."""
    return (f'<div style="position: relative; margin-top: -28px; flex: 1; border-radius: 28px 28px 0 0; background: {t["ground"]}; '
            f'padding: {pad}; display: flex; flex-direction: column; gap: {gap}px">{inner}</div>')


def page(t, header, body, tab=None, hero=None, pad=None, overlay='', footer='', label=None):
    """A whole screen: header (band_header) + sheet(body) [+ tab_bar(tab)] + footer + overlay.

    hero: html of a hero_card, put first on the sheet (pass hero=True to band_header too);
    footer: a pinned bottom action (bottom_action); overlay: bottom_sheet/dialog/toast."""
    if hero:
        body = hero + body
        pad = pad or '0 16px'
    inner = header + sheet(t, body, pad or '20px 16px 0') + footer + (tab_bar(t, tab) if tab else '') + overlay
    return phone(t, inner, label)


def bottom_action(t, inner, above_tab=False):
    """Pins ``inner`` (usually a lg primary button) 16px from the sides, above the bottom (or the tab bar)."""
    return f'<div style="position: absolute; left: 16px; right: 16px; bottom: {100 if above_tab else 34}px">{inner}</div>'


def section_label(t, text, top=0, trailing=None):
    """A section label above a group ("Due · 3"): 13px bold muted; ``top`` adds space above.
    trailing: html at the right (e.g. a tertiary button)."""
    if trailing:
        return (f'<div style="padding: {top}px 4px 0 16px; display: flex; align-items: center; justify-content: space-between; min-height: 20px">'
                f'<span style="{ts("label", t["muted"])}">{text}</span>{trailing}</div>')
    return f'<span style="padding: {top}px 16px 0; {ts("label", t["muted"])}">{text}</span>'


def card(t, inner, pad='16px', radius=16, gap=None):
    """A plain surface card (rounded 16)."""
    g = f'display: flex; flex-direction: column; gap: {gap}px; ' if gap is not None else ''
    return f'<div style="background: {t["surface"]}; border-radius: {radius}px; padding: {pad}; {g}">{inner}</div>'


# --------------------------------------------------------------------------
# hero, lists, rows
# --------------------------------------------------------------------------


def hero_card(t, title='Start session', meta='3 due · about 20 min', icon_name='play', state='default', straddle=True, label=None):
    """Today's hero: a card straddling the sheet edge (white / dark surface) with a solid
    accent round play button. state: default | pressed | focused | disabled (nothing due)."""
    m = 'margin: -42px 0 10px' if straddle else 'margin: 0'
    bg = t['surface']
    sh = t['shadow']
    dot_bg, dot_ink = t['accent'], t['on_accent']
    tcol, mcol = t['ink'], t['muted']
    dis = ''
    if state == 'pressed':
        bg = mix(_hex(_parse(t['pressed'], t['surface'])), t['surface'], 1)
        dot_bg = t['accent_pressed']
    elif state == 'focused':
        sh = f'{t["shadow"]}, {ring(t, on=t["ground"])}'
    elif state == 'disabled':
        dot_bg, dot_ink, tcol = t['disabled_bg'], t['disabled_ink'], t['muted']
        dis = ' disabled'
    lab = f' aria-label="{label}"' if label else ''
    glyph = icon(icon_name, 24, dot_ink, filled=icon_name in FILLED, bg=dot_bg, style='margin-left: 3px' if icon_name == 'play' else '')
    return (f'<button type="button"{lab}{dis} style="{m}; width: 100%; box-sizing: border-box; min-height: 84px; border: 0; border-radius: 22px; background: {bg}; '
            f'padding: 14px 14px 14px 20px; display: flex; align-items: center; gap: 14px; text-align: left; cursor: pointer; color: {tcol}; box-shadow: {sh}; flex: none">'
            f'<span style="flex: 1; display: flex; flex-direction: column; gap: 3px">'
            f'<span style="{ts("hero")}">{title}</span>'
            f'<span style="font-size: 14px; font-weight: 600; color: {mcol}">{meta}</span></span>'
            f'<span style="width: 54px; height: 54px; flex: none; border-radius: 27px; background: {dot_bg}; display: flex; align-items: center; justify-content: center">'
            f'{glyph}</span></button>')


def row(t, title, meta=None, trailing=None, leading=None, state='default', href=None, last=False,
        meta_tone=None, title_tone=None, min_h=64):
    """A list row (inside list_group). Hairline under it from the text edge to the right edge.

    title/meta: html; trailing: html (chevron(t), log_button(t, ...), done_check(t), row_value(...), switch(...));
    leading: html (icon, thumbnail, checkbox) left of the text;
    state: default | pressed | selected | disabled;
    href: make the whole row a link (then trailing must not be a button);
    meta_tone: None | 'status' (bold status colour, e.g. "4 days overdue") | 'done' | 'danger';
    title_tone: None | 'muted' (finished rows); last: no hairline."""
    hair = '' if last else f'border-bottom: 1px solid {t["hairline"]};'
    tr = trailing or ''
    pr = 6 if tr.lstrip().startswith(('<button', '<label', '<div role="switch"')) else 14
    bg = {'pressed': t['pressed'], 'selected': t['accent_soft']}.get(state, 'transparent')
    tc = {'muted': t['muted']}.get(title_tone, t['ink'])
    mc, mw = t['muted'], 400
    if meta_tone == 'status':
        mc, mw = t['status'], 700
    elif meta_tone in ('done', 'danger'):
        mc, mw = t[meta_tone], 700
    if state == 'disabled':
        tc = mc = t['disabled_ink']
    if state == 'selected' and not leading:
        leading = icon('check-circle', 24, t['accent'], filled=True, bg=t['on_accent'])
    lead = f'<span style="display: flex; align-items: center; flex: none">{leading}</span>' if leading else ''
    m = f'<span style="font-size: 13px; line-height: 1.35; font-weight: {mw}; color: {mc}">{meta}</span>' if meta else ''
    inner = (f'<div style="display: flex; align-items: center; gap: {12 if leading else 10}px; min-height: {min_h}px; box-sizing: border-box; '
             f'padding: 9px {pr}px 9px 0; {hair}">{lead}'
             f'<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 16px; line-height: 1.3; font-weight: 700; color: {tc}">{title}</span>{m}</div>'
             f'{tr}</div>')
    outer = f'display: block; padding-left: 16px; text-decoration: none; color: {t["ink"]}; background: {bg}'
    if href and state != 'disabled':
        cur = ' aria-current="true"' if state == 'selected' else ''
        return f'<a href="{href}"{cur} style="{outer}">{inner}</a>'
    ad = ' aria-disabled="true"' if state == 'disabled' else ''
    return f'<div{ad} style="{outer}">{inner}</div>'


def list_group(t, rows, label=None):
    """A grouped card of rows (radius 16, surface, overflow hidden).

    rows: list of html strings (already built with last=...) or dicts of row() kwargs —
    dict rows get ``last`` set automatically. label: optional accessible name (role=list)."""
    out = []
    for i, r in enumerate(rows):
        if isinstance(r, dict):
            r = row(t, **{**r, 'last': i == len(rows) - 1})
        out.append(r)
    al = f' role="group" aria-label="{label}"' if label else ''
    return f'<div{al} style="background: {t["surface"]}; border-radius: 16px; overflow: hidden; flex: none">{"".join(out)}</div>'


def picker_row(t, label, value, last=False, state='default', uid_=None):
    """A settings-style row button: bold label left, grey value + chevron right (approved "Voice count").
    state: default | pressed | focused | disabled. Opens a picker sheet."""
    hair = '' if last else f'border-bottom: 1px solid {t["hairline"]};'
    bg, sh, dis = 'none', '', ''
    lc, vc = t['ink'], t['muted']
    if state == 'pressed':
        bg = t['pressed']
    elif state == 'focused':
        sh = f'box-shadow: inset 0 0 0 2px {t["focus"]}; border-radius: 16px;'
    elif state == 'disabled':
        lc = vc = t['disabled_ink']
        dis = ' disabled'
    i = f' id="{uid_}"' if uid_ else ''
    return (f'<button type="button"{i}{dis} style="width: 100%; display: flex; align-items: center; gap: 8px; padding: 0 14px 0 16px; min-height: 58px; border: 0; '
            f'{hair} background: {bg}; color: {lc}; text-align: left; cursor: pointer; {sh}">'
            f'<span style="flex: 1; font-size: 16px; font-weight: 700">{label}</span>'
            f'<span style="font-size: 16px; color: {vc}">{value}</span>{chevron(t)}</button>')


# --------------------------------------------------------------------------
# buttons
# --------------------------------------------------------------------------

_SIZES = {'sm': (44, 15, '0 18px'), 'md': (52, 16, '0 24px'), 'lg': (64, 22, '0 28px')}


def button(t, label, kind='primary', state='default', icon_name=None, size='md', full=False, on=None, aria=None):
    """A pill button.

    kind: primary (solid accent) | secondary (tonal accent) | tertiary (text) | danger (solid danger)
          | danger_text (text in danger colour);
    state: default | pressed | focused | disabled | loading;
    icon_name: leading icon; size: sm 44 | md 52 | lg 64 (lg = the big Play: Bricolage 22);
    full: 100% wide; on: colour behind the button (for the focus gap; default ground)."""
    h, fs, pad = _SIZES[size]
    on = on or t['ground']
    if kind == 'primary':
        bg, fg, pbg = t['accent'], t['on_accent'], t['accent_pressed']
    elif kind == 'secondary':
        bg, fg, pbg = t['accent_soft'], t['accent_text'], t['accent_soft_pressed']
    elif kind == 'danger':
        bg, fg, pbg = t['danger'], t['on_danger'], t['danger_pressed']
    elif kind == 'danger_text':
        bg, fg, pbg = 'transparent', t['danger'], t['danger_soft']
    else:
        bg, fg, pbg = 'transparent', t['accent_text'], t['accent_soft']
    text_kind = kind in ('tertiary', 'danger_text')
    if text_kind:
        pad = '0 14px'
    sh, attrs = '', ''
    if state == 'pressed':
        bg = pbg
    elif state == 'focused':
        sh = f'box-shadow: {ring(t) if text_kind else ring(t, on=on)};'
    elif state == 'disabled':
        bg = 'transparent' if text_kind else t['disabled_bg']
        fg = t['disabled_ink']
        attrs = ' disabled'
    elif state == 'loading':
        attrs = ' aria-busy="true"'
    font = BRIC + '; ' if size == 'lg' else ''
    glyph = ''
    if state == 'loading':
        glyph = spinner(t, 20 if size != 'lg' else 22, fg, rgba(_hex(_parse(fg, bg if bg != 'transparent' else on)), 0.3))
    elif icon_name:
        isz = 22 if size == 'lg' else 20
        glyph = icon(icon_name, isz, fg, filled=icon_name in ('play', 'pause', 'stop'), bg=bg)
    w = 'width: 100%; ' if full else ''
    al = f' aria-label="{aria}"' if aria else ''
    return (f'<button type="button"{al}{attrs} style="{w}height: {h}px; box-sizing: border-box; border-radius: {h // 2}px; border: 0; background: {bg}; color: {fg}; '
            f'{font}font-size: {fs}px; font-weight: 800; padding: {pad}; display: inline-flex; align-items: center; justify-content: center; gap: {10 if size == "lg" else 8}px; '
            f'cursor: pointer; white-space: nowrap; flex: none; {sh}">{glyph}{label}</button>')


def icon_button(t, name, label, variant='bare', state='default', size=44, icon_size=24, color=None, filled=False, on=None):
    """An icon-only button with aria-label, ``size`` px hit area (44 min).

    variant: bare (glyph only) | tonal (accent_soft circle) | filled (accent circle) |
             step (grey circle: stepper −/+) | band (cream on the band, = band_button) | inverse;
    state: default | pressed | focused | disabled; color overrides the glyph colour."""
    if variant == 'band':
        return band_button(t, name, label, state)
    on = on or t['ground']
    bg, fg, pbg = {
        'bare': ('transparent', color or t['ink'], t['pressed']),
        'tonal': (t['accent_soft'], t['accent_text'], t['accent_soft_pressed']),
        'filled': (t['accent'], t['on_accent'], t['accent_pressed']),
        'step': (t['step'], t['ink'], mix(_hex(_parse(t['step'])), t['ink'], 0.86)),
        'inverse': (t['inverse_bg'], t['inverse_ink'], t['inverse_bg']),
    }[variant]
    if color and variant != 'bare':
        fg = color
    sh, dis = '', ''
    if state == 'pressed':
        bg = pbg
    elif state == 'focused':
        sh = f'box-shadow: {ring(t) if variant == "bare" else ring(t, on=on)};'
    elif state == 'disabled':
        fg = t['disabled_ink']
        bg = 'transparent' if variant == 'bare' else t['disabled_bg']
        dis = ' disabled'
    return (f'<button type="button" aria-label="{label}"{dis} style="width: {size}px; height: {size}px; flex: none; border-radius: {size // 2}px; border: 0; '
            f'background: {bg}; padding: 0; display: flex; align-items: center; justify-content: center; cursor: pointer; {sh}">'
            f'{icon(name, icon_size, fg, filled=filled, bg=bg if bg != "transparent" else on)}</button>')


# --------------------------------------------------------------------------
# fields
# --------------------------------------------------------------------------


def _field_box(t, state, radius=14, bg=None):
    bg = bg or t['surface']
    if state == 'focused':
        return f'background: {bg}; box-shadow: {ring(t)};'
    if state == 'error':
        return f'background: {bg}; box-shadow: inset 0 0 0 2px {t["danger"]};'
    if state == 'disabled':
        return f'background: {t["disabled_bg"]};'
    return f'background: {bg}; box-shadow: inset 0 0 0 1px {t["field_line"]};'


def _under(t, fid, state, helper, error):
    if state == 'error' and error:
        return (f'<span id="{fid}-msg" style="display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: {t["danger"]}">'
                f'{icon("warning", 16, t["danger"])}{error}</span>')
    if helper:
        c = t['disabled_ink'] if state == 'disabled' else t['muted']
        return f'<span id="{fid}-msg" style="font-size: 13px; color: {c}">{helper}</span>'
    return ''


def _label(t, fid, label, state, optional=False):
    c = t['disabled_ink'] if state == 'disabled' else t['ink2']
    opt = f' <span style="font-weight: 500; color: {t["muted"]}">(optional)</span>' if optional else ''
    return f'<label for="{fid}" style="{ts("label", c)}; padding-left: 4px">{label}{opt}</label>'


def text_field(t, label, value='', placeholder='', state='empty', helper=None, error=None, lead_icon=None,
               suffix=None, input_type='text', inputmode=None, optional=False, bg=None):
    """A labelled text field (label above, 52px box radius 14, helper/error under).

    state: empty | focused | filled | error | disabled (focused/error show ``value`` if given);
    lead_icon: icon name inside the box; suffix: html/text at the right (unit, clear button);
    bg: box colour (default surface; pass t['field'] inside a card)."""
    fid = uid('tf')
    ink = t['disabled_ink'] if state == 'disabled' else t['ink']
    val = '' if state == 'empty' else value
    under = _under(t, fid, state, helper, error)
    attrs = (' disabled' if state == 'disabled' else '') + (' aria-invalid="true"' if state == 'error' else '')
    attrs += f' aria-describedby="{fid}-msg"' if under else ''
    attrs += f' inputmode="{inputmode}"' if inputmode else ''
    li = icon(lead_icon, 20, t['muted']) if lead_icon else ''
    sf = f'<span style="flex: none; font-size: 15px; font-weight: 600; color: {t["muted"]}">{suffix}</span>' if suffix else ''
    return (f'<div style="display: flex; flex-direction: column; gap: 6px; flex: none">{_label(t, fid, label, state, optional)}'
            f'<div style="height: 52px; box-sizing: border-box; border-radius: 14px; {_field_box(t, state, bg=bg)} display: flex; align-items: center; gap: 10px; padding: 0 14px">'
            f'{li}<input id="{fid}" type="{input_type}" value="{val}" placeholder="{placeholder}"{attrs} style="flex: 1; min-width: 0; height: 44px; border: 0; background: none; '
            f'font: inherit; font-size: 16px; font-weight: 600; color: {ink}; outline: none; padding: 0">{sf}</div>{under}</div>')


def textarea(t, label, value='', placeholder='', state='empty', helper=None, error=None, rows=4, optional=False, bg=None):
    """A labelled multi-line field (same states as text_field), min-height from ``rows``."""
    fid = uid('ta')
    ink = t['disabled_ink'] if state == 'disabled' else t['ink']
    val = '' if state == 'empty' else value
    under = _under(t, fid, state, helper, error)
    attrs = (' disabled' if state == 'disabled' else '') + (' aria-invalid="true"' if state == 'error' else '')
    attrs += f' aria-describedby="{fid}-msg"' if under else ''
    h = 24 + rows * 23
    return (f'<div style="display: flex; flex-direction: column; gap: 6px; flex: none">{_label(t, fid, label, state, optional)}'
            f'<textarea id="{fid}" rows="{rows}" placeholder="{placeholder}"{attrs} style="height: {h}px; box-sizing: border-box; border-radius: 14px; border: 0; '
            f'{_field_box(t, state, bg=bg)} padding: 12px 14px; font: inherit; font-size: 16px; line-height: 1.45; font-weight: 500; color: {ink}; outline: none; resize: none; '
            f'{MANROPE}">{val}</textarea>{under}</div>')


def select_field(t, label, value='', placeholder='Choose…', state='filled', helper=None, error=None, bg=None):
    """A labelled field that opens a picker sheet: a button showing the value and a chevron-down.
    state: empty (placeholder) | focused | filled | error | disabled."""
    fid = uid('sf')
    under = _under(t, fid, state, helper, error)
    shown = value if state != 'empty' and value else placeholder
    c = t['disabled_ink'] if state == 'disabled' else (t['muted'] if state == 'empty' or not value else t['ink'])
    attrs = (' disabled' if state == 'disabled' else '') + (f' aria-describedby="{fid}-msg"' if under else '')
    attrs += ' aria-invalid="true"' if state == 'error' else ''
    return (f'<div style="display: flex; flex-direction: column; gap: 6px; flex: none">{_label(t, fid, label, state)}'
            f'<button type="button" id="{fid}" aria-haspopup="dialog"{attrs} style="height: 52px; box-sizing: border-box; border-radius: 14px; border: 0; {_field_box(t, state, bg=bg)} '
            f'display: flex; align-items: center; gap: 10px; padding: 0 12px 0 14px; cursor: pointer; text-align: left; color: {c}; font-size: 16px; font-weight: 600">'
            f'<span style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">{shown}</span>'
            f'{icon("chevron-down", 20, t["disabled_ink"] if state == "disabled" else t["muted"])}</button>{under}</div>')


def search_field(t, placeholder='Search', value='', state='empty', label=None, on_band=False):
    """The pill search field (44px, magnifier, approved). state: empty | focused | filled | disabled.
    filled/focused-with-value show a clear button. on_band: translucent cream on the band."""
    fid = uid('search')
    lab = label or placeholder
    if on_band:
        box = f'background: {t["band_track"]};' + (f' box-shadow: 0 0 0 2px {CREAM};' if state == 'focused' else '')
        ink, ic = CREAM, 'rgba(255,243,228,0.8)'
    else:
        ink, ic = t['ink'], t['muted']
        if state == 'focused':
            box = f'background: {t["surface"]}; box-shadow: {ring(t)};'
        elif state == 'disabled':
            box, ink, ic = f'background: {t["disabled_bg"]};', t['disabled_ink'], t['disabled_ink']
        else:
            box = f'background: {t["surface"]}; box-shadow: inset 0 0 0 1px {t["hairline"]};'
    val = value if state in ('filled', 'focused') else ''
    clear = icon_button(t, 'close', 'Clear search', 'bare', size=36, icon_size=18, color=ic) if val else ''
    dis = ' disabled' if state == 'disabled' else ''
    return (f'<div role="search" style="height: 44px; box-sizing: border-box; border-radius: 22px; {box} display: flex; align-items: center; gap: 10px; '
            f'padding: 0 {4 if val else 16}px 0 16px; flex: none; position: relative">{icon("search", 20, ic)}'
            f'<label for="{fid}" style="{SR}">{lab}</label>'
            f'<input id="{fid}" type="search" value="{val}" placeholder="{placeholder}"{dis} style="flex: 1; min-width: 0; height: 40px; border: 0; background: none; '
            f'font: inherit; font-size: 16px; color: {ink}; outline: none; padding: 0">{clear}</div>')


def number_field(t, value, state='default', label='Tempo', width=76, bg=None):
    """The approved pill number input (76x44, 18px 800, centred). state: default | focused | disabled.
    Its <label> is visually hidden; in a stepper row the row's label points at it instead."""
    fid = uid('num')
    bg = bg or t['field']
    sh = f'box-shadow: {ring(t)};' if state == 'focused' else ''
    ink = t['disabled_ink'] if state == 'disabled' else t['ink']
    if state == 'disabled':
        bg = t['disabled_bg']
    dis = ' disabled' if state == 'disabled' else ''
    return (f'<label for="{fid}" style="{SR}">{label}</label>'
            f'<input id="{fid}" value="{value}" inputmode="numeric"{dis} style="width: {width}px; height: 44px; box-sizing: border-box; border-radius: 22px; border: 0; '
            f'background: {bg}; {sh} color: {ink}; font: inherit; {ts("number")}; color: {ink}; text-align: center; outline: none; padding: 0; flex: none">')


def stepper(t, value, label=None, unit=None, state='default', minus='Slower', plus='Faster', bg=None):
    """The approved tempo control: [label] (number pill) [unit] (−) (+).
    state: default | focused (the field) | pressed (+) | disabled | min (− disabled at the limit).
    Returns a flex row; put it inside a card/group row (``stepper_row``) or alone."""
    st = 'focused' if state == 'focused' else ('disabled' if state == 'disabled' else 'default')
    nf = number_field(t, value, st, label or 'Value', bg=bg)
    u = f'<span style="font-size: 13px; font-weight: 600; color: {t["muted"]}; padding: 0 4px 0 2px">{unit}</span>' if unit else ''
    ms = 'disabled' if state in ('disabled', 'min') else 'default'
    ps = 'disabled' if state == 'disabled' else ('pressed' if state == 'pressed' else 'default')
    lab = (f'<span style="flex: 1; font-size: 16px; font-weight: 700; color: {t["disabled_ink"] if state == "disabled" else t["ink"]}" aria-hidden="true">{label}</span>'
           if label else '')
    return (f'<div style="display: flex; align-items: center; gap: 8px">{lab}{nf}{u}'
            f'{icon_button(t, "minus", minus, "step", ms, icon_size=20, on=t["surface"])}'
            f'{icon_button(t, "plus", plus, "step", ps, icon_size=20, on=t["surface"])}</div>')


def stepper_row(t, value, label, unit=None, state='default', last=False, minus='Slower', plus='Faster'):
    """A stepper as a group row (padding 12/12/12/16, hairline), as in the approved Practice screen."""
    hair = '' if last else f'border-bottom: 1px solid {t["hairline"]};'
    return (f'<div style="padding: 12px 12px 12px 16px; {hair}">{stepper(t, value, label, unit, state, minus, plus)}</div>')


def slider(t, pct, label='Volume', icon_name='volume', value_text=None, state='default', framed=True):
    """The approved slider: icon, 6px track, 26px white thumb, value at the right.
    pct 0-100; state: default | focused (ring on the thumb) | pressed (bigger halo) | disabled;
    framed: inside its own surface card (radius 16, 18/16 padding)."""
    fill = t['disabled_ink'] if state == 'disabled' else t['accent']
    th_sh = '0 1px 4px rgba(0,0,0,0.3), 0 0 0 0.5px rgba(0,0,0,0.08)'
    if state == 'focused':
        th_sh = f'0 1px 4px rgba(0,0,0,0.3), {ring(t)}'
    elif state == 'pressed':
        th_sh = f'0 1px 4px rgba(0,0,0,0.3), 0 0 0 10px {t["focus_halo"]}'
    thumb_bg = t['disabled_bg'] if state == 'disabled' else '#ffffff'
    vt = value_text if value_text is not None else f'{pct}%'
    dis = ' aria-disabled="true"' if state == 'disabled' else ''
    ink = t['disabled_ink'] if state == 'disabled' else t['ink']
    inner = (f'{icon(icon_name, 24, t["disabled_ink"] if state == "disabled" else t["muted"])}'
             f'<div style="flex: 1; height: 6px; border-radius: 3px; background: {t["hairline"]}; position: relative">'
             f'<div style="width: {pct}%; height: 6px; border-radius: 3px; background: {fill}"></div>'
             f'<div role="slider" tabindex="0" aria-label="{label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="{pct}" aria-valuetext="{vt}"{dis} '
             f'style="position: absolute; left: calc({pct}% - 13px); top: -10px; width: 26px; height: 26px; border-radius: 13px; background: {thumb_bg}; box-shadow: {th_sh}"></div></div>'
             f'<span style="width: 44px; text-align: right; font-size: 15px; font-weight: 700; color: {ink}">{vt}</span>')
    if framed:
        return f'<div style="background: {t["surface"]}; border-radius: 16px; padding: 18px 16px; display: flex; align-items: center; gap: 14px; flex: none">{inner}</div>'
    return f'<div style="display: flex; align-items: center; gap: 14px">{inner}</div>'


def progress_bar(t, pct, label=None, value_text=None, tone='accent'):
    """A 6px progress bar with an optional label row above (role=progressbar). tone: accent | done | warn."""
    c = t[tone] if tone != 'accent' else t['accent']
    vt = value_text if value_text is not None else f'{pct}%'
    top = (f'<div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; color: {t["ink2"]}">'
           f'<span>{label}</span><span style="color: {t["muted"]}">{vt}</span></div>') if label else ''
    al = f' aria-label="{label}"' if label else ''
    return (f'<div style="display: flex; flex-direction: column; gap: 8px; flex: none">{top}'
            f'<div role="progressbar"{al} aria-valuemin="0" aria-valuemax="100" aria-valuenow="{pct}" style="height: 6px; border-radius: 3px; background: {t["hairline"]}; overflow: hidden">'
            f'<div style="width: {pct}%; height: 6px; border-radius: 3px; background: {c}"></div></div></div>')


# --------------------------------------------------------------------------
# selection controls
# --------------------------------------------------------------------------


def chip(t, text, selected=False, state='default', icon_name=None, count=None, role='pressed'):
    """One solid pill chip (36px pill in a 44px button). Selected = solid accent, 800.
    state: default | pressed | focused | disabled; count: a number after the text."""
    if selected:
        bg, fg, fw = t['accent'], t['on_accent'], 800
        pbg = t['accent_pressed']
    else:
        bg, fg, fw = t['chip'], t['chip_ink'], 600
        pbg = mix(t['chip'], t['ink'], 0.88)
    sh, dis = '', ''
    if state == 'pressed':
        bg = pbg
    elif state == 'focused':
        sh = f'box-shadow: {ring(t, on=t["ground"]) if selected else ring(t)};'
    elif state == 'disabled':
        bg, fg = t['disabled_bg'], t['disabled_ink']
        dis = ' disabled'
    ic = icon(icon_name, 16, fg) if icon_name else ''
    cn = f'<span style="font-weight: 700; opacity: 0.75">{count}</span>' if count is not None else ''
    aria = f' aria-pressed="{"true" if selected else "false"}"' if role == 'pressed' else f' role="radio" aria-checked="{"true" if selected else "false"}"'
    return (f'<button type="button"{aria}{dis} style="flex: none; height: 44px; {BTN}">'
            f'<span style="height: 36px; padding: 0 {14 if ic else 16}px; border-radius: 18px; font-size: 14px; font-weight: {fw}; background: {bg}; color: {fg}; '
            f'display: flex; align-items: center; gap: 6px; {sh}">{ic}{text}{cn}</span></button>')


def chips(t, items, selected=0, label='Filter', scroll=True, states=None):
    """A row of chips. items: list of text; selected: index, text, or a set of either (multi);
    scroll: one line running off the right edge (approved) or wrap; states: {index: state}."""
    sel = selected if isinstance(selected, (set, list, tuple)) else {selected}
    states = states or {}
    out = ''.join(chip(t, it, i in sel or it in sel, states.get(i, 'default')) for i, it in enumerate(items))
    lay = 'flex-wrap: nowrap; margin-right: -16px; overflow: hidden; white-space: nowrap' if scroll else 'flex-wrap: wrap'
    return f'<div role="group" aria-label="{label}" style="display: flex; gap: 8px; {lay}; flex: none">{out}</div>'


def segmented(t, items, selected=0, on_band=True, label='View', state='default'):
    """The pill switch. on_band: the approved cream switch on the band (cream selected pill with band-coloured text);
    else on the sheet: chip-grey track, surface pill. state: default | focused (ring on the selected pill)."""
    n = len(items)
    if on_band:
        track, sel_bg, sel_fg, fg = t['band_track'], CREAM, t['band'], CREAM
        sel_sh = f'box-shadow: 0 2px 6px {t["band_shadow"]}'
        foc = f'box-shadow: 0 0 0 2px {t["band"]}, 0 0 0 4px {CREAM}'
    else:
        track, sel_bg, sel_fg, fg = t['chip'], t['surface'], t['ink'], t['ink2']
        sel_sh = 'box-shadow: 0 1px 3px rgba(0,0,0,0.12)'
        foc = f'box-shadow: {ring(t)}'
    out = ''
    for i, it in enumerate(items):
        on = i == selected
        if on:
            sh = foc if state == 'focused' else sel_sh
            out += (f'<button type="button" role="tab" aria-selected="true" style="height: 44px; border: 0; border-radius: 22px; background: {sel_bg}; color: {sel_fg}; '
                    f'font-size: 15px; font-weight: 800; cursor: pointer; {sh}">{it}</button>')
        else:
            out += (f'<button type="button" role="tab" aria-selected="false" style="height: 44px; border: 0; border-radius: 22px; background: none; color: {fg}; '
                    f'font-size: 15px; font-weight: 700; cursor: pointer">{it}</button>')
    return (f'<div role="tablist" aria-label="{label}" style="height: 50px; box-sizing: border-box; border-radius: 25px; background: {track}; '
            f'display: grid; grid-template-columns: repeat({n}, minmax(0, 1fr)); padding: 3px; flex: none">{out}</div>')


def switch(t, on=False, state='default', label=None):
    """A toggle: 52x32 track (accent when on), white thumb, in a 44px-tall button role=switch.
    state: default | focused | pressed | disabled. label: accessible name if no visible row label."""
    track = t['accent'] if on else t['switch_off']
    thumb = t['thumb']
    dis = ''
    if state == 'disabled':
        track = mix(t['accent'], t['surface'], 0.35) if on else t['disabled_bg']
        thumb = t['surface'] if t['mode'] == 'light' else '#5a5a62'
        dis = ' disabled'
    elif state == 'pressed':
        track = t['accent_pressed'] if on else mix(t['switch_off'], t['ink'], 0.85)
    sh = f'box-shadow: {ring(t, on=t["surface"])};' if state == 'focused' else ''
    al = f' aria-label="{label}"' if label else ''
    x = 23 if on else 3
    tw = 30 if state == 'pressed' else 26
    if state == 'pressed' and on:
        x = 19
    return (f'<button type="button" role="switch" aria-checked="{"true" if on else "false"}"{al}{dis} style="width: 56px; height: 44px; flex: none; {BTN}">'
            f'<span style="position: relative; width: 52px; height: 32px; border-radius: 16px; background: {track}; display: block; {sh}">'
            f'<span style="position: absolute; top: 3px; left: {x}px; width: {tw}px; height: 26px; border-radius: 13px; background: {thumb}; '
            f'box-shadow: 0 1px 3px rgba(0,0,0,0.25)"></span></span></button>')


def _check_box(t, kind, checked, state):
    dis = state == 'disabled'
    r = 7 if kind == 'checkbox' else 12
    if checked:
        bg = t['disabled_bg'] if dis else t['accent']
        bd = f'border: 2px solid {bg}'
        mark = (icon('check', 16, t['disabled_ink'] if dis else t['on_accent'], stroke=3) if kind == 'checkbox'
                else f'<span style="width: 10px; height: 10px; border-radius: 5px; background: {t["disabled_ink"] if dis else t["on_accent"]}"></span>')
    else:
        bg = t['disabled_bg'] if dis else 'transparent'
        bd = f'border: 2px solid {t["disabled_ink"] if dis else t["muted"]}'
        mark = ''
    sh = ''
    if state == 'focused':
        sh = f'box-shadow: {ring(t, on=t["surface"]) if checked else ring(t)};'
    elif state == 'pressed':
        sh = f'box-shadow: 0 0 0 10px {t["accent_soft"]};'
    return (f'<span aria-hidden="true" style="width: 24px; height: 24px; box-sizing: border-box; border-radius: {r}px; background: {bg}; {bd}; '
            f'display: flex; align-items: center; justify-content: center; flex: none; {sh}">{mark}</span>')


def checkbox(t, label, checked=False, state='default', meta=None, name=None):
    """A checkbox with its label (whole row is the 44px+ hit area; real <input> hidden).
    state: default | pressed | focused | disabled."""
    fid = uid('cb')
    dis = ' disabled' if state == 'disabled' else ''
    c = t['disabled_ink'] if state == 'disabled' else t['ink']
    m = f'<span style="display: block; font-size: 13px; color: {t["muted"]}; font-weight: 400">{meta}</span>' if meta else ''
    return (f'<label for="{fid}" style="display: flex; align-items: center; gap: 12px; min-height: 44px; cursor: pointer; color: {c}; font-size: 16px; font-weight: 600">'
            f'<input id="{fid}" type="checkbox"{" checked" if checked else ""}{dis} style="{SR}">{_check_box(t, "checkbox", checked, state)}'
            f'<span style="flex: 1">{label}{m}</span></label>')


def radio(t, label, checked=False, state='default', name='r', meta=None):
    """A radio with its label (as checkbox). Group several in ``radio_group``."""
    fid = uid('rb')
    dis = ' disabled' if state == 'disabled' else ''
    c = t['disabled_ink'] if state == 'disabled' else t['ink']
    m = f'<span style="display: block; font-size: 13px; color: {t["muted"]}; font-weight: 400">{meta}</span>' if meta else ''
    return (f'<label for="{fid}" style="display: flex; align-items: center; gap: 12px; min-height: 44px; cursor: pointer; color: {c}; font-size: 16px; font-weight: 600">'
            f'<input id="{fid}" type="radio" name="{name}"{" checked" if checked else ""}{dis} style="{SR}">{_check_box(t, "radio", checked, state)}'
            f'<span style="flex: 1">{label}{m}</span></label>')


def radio_group(t, legend, options, selected=0, name=None, in_card=True):
    """A fieldset of radios (e.g. the Voice count options). options: list of text."""
    name = name or uid('rg')
    rs = ''.join(radio(t, o, i == selected, name=name) for i, o in enumerate(options))
    box = f'background: {t["surface"]}; border-radius: 16px; padding: 6px 16px;' if in_card else ''
    return (f'<fieldset style="margin: 0; border: 0; padding: 0; min-width: 0; flex: none"><legend style="{ts("label", t["muted"])}; padding: 0 16px 8px">{legend}</legend>'
            f'<div style="{box}">{rs}</div></fieldset>')


# --------------------------------------------------------------------------
# tab bar
# --------------------------------------------------------------------------

TABS = [('calendar', 'Today'), ('footprints', 'Moves'), ('lessons', 'Lessons'), ('music', 'Music')]
"""The four tabs: (icon, label). Pushed screens have no tab bar."""


def tab_bar(t, active='Today', state=None):
    """The bottom tab bar (84px, absolute). Inactive tabs icon-only (28px, named for screen readers);
    the active one is a tinted pill with its FILLED icon and its label beside it. active: a TABS label
    or None. state: None | ('focused', label) | ('pressed', label) for one inactive tab."""
    items = ''
    for g, lab in TABS:
        on = lab == active
        if on:
            ic = icon(g, 28, t['accent'], filled=True, bg=t['tab_bg'])
            items += (f'<div style="position: relative; display: flex; justify-content: center">'
                      f'<a href="#" aria-current="page" style="margin-top: 10px; height: 44px; padding: 0 16px 0 12px; border-radius: 22px; background: {t["tab_tint"]}; '
                      f'display: flex; align-items: center; gap: 7px; text-decoration: none; color: {t["accent_text"]}; font-size: 14px; font-weight: 800">{ic}{lab}</a></div>')
        else:
            sh = ''
            if state and state[1] == lab:
                sh = f'box-shadow: {ring(t)};' if state[0] == 'focused' else f'background: {t["pressed"]};'
            items += (f'<div style="display: flex; justify-content: center"><a href="#" aria-label="{lab}" style="margin-top: 10px; width: 44px; height: 44px; '
                      f'border-radius: 22px; display: flex; align-items: center; justify-content: center; {sh}">{icon(g, 28, t["muted"])}</a></div>')
    cols = ' '.join('1.6fr' if lab == active else '1fr' for _, lab in TABS)
    return (f'<nav aria-label="Main" style="position: absolute; left: 0; right: 0; bottom: 0; height: 84px; box-sizing: border-box; background: {t["tab_bg"]}; '
            f'border-top: 1px solid {t["tab_line"]}; display: grid; grid-template-columns: {cols}; align-content: start; padding: 0 12px">{items}</nav>')


def tab_bar_strip(t, active='Today', state=None):
    """The tab bar drawn in its own 390x84 box (for boards), not inside a phone."""
    return (f'<div style="position: relative; width: 390px; height: 84px; flex: none; overflow: hidden; border-radius: 0 0 20px 20px; '
            f'background: {t["tab_bg"]}; {MANROPE}">{tab_bar(t, active, state)}</div>')


# --------------------------------------------------------------------------
# overlays
# --------------------------------------------------------------------------


def scrim(t):
    """The dimming layer under a bottom sheet or dialog (absolute, full phone)."""
    return f'<div aria-hidden="true" style="position: absolute; inset: 0; background: {t["scrim"]}"></div>'


def bottom_sheet(t, title, inner, footer=None, close=True, height=None, back=False, sub=None, gap=12):
    """A bottom sheet over a scrim: radius 28 top, grabber, Bricolage title + close (or back) button,
    content (``inner``), optional footer (buttons). Append to a page's ``overlay``.
    height: fixed px (else fits content); back: a Back button left of the title (stacked levels)."""
    hid = uid('sheet')
    h = f'height: {height}px; ' if height else ''
    cl = icon_button(t, 'close', 'Close', 'bare', on=t['sheet_bg']) if close else ''
    bk = icon_button(t, 'back', 'Back', 'bare', on=t['sheet_bg']) if back else ''
    sb = f'<span style="font-size: 14px; color: {t["muted"]}">{sub}</span>' if sub else ''
    ft = f'<div style="margin-top: auto; padding-top: 4px; display: flex; flex-direction: column; gap: 8px">{footer}</div>' if footer else ''
    return (scrim(t) + f'<div role="dialog" aria-modal="true" aria-labelledby="{hid}" style="position: absolute; left: 0; right: 0; bottom: 0; {h}box-sizing: border-box; '
            f'background: {t["sheet_bg"]}; border-radius: 28px 28px 0 0; padding: 8px 16px 34px; display: flex; flex-direction: column; gap: {gap}px; '
            f'box-shadow: 0 -8px 30px rgba(0,0,0,0.18)">'
            f'<div aria-hidden="true" style="width: 40px; height: 5px; border-radius: 3px; background: {t["grabber"]}; margin: 0 auto 2px; flex: none"></div>'
            f'<div style="display: flex; align-items: center; gap: 4px; min-height: 44px; {"margin-left: -8px; " if back else "padding-left: 4px; "}margin-right: -6px">{bk}'
            f'<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px"><h3 id="{hid}" style="margin: 0; {ts("headline", t["ink"])}">{title}</h3>{sb}</div>{cl}</div>'
            f'{inner}{ft}</div>')


def dialog(t, title, body, actions, icon_name=None, tone='accent'):
    """A centred alert dialog over a scrim (320 wide, radius 28, raised surface).
    actions: list of button html, laid right-aligned (``button(t, 'Cancel', 'tertiary', size='sm', on=t['raised'])``).
    icon_name/tone: optional icon in a soft circle above the title (tone: accent | danger | warn | done)."""
    hid = uid('dlg')
    soft = {'accent': 'accent_soft', 'danger': 'danger_soft', 'warn': 'warn_soft', 'done': 'done_soft'}[tone]
    ink = {'accent': 'accent_text', 'danger': 'danger', 'warn': 'warn', 'done': 'done'}[tone]
    ic = (f'<span style="width: 48px; height: 48px; border-radius: 24px; background: {t[soft]}; display: flex; align-items: center; justify-content: center">'
          f'{icon(icon_name, 24, t[ink])}</span>') if icon_name else ''
    return (scrim(t) + f'<div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 0 24px">'
            f'<div role="alertdialog" aria-modal="true" aria-labelledby="{hid}" aria-describedby="{hid}-b" style="width: 100%; max-width: 330px; box-sizing: border-box; '
            f'background: {t["raised"]}; border-radius: 28px; padding: 24px 20px 16px 24px; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 20px 50px rgba(0,0,0,0.3)">{ic}'
            f'<h3 id="{hid}" style="margin: 0; {ts("headline", t["ink"])}">{title}</h3>'
            f'<p id="{hid}-b" style="margin: 0; font-size: 15px; line-height: 1.45; color: {t["ink2"]}">{body}</p>'
            f'<div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; flex-wrap: wrap">{"".join(actions)}</div></div></div>')


def toast(t, text, action=None, icon_name=None, bottom=100, tone=None):
    """A snackbar: inverse-colour rounded card pinned above the tab bar (``bottom`` px), role=status.
    action: label of a text button in inverse_accent (e.g. "Undo"); icon_name: leading icon
    (tone 'done' paints it green)."""
    ic = ''
    if icon_name:
        c = t['done'] if tone == 'done' else t['inverse_ink']
        if tone == 'done':
            c = '#5cc98f' if t['mode'] == 'light' else '#1e7a4f'
        ic = icon(icon_name, 22, c)
    ac = (f'<button type="button" style="height: 44px; border: 0; background: none; padding: 0 12px; color: {t["inverse_accent"]}; font-size: 15px; font-weight: 800; cursor: pointer; flex: none">'
          f'{action}</button>') if action else ''
    return (f'<div role="status" style="position: absolute; left: 16px; right: 16px; bottom: {bottom}px; min-height: 52px; box-sizing: border-box; border-radius: 16px; '
            f'background: {t["inverse_bg"]}; color: {t["inverse_ink"]}; display: flex; align-items: center; gap: 12px; padding: 4px {4 if action else 16}px 4px 16px; '
            f'box-shadow: 0 10px 30px rgba(0,0,0,0.28)">{ic}<span style="flex: 1; font-size: 15px; font-weight: 600; line-height: 1.35">{text}</span>{ac}</div>')


def toast_inline(t, text, action=None, icon_name=None, tone=None):
    """A toast drawn in normal flow (for boards)."""
    return toast(t, text, action, icon_name, tone=tone).replace('position: absolute; left: 16px; right: 16px; bottom: 100px; ', '')


def banner(t, kind='info', title='', body=None, action=None, dismiss=False):
    """An inline message card (radius 16). kind: info (accent) | warning | error | success.
    action: label of a tertiary button; dismiss: a close icon button."""
    bg, ink, ic = {
        'info': (t['accent_soft'], t['accent_text'], 'info'),
        'warning': (t['warn_soft'], t['warn'], 'warning'),
        'error': (t['danger_soft'], t['danger'], 'warning'),
        'success': (t['done_soft'], t['done'], 'check-circle'),
    }[kind]
    role = 'alert' if kind == 'error' else 'status'
    b = f'<span style="font-size: 14px; line-height: 1.4; color: {t["ink2"]}">{body}</span>' if body else ''
    ac = (f'<button type="button" style="align-self: flex-start; height: 36px; margin: 2px 0 -6px -10px; border: 0; background: none; padding: 0 10px; color: {ink}; '
          f'font-size: 14px; font-weight: 800; cursor: pointer">{action}</button>') if action else ''
    ds = icon_button(t, 'close', 'Dismiss', 'bare', size=40, icon_size=20, color=t['muted'], on=bg) if dismiss else ''
    return (f'<div role="{role}" style="background: {bg}; border-radius: 16px; padding: 14px {6 if dismiss else 16}px 14px 14px; display: flex; gap: 12px; align-items: flex-start; flex: none">'
            f'{icon(ic, 22, ink, style="margin-top: 1px")}'
            f'<div style="flex: 1; display: flex; flex-direction: column; gap: 3px; padding-top: 1px">'
            f'<span style="font-size: 15px; font-weight: 800; color: {t["ink"]}; line-height: 1.35">{title}</span>{b}{ac}</div>{ds}</div>')


def empty_state(t, icon_name, title, body, action=None):
    """A centred empty state: icon in a 72px tonal circle, Bricolage title, muted body, optional action html."""
    ac = f'<div style="margin-top: 8px">{action}</div>' if action else ''
    return (f'<div style="display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; padding: 36px 24px; flex: none">'
            f'<span style="width: 72px; height: 72px; border-radius: 36px; background: {t["accent_soft"]}; display: flex; align-items: center; justify-content: center; margin-bottom: 8px">'
            f'{icon(icon_name, 32, t["accent_text"])}</span>'
            f'<h3 style="margin: 0; {ts("headline", t["ink"])}">{title}</h3>'
            f'<p style="margin: 0; max-width: 280px; font-size: 15px; line-height: 1.45; color: {t["muted"]}">{body}</p>{ac}</div>')


def skeleton_rows(t, n=3, label='Loading', leading=False):
    """Loading placeholders: a list group of ``n`` grey-bar rows, aria-busy, with a hidden status text."""
    rows = ''
    widths = [(62, 40), (48, 56), (70, 34), (54, 46), (66, 38)]
    for i in range(n):
        w1, w2 = widths[i % len(widths)]
        hair = '' if i == n - 1 else f'border-bottom: 1px solid {t["hairline"]};'
        ld = (f'<span style="width: 40px; height: 40px; border-radius: 10px; background: {t["skeleton"]}; flex: none"></span>' if leading else '')
        rows += (f'<div style="padding-left: 16px"><div style="display: flex; align-items: center; gap: 12px; min-height: 64px; padding-right: 16px; {hair}">{ld}'
                 f'<div style="flex: 1; display: flex; flex-direction: column; gap: 8px"><span style="width: {w1}%; height: 12px; border-radius: 6px; background: {t["skeleton"]}"></span>'
                 f'<span style="width: {w2}%; height: 10px; border-radius: 5px; background: {t["skeleton_hi"] if t["mode"] == "dark" else t["skeleton"]}; opacity: 0.8"></span></div></div></div>')
    return (f'<div aria-busy="true" style="background: {t["surface"]}; border-radius: 16px; overflow: hidden; flex: none">'
            f'<span role="status" style="{SR}">{label}</span>{rows}</div>')


def badge(t, text, tone='neutral', solid=False, icon_name=None):
    """A small status pill (24px, 12px 800). tone: neutral | accent | done | warn | danger; solid: filled."""
    soft = {'neutral': t['chip'], 'accent': t['accent_soft'], 'done': t['done_soft'], 'warn': t['warn_soft'], 'danger': t['danger_soft']}[tone]
    ink = {'neutral': t['ink2'], 'accent': t['accent_text'], 'done': t['done'], 'warn': t['warn'], 'danger': t['danger']}[tone]
    if solid:
        soft, ink = {'neutral': (t['ink2'], t['surface']), 'accent': (t['accent'], t['on_accent']), 'done': (t['done'], t['on_done']),
                     'warn': (t['warn'], t['surface'] if t['mode'] == 'light' else '#1a1000'), 'danger': (t['danger'], t['on_danger'])}[tone]
    ic = icon(icon_name, 14, ink, stroke=2.5) if icon_name else ''
    return (f'<span style="height: 24px; box-sizing: border-box; padding: 0 10px; border-radius: 12px; background: {soft}; color: {ink}; font-size: 12px; font-weight: 800; '
            f'display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; flex: none">{ic}{text}</span>')


# --------------------------------------------------------------------------
# media cards
# --------------------------------------------------------------------------


def thumb(t, w=112, h=64, duration=None, tone=0, play=True, radius=10, progress=None):
    """A video thumbnail placeholder (no real images exist): a dance-colour gradient, a
    centred play disc, optional duration pill and watched-progress line. tone 0-3 varies it."""
    angles = [135, 160, 115, 200]
    a, b = t['band'], mix(t['band'], '#000000', 0.55)
    c = mix(t['accent'], '#000000', 0.7)
    grad = f'linear-gradient({angles[tone % 4]}deg, {a}, {b} 60%, {c})'
    pl = ''
    if play:
        d = max(24, min(44, h // 2))
        pl = (f'<span style="position: absolute; left: 50%; top: 50%; width: {d}px; height: {d}px; margin: -{d // 2}px 0 0 -{d // 2}px; border-radius: {d // 2}px; '
              f'background: rgba(0,0,0,0.38); display: flex; align-items: center; justify-content: center">'
              f'{icon("play", d // 2, "#ffffff", filled=True, style="margin-left: 2px")}</span>')
    du = (f'<span style="position: absolute; right: 6px; bottom: 6px; height: 18px; padding: 0 6px; border-radius: 9px; background: rgba(0,0,0,0.62); color: #ffffff; '
          f'font-size: 11px; font-weight: 800; display: flex; align-items: center">{duration}</span>') if duration else ''
    pr = (f'<span style="position: absolute; left: 0; bottom: 0; width: {progress}%; height: 3px; background: {t["accent"]}"></span>') if progress else ''
    return (f'<span aria-hidden="true" style="position: relative; display: block; width: {w}px; height: {h}px; flex: none; border-radius: {radius}px; overflow: hidden; '
            f'background: {grad}">{pl}{du}{pr}</span>')


def video_card(t, title, meta, duration='2:41', layout='row', tone=0, progress=None, trailing=None, last=False, href='#', badge_html=''):
    """A video as a row (thumbnail 112x64 + title/meta, for list_group) or a tile (full-width 16:9
    card, radius 22). Used for lesson videos and recordings."""
    if layout == 'row':
        return row(t, title, meta + (f' {badge_html}' if badge_html else ''), trailing if trailing is not None else chevron(t),
                   leading=thumb(t, 112, 64, duration, tone, progress=progress), href=href, last=last, min_h=84)
    return (f'<a href="{href}" style="display: block; background: {t["surface"]}; border-radius: 22px; overflow: hidden; text-decoration: none; color: {t["ink"]}; flex: none">'
            f'{thumb(t, 358, 201, duration, tone, radius=0, progress=progress).replace("width: 358px", "width: 100%")}'
            f'<span style="display: flex; align-items: center; gap: 10px; padding: 12px 14px 14px 16px">'
            f'<span style="flex: 1; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 16px; font-weight: 700">{title}</span>'
            f'<span style="font-size: 13px; color: {t["muted"]}">{meta}</span></span>{badge_html}{trailing or chevron(t)}</span></a>')


def youtube_card(t, title, meta='youtube.com', state='link', pct=40, tone=1):
    """A YouTube link card (lesson/figure link). state: link (Save video button) | saving (progress) |
    saved (badge, it is now a video) | failed (error + Retry)."""
    head = (f'<div style="display: flex; align-items: center; gap: 12px">{thumb(t, 112, 64, None, tone)}'
            f'<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px">'
            f'<span style="font-size: 16px; font-weight: 700; line-height: 1.3">{title}</span>'
            f'<span style="display: flex; align-items: center; gap: 5px; font-size: 13px; color: {t["muted"]}">{icon("youtube", 16, t["muted"])}{meta}</span></div></div>')
    if state == 'link':
        foot = (f'<div style="display: flex; gap: 8px">{button(t, "Save video", "secondary", icon_name="download", size="sm", on=t["surface"])}'
                f'{button(t, "Open", "tertiary", icon_name="external", size="sm", on=t["surface"])}</div>')
    elif state == 'saving':
        foot = progress_bar(t, pct, 'Saving at 480p', f'{pct}%')
    elif state == 'saved':
        foot = f'<div style="display: flex; align-items: center; gap: 8px">{badge(t, "Saved", "done", icon_name="check")}<span style="font-size: 13px; color: {t["muted"]}">Now a recording, spots and all</span></div>'
    else:
        foot = (f'<div style="display: flex; align-items: center; justify-content: space-between; gap: 8px">'
                f'<span style="display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: {t["danger"]}">{icon("warning", 16, t["danger"])}Download failed</span>'
                f'{button(t, "Retry", "tertiary", icon_name="refresh", size="sm", on=t["surface"])}</div>')
    return (f'<div style="background: {t["surface"]}; border-radius: 16px; padding: 12px 12px 12px 12px; display: flex; flex-direction: column; gap: 12px; flex: none">'
            f'{head}{foot}</div>')


# --------------------------------------------------------------------------
# documents
# --------------------------------------------------------------------------

BOARD_BG = '#e6e6ea'
BOARD_INK = '#111114'
BOARD_MUTED = '#55555c'


def document(body, width, height, title):
    """The full .dc.html document around ``body`` (skeleton, fonts, $preview width x height)."""
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{esc(title)}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
{FONTS_LINK}
<style>
body{{margin:0}}
a{{color:#6e6e76}}a:hover{{color:#111114}}
button{{font:inherit}}
</style>
</helmet>
{body}
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":{width},"height":{height}}}}}'>
class Component extends DCLogic {{
renderVals() {{
return {{}};
}}
}}
</script>
</body>
</html>
'''


PHONE_W, PHONE_H = 390, 844
PAIR_GAP, COL_GAP, ROW_GAP, PAD = 48, 96, 72, 48
HEAD_H, CAP_H = 64, 64


def artboard(title, sub, screens, per_row=3, doc_title=None, dance=None):
    """A whole artboard document of light/dark phone pairs.

    screens: list of dicts {name, note, fn, dance} (or tuples (name, note, fn[, dance])):
      fn(t) -> phone html (draw with kit.page/phone); dance defaults to ``dance`` arg or 'salsa'.
      Each screen is drawn with THEMES[(dance,'light')] and THEMES[(dance,'dark')] side by side,
      caption under the pair: name (22px 800) + note (15px).
    per_row: pairs per row (3 = 6 phones, 2772px wide).
    Returns (html, width, height); the root div and $preview are exactly width x height."""
    norm = []
    for s in screens:
        if isinstance(s, dict):
            norm.append((s['name'], s.get('note', ''), s['fn'], s.get('dance', dance or 'salsa')))
        else:
            n, note, fn = s[:3]
            norm.append((n, note, fn, s[3] if len(s) > 3 else dance or 'salsa'))
    pair_w = PHONE_W * 2 + PAIR_GAP
    cols = min(per_row, len(norm))
    width = PAD * 2 + cols * pair_w + (cols - 1) * COL_GAP
    nrows = (len(norm) + per_row - 1) // per_row
    row_h = PHONE_H + 20 + CAP_H
    height = PAD + HEAD_H + ROW_GAP + nrows * row_h + (nrows - 1) * ROW_GAP + PAD
    rows_html = ''
    for r in range(nrows):
        pairs = ''
        for name, note, fn, d in norm[r * per_row:(r + 1) * per_row]:
            light = fn(THEMES[(d, 'light')])
            dark = fn(THEMES[(d, 'dark')])
            pairs += (f'<!-- {esc(name)} -->\n<div style="width: {pair_w}px; flex: none; display: flex; flex-direction: column; gap: 20px">'
                      f'<div style="display: flex; gap: {PAIR_GAP}px">{light}{dark}</div>'
                      f'<div style="height: {CAP_H}px; display: flex; flex-direction: column; gap: 4px; padding-left: 4px">'
                      f'<span style="font-size: 22px; font-weight: 800; letter-spacing: -0.01em; color: {BOARD_INK}">{name}</span>'
                      f'<span style="font-size: 15px; font-weight: 600; color: {BOARD_MUTED}">{note}</span></div></div>\n')
        rows_html += f'<div style="display: flex; gap: {COL_GAP}px; align-items: flex-start; height: {row_h}px; flex: none">\n{pairs}</div>\n'
    body = (f'<div style="width: {width}px; height: {height}px; box-sizing: border-box; padding: {PAD}px; background: {BOARD_BG}; color: {BOARD_INK}; {MANROPE}; '
            f'display: flex; flex-direction: column; gap: {ROW_GAP}px; overflow: hidden">'
            f'<div style="height: {HEAD_H}px; flex: none; display: flex; flex-direction: column; gap: 6px">'
            f'<h1 style="margin: 0; font-size: 30px; font-weight: 800; {BRIC}">{title}</h1>'
            f'<p style="margin: 0; font-size: 16px; color: {BOARD_MUTED}">{sub}</p></div>\n{rows_html}</div>')
    return document(body, width, height, doc_title or title), width, height


def write(path, html):
    """Write ``html`` to ``path`` (utf-8) and return the path."""
    with open(path, 'w', encoding='utf-8') as f:
        f.write(html)
    return path


# --------------------------------------------------------------------------
# audit
# --------------------------------------------------------------------------

CONTRAST_PAIRS = [
    # (fg, bg, minimum, what)
    ('band_ink', 'band', 3.0, 'band title / icons (large)'),
    ('band_small', 'band', 4.5, 'small text on the band'),
    ('ink', 'surface', 4.5, 'text on cards'),
    ('ink', 'ground', 4.5, 'text on the page'),
    ('ink2', 'surface', 4.5, 'body copy'),
    ('muted', 'surface', 4.5, 'meta on cards'),
    ('muted', 'ground', 4.5, 'section labels'),
    ('accent_text', 'surface', 4.5, 'small accent text'),
    ('accent_text', 'ground', 4.5, 'small accent text on page'),
    ('accent_text', 'accent_soft', 4.5, 'tonal button text'),
    ('on_accent', 'accent', 4.5, 'primary button text'),
    ('status', 'surface', 4.5, 'overdue / not in a routine'),
    ('accent', 'surface', 3.0, 'accent glyphs (non-text)'),
    ('done', 'surface', 3.0, 'done check (non-text)'),
    ('done', 'done_soft', 4.5, 'success text'),
    ('danger', 'surface', 4.5, 'error text'),
    ('danger', 'ground', 4.5, 'field error under a field'),
    ('status', 'ground', 4.5, 'status text on the page'),
    ('danger', 'danger_soft', 4.5, 'error banner'),
    ('on_danger', 'danger', 4.5, 'danger button'),
    ('warn', 'warn_soft', 4.5, 'warning banner'),
    ('chip_ink', 'chip', 4.5, 'chip text'),
    ('accent_text', 'tab_bg', 4.5, 'active tab label'),
    ('muted', 'tab_bg', 3.0, 'inactive tab icon'),
    ('inverse_ink', 'inverse_bg', 4.5, 'toast text'),
    ('inverse_accent', 'inverse_bg', 4.5, 'toast action'),
    ('ink2', 'sheet_bg', 4.5, 'text in a bottom sheet'),
    ('ink2', 'raised', 4.5, 'dialog body'),
]


def audit(t):
    """Contrast check of a theme: list of (what, fg, bg, ratio, minimum, ok)."""
    out = []
    for fg, bg, mn, what in CONTRAST_PAIRS:
        under = t['band'] if bg == 'band' else t['surface']
        r = contrast(t[fg], t[bg], under)
        out.append((what, fg, bg, round(r, 2), mn, r >= mn))
    return out


if __name__ == '__main__':
    for k, t in THEMES.items():
        bad = [a for a in audit(t) if not a[5]]
        print(k, 'OK' if not bad else bad)


# --------------------------------------------------------------------------
# 2026-11-04: master's app icons the board kit lacked (groups, clones), and the fifth tab.
# Pulled from src/lib/icons/icons.ts into app_icons.json.
# --------------------------------------------------------------------------
def _load_app_icons():
    import json as _json, os as _os
    p = _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'app_icons.json')
    if not _os.path.exists(p):
        return
    d = _json.load(open(p))
    for k, v in d['icons'].items():
        if k not in ICONS and k not in ALIASES:
            ICONS[k] = v
    for k, v in d['filled'].items():
        k2 = ALIASES.get(k, k)
        if k2 not in FILLED:
            FILLED[k2] = v.replace('var(--icon-knockout, Canvas)', '{bg}').replace('currentColor', '{c}')


_load_app_icons()
TABS = [('calendar', 'Today'), ('footprints', 'Moves'), ('lessons', 'Lessons'), ('group', 'Groups'), ('music', 'Music')]
