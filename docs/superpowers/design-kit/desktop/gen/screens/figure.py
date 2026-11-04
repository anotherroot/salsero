"""A figure (one variation's page) redrawn in the C4 look.

    python3 figure.py  -> canvas/project/S-figure.dc.html
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SCR = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, os.path.join(SCR, 'gen', 'kit'))
import kit  # noqa: E402

# A glyph the kit lacks: "move to" (an arrow into a wall), from the old page's Move row.
kit.ICONS.setdefault('move-to', kit._p('M4 12h11M11 6.5l5.5 5.5-5.5 5.5', 'M20 5v14'))


# --------------------------------------------------------------------------
# blocks of this area (built from kit tokens)
# --------------------------------------------------------------------------

def plural(n, one, many=None):
    return f'{n} {one if n == 1 else (many or one + "s")}'


def var_bar(t, fig, name, i, n):
    """The variation switcher pinned to the bottom (pushed screen: no tab bar).
    ‹ and › step (wrapping); the middle opens "Variations of <figure>"."""
    st = 'disabled' if n == 1 else 'default'
    prev = kit.icon_button(t, 'chevron-left', 'Previous variation', 'step', st, size=48, icon_size=22, on=t['tab_bg'])
    nxt = kit.icon_button(t, 'chevron-right', 'Next variation', 'step', st, size=48, icon_size=22, on=t['tab_bg'])
    mid = (f'<button type="button" aria-haspopup="dialog" style="flex: 1; min-width: 0; height: 52px; border: 0; border-radius: 26px; '
           f'background: {t["accent_soft"]}; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 0 16px; cursor: pointer">'
           f'<span style="display: flex; flex-direction: column; align-items: center; min-width: 0; gap: 1px">'
           f'<span style="font-size: 16px; font-weight: 800; color: {t["ink"]}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%">{name}</span>'
           f'<span style="font-size: 12px; font-weight: 700; color: {t["accent_text"]}">{i} of {plural(n, "variation")}</span></span>'
           f'{kit.icon("chevron-up", 18, t["accent_text"], stroke=2.5)}</button>')
    return (f'<nav aria-label="Variations of {fig}" style="position: absolute; left: 0; right: 0; bottom: 0; background: {t["tab_bg"]}; '
            f'border-top: 1px solid {t["tab_line"]}; padding: 10px 12px 30px; display: flex; align-items: center; gap: 8px">{prev}{mid}{nxt}</nav>')


def collapsed_bar(t, title, sub=None, left=None, right=''):
    """The band once the page has scrolled: a slim band (64px) with back, a 22px title and the actions.
    The big compact title scrolls away; this stays."""
    left = left or kit.band_button(t, 'back', 'Back to Moves')
    s = f'<span style="{kit.ts("caption", t["band_small"])}; font-weight: 600">{sub}</span>' if sub else ''
    return (f'<header style="background: {t["band"]}; padding: 10px 10px 10px; display: flex; align-items: center; gap: 4px; flex: none; '
            f'box-shadow: 0 2px 10px {t["band_shadow"]}; position: relative; z-index: 2">{left}'
            f'<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px">'
            f'<h2 style="margin: 0; {kit.ts("headline", kit.CREAM)}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{title}</h2>{s}</div>'
            f'<div style="display: flex; align-items: center">{right}</div></header>')


def scrolled(t, title, sub, body, footer='', overlay='', left=None, right=None, pad='14px 16px 0', end=False):
    """A scrolled page: collapsed bar + content (clipped by the phone) + pinned footer + overlay."""
    if right is None:
        right = kit.band_button(t, 'edit', 'Edit')
    inner = (collapsed_bar(t, title, sub, left, right)
             + f'<div style="flex: 1; background: {t["ground"]}; padding: {pad}; display: flex; flex-direction: column; gap: 8px; {"justify-content: flex-end; overflow: hidden" if end else ""}">{body}</div>'
             + footer + overlay)
    return kit.phone(t, inner)


def timing_strip(t, start, length):
    """Starts on N · L counts, drawn as the eight counts with the start count solid."""
    cells = ''
    for c in range(1, 9):
        on = c == start
        bg = t['accent'] if on else t['chip']
        fg = t['on_accent'] if on else t['ink2']
        cells += (f'<span style="flex: 1; height: 30px; border-radius: 8px; background: {bg}; color: {fg}; display: flex; align-items: center; '
                  f'justify-content: center; font-size: 14px; font-weight: 800; font-variant-numeric: tabular-nums">{c}</span>')
    eights = f' · {length // 8} eights' if length % 8 == 0 and length > 8 else (' · one 8-count' if length == 8 else '')
    return (f'<div style="display: flex; flex-direction: column; gap: 8px">'
            f'<div style="display: flex; justify-content: space-between; align-items: baseline">'
            f'<span style="{kit.ts("label", t["muted"])}">Timing</span>'
            f'<span style="font-size: 15px; font-weight: 700; color: {t["ink"]}">Starts on {start} · {length} counts'
            f'<span style="font-weight: 500; color: {t["muted"]}">{eights}</span></span></div>'
            f'<div role="img" aria-label="Starts on count {start}" style="display: flex; gap: 4px">{cells}</div></div>')


def fact(t, label, value):
    return (f'<div style="display: flex; flex-direction: column; gap: 3px"><span style="{kit.ts("label", t["muted"])}">{label}</span>'
            f'<span style="font-size: 15px; font-weight: 700; color: {t["ink"]}; line-height: 1.35">{value}</span></div>')


def hair(t):
    return f'<div style="height: 1px; background: {t["hairline"]}; margin: 0 -16px"></div>'


def arrow(t):
    return f'<span style="color: {t["muted"]}; font-weight: 600"> → </span>'


def summary(t, badges, start, length, starts, end, notes=None):
    """The variation's own facts: style and partner, timing, handholds, notes."""
    b = ''.join(badges)
    n = (hair(t) + f'<p style="margin: 0; {kit.ts("body", t["ink2"])}; font-size: 15px">{notes}</p>') if notes else ''
    return kit.card(t, f'<div style="display: flex; gap: 6px; flex-wrap: wrap">{b}</div>'
                    + timing_strip(t, start, length) + hair(t)
                    + fact(t, 'Handholds', f'{starts}{arrow(t)}{end}') + n, gap=14)


def play_disc(t, size=40):
    return (f'<span style="width: {size}px; height: {size}px; border-radius: {size // 2}px; background: {t["accent"]}; display: flex; '
            f'align-items: center; justify-content: center; flex: none">{kit.icon("play", size // 2, t["on_accent"], filled=True, style="margin-left: 2px")}</span>')


def section_row(t, title, meta, trailing=None, href='#', last=False):
    """A linked section as a card row: a tap plays it full screen, looping."""
    return kit.row(t, title, meta, trailing if trailing is not None else kit.icon('repeat', 20, t['chevron']),
                   leading=play_disc(t), href=href if trailing is None else None, last=last)


def recording(t, date, size, dur, tone=0, spots=(), editing=False):
    """A recording: the inline player (16:9, a tap plays it in place; Full screen is in the row), its date and size, and the
    sections saved on it (each can link to a variation or a drill)."""
    th = kit.thumb(t, 358, 190, dur, tone, radius=0).replace('width: 358px', 'width: 100%')
    tools = (kit.icon_button(t, 'trash', 'Delete this recording', 'bare', color=t['danger'], on=t['surface']) if editing else
             kit.icon_button(t, 'mirror', 'Mirror', 'bare', color=t['muted'], on=t['surface'])
             + kit.icon_button(t, 'speed', 'Speed: 1×', 'bare', color=t['muted'], on=t['surface'])
             + kit.icon_button(t, 'expand', 'Full screen', 'bare', color=t['muted'], on=t['surface']))
    meta = (f'<div style="display: flex; align-items: center; gap: 4px; padding: 6px 4px 6px 16px">'
            f'<span style="flex: 1; font-size: 13px; color: {t["muted"]}">{date} · {size}</span>{tools}</div>')
    sec = ''
    if spots:
        rows = ''
        for i, (title, m) in enumerate(spots):
            tr = (kit.button(t, 'Unlink', 'tertiary', size='sm', on=t['surface']) if editing and 'Linked' in m
                  else kit.icon_button(t, 'link', f'Link {title}', 'bare', color=t['accent_text'], on=t['surface']))
            rows += kit.row(t, title, m, tr, leading=play_disc(t, 36), last=i == len(spots) - 1, min_h=58)
        sec = (f'<div style="border-top: 1px solid {t["hairline"]}"><div style="padding: 10px 16px 0; {kit.ts("label", t["muted"])}">'
               f'Sections · {len(spots)}</div>{rows}</div>')
    return f'<div style="background: {t["surface"]}; border-radius: 16px; overflow: hidden; flex: none">{th}{meta}{sec}</div>'


def two_lists(t, a, b):
    """Follows from / Leads to, side by side."""
    def col(title, items):
        if items:
            body = ''.join(
                f'<a href="#" style="display: flex; align-items: center; justify-content: space-between; gap: 4px; min-height: 44px; '
                f'{"" if i == len(items) - 1 else "border-bottom: 1px solid " + t["hairline"] + ";"} text-decoration: none; color: {t["ink"]}; font-size: 15px; font-weight: 700">'
                f'<span style="min-width: 0">{it}</span>{kit.chevron(t)}</a>' for i, it in enumerate(items))
        else:
            body = f'<span style="display: block; padding: 10px 0 12px; font-size: 14px; color: {t["muted"]}">Nothing yet</span>'
        return (f'<div style="flex: 1; min-width: 0; background: {t["surface"]}; border-radius: 16px; padding: 12px 10px 4px 14px">'
                f'<span style="{kit.ts("label", t["muted"])}">{title}</span>{body}</div>')
    def grp(title, items, top):
        rows = [dict(title=it, trailing=kit.chevron(t), href='#', min_h=48) for it in items]
        return label(t, title, top) + (kit.list_group(t, rows) if rows else kit.card(t, f'<span style="font-size: 14px; color: {t["muted"]}">Nothing yet</span>', pad='14px 16px'))
    return grp('Follows from', a, 0) + grp('Leads to', b, 6)


def label(t, text, top=8, trailing=None):
    return kit.section_label(t, text, top, trailing)


def full(inner):
    return f'<div style="display: flex; flex-direction: column; flex: none">{inner}</div>'


def caption(t, text):
    return f'<span style="padding: 0 16px; font-size: 13px; color: {t["muted"]}; text-align: center">{text}</span>'


# --------------------------------------------------------------------------
# content
# --------------------------------------------------------------------------

DOBLE_NOTES = 'Second turn on 5 — keep the left hand low and guide, don’t pull. Teacher: “finish facing her, not the wall.”'


def head(t, fig, var, tall=False, editing=False):
    if editing:
        return kit.band_header(t, fig, f'Editing {var}', left=kit.band_button(t, 'close', 'Stop editing'), tall=tall)
    return kit.band_header(t, fig, var, left=kit.band_button(t, 'back', 'Back to Moves'),
                           right=kit.band_button(t, 'edit', 'Edit'), tall=tall)


def enchufla_top(t, overlay=''):
    body = (summary(t, [kit.badge(t, 'Salsa', 'accent'), kit.badge(t, 'With partner', 'neutral', icon_name='people')],
                    1, 16, 'Open two hands', 'Hammerlock', DOBLE_NOTES)
            + label(t, 'Practice')
            + kit.list_group(t, [dict(title='Every 3 days', meta='2 days overdue', meta_tone='status', trailing=kit.log_button(t, 'Enchufla · Doble')),
                                 dict(title='Its exercise', meta='History, how often, active', trailing=kit.chevron(t), href='#')])
            + label(t, 'In routines · 2')
            + kit.list_group(t, [dict(title='Social set A', meta='Slots 2 and 5 · loops', trailing=kit.chevron(t), href='#'),
                                 dict(title='Cubana combo', meta='Slot 3 of 6', trailing=kit.chevron(t), href='#')]))
    return kit.page(t, head(t, 'Enchufla', 'Doble'), body, pad='18px 16px 0', footer=var_bar(t, 'Enchufla', 'Doble', 2, 3), overlay=overlay)


def enchufla_recordings(t):
    body = (two_lists(t, ['Dile que no · Basic', 'Setenta · Basic'], ['Hammerlock · Basic', 'Sombrero · Basic'])
            + label(t, 'Recordings · 2', 10)
            + recording(t, 'Wednesday 28 October', '34 MB', '0:41', 0,
                        [('Second turn', '0:12–0:19 · Linked to Hammerlock · Basic'), ('0:24–0:31', 'Not linked')])
            + kit.button(t, 'Add video or audio', 'secondary', icon_name='upload', full=True))
    return scrolled(t, 'Enchufla', 'Doble', body, var_bar(t, 'Enchufla', 'Doble', 2, 3))


def enchufla_sections(t):
    link_btn = kit.button(t, 'Link a section', 'tertiary', icon_name='link', size='sm')
    plain = kit.row(t, 'Rueda calls glossary', 'ruedadecasino.example', kit.icon_button(t, 'trash', 'Remove link', 'bare', color=t['muted'], on=t['surface']),
                    leading=f'<span style="width: 40px; height: 40px; border-radius: 20px; background: {t["chip"]}; display: flex; align-items: center; justify-content: center">{kit.icon("external", 20, t["ink2"])}</span>',
                    last=True)
    body = (label(t, 'Sections · 2', 0, link_btn)
            + kit.list_group(t, [section_row(t, 'Doble, slow', 'Cubana class · 13 Oct · 0:42–0:55'),
                                 section_row(t, '1:06–1:14', 'Recording · Enchufla · Basic', last=True)])
            + label(t, 'Links · 2', 10)
            + kit.youtube_card(t, 'Enchufla doble — Cuban style', 'youtube.com · 3:12', 'link')
            + kit.list_group(t, [plain])
            + kit.textarea(t, 'Add links', '', 'Paste YouTube or other links, one per line', rows=2)
            + kit.text_field(t, 'Title', '', 'For one link', optional=True)
            + kit.button(t, 'Add link', 'secondary', icon_name='plus', full=True))
    return scrolled(t, 'Enchufla', 'Doble', body, var_bar(t, 'Enchufla', 'Doble', 2, 3))


def enchufla_end(t):
    move = kit.row(t, 'Move Doble to…', 'A new figure of its own, or another figure', kit.chevron(t),
                   leading=f'<span style="width: 40px; height: 40px; border-radius: 20px; background: {t["chip"]}; display: flex; align-items: center; justify-content: center">{kit.icon("move-to", 22, t["ink2"])}</span>',
                   href='#', last=True)
    plain = kit.row(t, 'Rueda calls glossary', 'ruedadecasino.example', kit.icon_button(t, 'trash', 'Remove link', 'bare', color=t['muted'], on=t['surface']),
                    leading=f'<span style="width: 40px; height: 40px; border-radius: 20px; background: {t["chip"]}; display: flex; align-items: center; justify-content: center">{kit.icon("external", 20, t["ink2"])}</span>',
                    last=True)
    body = (kit.list_group(t, [plain])
            + kit.textarea(t, 'Add links', '', 'Paste YouTube or other links, one per line', rows=2)
            + kit.text_field(t, 'Title', '', 'For one link', optional=True)
            + kit.button(t, 'Add link', 'secondary', icon_name='plus', full=True)
            + label(t, 'Taught in · 2', 14)
            + kit.list_group(t, [dict(title='Cubana class', meta='Tuesday 13 October', trailing=kit.chevron(t), href='#'),
                                 dict(title='Turn pattern workshop', meta='Saturday 3 October', trailing=kit.chevron(t), href='#')])
            + f'<div style="height: 1px; background: {t["hairline"]}; margin: 18px 0 10px; flex: none"></div>'
            + kit.list_group(t, [move])
            + kit.button(t, 'Archive Doble', 'danger_text', icon_name='trash', full=True)
            + caption(t, 'Doble leaves Enchufla. Its recordings and practice history are kept.'))
    return scrolled(t, 'Enchufla', 'Doble', body, var_bar(t, 'Enchufla', 'Doble', 2, 3), pad='0 16px 112px', end=True)


def variations_sheet(t):
    rows = [dict(title='Basic', meta='Open two hands → Open two hands<br>Starts on 1 · 8 counts · 2 recordings', href='#'),
            dict(title='Doble', meta='Open two hands → Hammerlock<br>Starts on 1 · 16 counts · 1 recording', href='#', state='selected'),
            dict(title='Por arriba', meta='Cross-hand → Open two hands<br>Starts on 5 · 8 counts · no recordings', href='#')]
    sh = kit.bottom_sheet(t, 'Variations of Enchufla', kit.list_group(t, rows, 'Variations'),
                          footer=kit.button(t, 'New variation', 'secondary', icon_name='plus', full=True, on=t['sheet_bg']))
    return enchufla_top(t, sh)


def new_variation(t):
    inner = (kit.text_field(t, 'Name', 'Doble', 'e.g. Doble, From cross', 'error', error='Enchufla already has a variation called Doble. Rename one first.')
             + f'<p style="margin: 0; padding: 0 4px; font-size: 14px; line-height: 1.45; color: {t["muted"]}">It starts as a copy of Doble — handholds, timing and notes, '
               f'not its recordings. Change them with Edit.</p>')
    sh = kit.bottom_sheet(t, 'New variation', inner, back=True, sub='of Enchufla',
                          footer=kit.button(t, 'Add variation', 'primary', icon_name='plus', full=True, on=t['sheet_bg']))
    return enchufla_top(t, sh)


def field_label(t, text):
    return f'<span style="{kit.ts("label", t["ink2"])}; padding-left: 4px">{text}</span>'


def save_footer(t, state='default'):
    return (f'<div style="position: absolute; left: 0; right: 0; bottom: 0; padding: 12px 16px 30px; background: {t["tab_bg"]}; border-top: 1px solid {t["tab_line"]}">'
            f'{kit.button(t, "Save", "primary", state, icon_name="check", full=True, on=t["tab_bg"])}</div>')


SP = '<div style="height: 6px; flex: none"></div>'


def edit_top(t):
    body = (kit.text_field(t, 'Figure name', 'Enchufla', state='filled', helper='Shared by its 3 variations')
            + SP + kit.text_field(t, 'Variation name', 'Doble', 'e.g. Basic, Doble, From cross', 'focused') + SP
            + f'<div style="display: flex; flex-direction: column; gap: 6px; flex: none">{field_label(t, "Danced")}'
              f'{kit.segmented(t, ["With partner", "Solo"], 0, on_band=False, label="Danced")}</div>' + SP
            + f'<div style="display: flex; flex-direction: column; gap: 2px; flex: none">{field_label(t, "Style")}'
              f'{kit.chips(t, ["Salsa", "Son", "Other"], 0, label="Style", scroll=False)}</div>'
            + kit.textarea(t, 'Notes', DOBLE_NOTES, 'Count, hand holds, what the teacher said…', 'filled', rows=4))
    return kit.page(t, head(t, 'Enchufla', 'Doble', editing=True), body, pad='22px 16px 0', footer=save_footer(t))


def pos_chip(t, name):
    return (f'<button type="button" aria-label="Remove {name}" style="height: 44px; {kit.BTN}; flex: none">'
            f'<span style="height: 34px; padding: 0 8px 0 14px; border-radius: 17px; background: {t["accent_soft"]}; color: {t["accent_text"]}; '
            f'font-size: 14px; font-weight: 700; display: flex; align-items: center; gap: 4px">{name}{kit.icon("close", 16, t["accent_text"], stroke=2.5)}</span></button>')


def count_grid(t, start):
    cells = ''
    for c in range(1, 9):
        on = c == start
        bg = t['accent'] if on else t['surface']
        fg = t['on_accent'] if on else t['ink']
        bd = '' if on else f'box-shadow: inset 0 0 0 1px {t["field_line"]};'
        cells += (f'<button type="button" role="radio" aria-checked="{"true" if on else "false"}" style="flex: 1; height: 44px; border: 0; border-radius: 12px; '
                  f'background: {bg}; color: {fg}; {bd} font-size: 16px; font-weight: 800; cursor: pointer; padding: 0">{c}</button>')
    return (f'<div role="radiogroup" aria-label="Starts on" style="display: flex; flex-direction: column; gap: 6px; flex: none">{field_label(t, "Starts on")}'
            f'<div style="display: flex; gap: 4px">{cells}</div></div>')


def edit_timing(t):
    starts = (f'<div style="display: flex; flex-direction: column; gap: 4px; flex: none">{field_label(t, "Starts from")}'
              f'<div style="display: flex; gap: 6px; flex-wrap: wrap">{pos_chip(t, "Open two hands")}{pos_chip(t, "Cross-hand")}</div>'
              f'{kit.select_field(t, "Add a start position", "", "Choose a position…", "empty")}</div>')
    counts = (kit.text_field(t, 'Counts', '70', state='error', error='1 to 64 counts. One 8-count is 8.', inputmode='numeric', suffix='counts')
              + f'<div style="margin-top: -4px">{kit.chips(t, ["4", "8", "16"], set(), label="Length shortcuts", scroll=False)}</div>')
    body = (starts
            + SP + kit.select_field(t, 'Ends at', 'Hammerlock') + SP
            + count_grid(t, 1) + SP
            + counts + SP
            + kit.banner(t, 'error', 'Not saved', 'A variation starts on a count from 1 to 8 and takes 1 to 64 counts.'))
    return scrolled(t, 'Enchufla', 'Editing Doble', body, save_footer(t), left=kit.band_button(t, 'close', 'Stop editing'), right='',
                    pad='14px 16px 0')


def edit_delete(t):
    body = (label(t, 'Recordings · 2', 0)
            + recording(t, 'Wednesday 28 October', '34 MB', '0:41', 0,
                        [('Second turn', '0:12–0:19 · Linked to Hammerlock · Basic'), ('0:24–0:31', 'Not linked')], editing=True)
            + label(t, 'Sections · 2', 8)
            + kit.list_group(t, [section_row(t, 'Doble, slow', 'Cubana class · 13 Oct · 0:42–0:55',
                                             trailing=kit.button(t, 'Unlink', 'tertiary', size='sm', on=t['surface']), last=True)]))
    dlg = kit.dialog(t, 'Delete this recording?',
                     'Wednesday 28 October · 34 MB. Its 2 saved sections go with it. This can’t be undone.',
                     [kit.button(t, 'Cancel', 'tertiary', size='sm', on=t['raised']),
                      kit.button(t, 'Delete', 'danger', size='sm', on=t['raised'])], 'trash', 'danger')
    return scrolled(t, 'Enchufla', 'Editing Doble', body, save_footer(t), dlg, left=kit.band_button(t, 'close', 'Stop editing'), right='')


def upload_card(t, pct):
    return kit.card(t, f'<div style="display: flex; align-items: center; gap: 12px">'
                    f'<span style="width: 40px; height: 40px; border-radius: 20px; background: {t["accent_soft"]}; display: flex; align-items: center; justify-content: center; flex: none">'
                    f'{kit.icon("upload", 22, t["accent_text"])}</span>'
                    f'<div style="flex: 1; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 16px; font-weight: 700">Uploading… {pct}%</span>'
                    f'<span style="font-size: 13px; color: {t["muted"]}">You can keep using the app; closing the tab stops it</span></div></div>'
                    + kit.progress_bar(t, pct), gap=12)


def uploading(t):
    body = (two_lists(t, ['Dile que no · Basic', 'Setenta · Basic'], ['Hammerlock · Basic', 'Sombrero · Basic'])
            + label(t, 'Recordings · 1', 10)
            + recording(t, 'Wednesday 28 October', '34 MB', '0:41', 0)
            + f'<div role="status" style="flex: none">{upload_card(t, 42)}</div>')
    return scrolled(t, 'Enchufla', 'Doble', body, var_bar(t, 'Enchufla', 'Doble', 2, 3))


def problem_card(t, title, body, meta, action=''):
    return (f'<div style="background: {t["surface"]}; border-radius: 16px; padding: 14px 8px 8px 16px; display: flex; flex-direction: column; gap: 6px; flex: none">'
            f'<div style="display: flex; gap: 12px; align-items: flex-start; padding-right: 8px">'
            f'<span style="width: 40px; height: 40px; border-radius: 20px; background: {t["chip"]}; display: flex; align-items: center; justify-content: center; flex: none">'
            f'{kit.icon("video", 22, t["muted"])}</span>'
            f'<div style="flex: 1; display: flex; flex-direction: column; gap: 3px; padding-top: 1px"><span style="font-size: 16px; font-weight: 700">{title}</span>'
            f'<span style="font-size: 14px; line-height: 1.4; color: {t["ink2"]}">{body}</span></div></div>'
            f'<div style="display: flex; align-items: center; justify-content: space-between; padding-left: 52px; min-height: 44px">'
            f'<span style="font-size: 13px; color: {t["muted"]}">{meta}</span>{action}</div></div>')


def app_recordings(t):
    body = (label(t, 'Recordings · 2', 0)
            + problem_card(t, 'This file is missing', 'The server has no file for this recording.', 'Sunday 4 October · 12 MB')
            + problem_card(t, 'Can’t play here', 'This browser can’t play this file. Download it or open it on your phone.',
                           'Friday 2 October · 48 MB', kit.button(t, 'Download', 'tertiary', icon_name='download', size='sm', on=t['surface']))
            + f'<div style="height: 4px; flex: none"></div>'
            + kit.button(t, 'Add video', 'secondary', icon_name='video', full=True)
            + caption(t, 'Compressed and uploaded in the background')
            + kit.button(t, 'Add audio', 'secondary', icon_name='mic', full=True)
            + kit.banner(t, 'error', 'Only audio files can be added.', 'Pick a video with Add video instead.'))
    return scrolled(t, 'Hammerlock', 'Basic', body, var_bar(t, 'Hammerlock', 'Basic', 1, 2))


def cuddle_top(t, overlay=''):
    practise = kit.button(t, 'Practise on its own', 'secondary', size='sm', on=t['surface'])
    body = (summary(t, [kit.badge(t, 'Sensual', 'accent'), kit.badge(t, 'With partner', 'neutral', icon_name='people')],
                    1, 8, 'Open hold', 'Open hold')
            + label(t, 'Practice')
            + kit.list_group(t, [dict(title='Via routines', meta='No exercise of its own', trailing=practise)])
            + label(t, 'In routines')
            + kit.card(t, f'<span style="font-size: 15px; font-weight: 700; color: {t["status"]}">Not in a routine yet</span>', pad='14px 16px')
            + label(t, 'Recordings')
            + kit.card(t, f'<div style="display: flex; align-items: center; gap: 12px">'
                       f'<span style="width: 44px; height: 44px; border-radius: 22px; background: {t["accent_soft"]}; display: flex; align-items: center; justify-content: center; flex: none">'
                       f'{kit.icon("video", 22, t["accent_text"])}</span>'
                       f'<span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 16px; font-weight: 700">No recordings yet</span>'
                       f'<span style="font-size: 13px; color: {t["muted"]}">Film it after class, or add a voice note</span></span></div>'
                       + kit.button(t, "Add video or audio", "primary", icon_name="upload", size="sm", full=True, on=t["surface"]), gap=12)
            + label(t, 'Sections')
            + kit.card(t, f'<span style="font-size: 14px; color: {t["muted"]}">Point at the part of a lesson video that shows this.</span>', pad='14px 16px'))
    return kit.page(t, head(t, 'Cuddle turn', 'Basic'), body, pad='18px 16px 0', footer=var_bar(t, 'Cuddle turn', 'Basic', 1, 1), overlay=overlay)


def move_clash(t):
    inner = (kit.card(t, kit.radio(t, 'A new figure of its own', False, meta='Doble becomes its first variation'), pad='6px 16px')
             + kit.section_label(t, 'Or join a figure', 6)
             + kit.select_field(t, 'Figure', 'Dile que no')
             + kit.text_field(t, 'Name in Dile que no', 'Doble', state='error', error='Dile que no already has a Doble. Pick another name.'))
    sh = kit.bottom_sheet(t, 'Move “Doble” to…', inner,
                          footer=kit.button(t, 'Move to Dile que no', 'primary', 'disabled', full=True, on=t['sheet_bg']))
    return enchufla_top(t, sh)


def move_last(t):
    inner = (kit.card(t, kit.radio(t, 'A new figure of its own', False, meta='Basic becomes its first variation'), pad='6px 16px')
             + kit.section_label(t, 'Or join a figure', 6)
             + kit.select_field(t, 'Figure', 'Hammerlock')
             + kit.text_field(t, 'Name in Hammerlock', 'Cuddle entry', state='filled')
             + kit.banner(t, 'error', 'Cuddle turn will be removed',
                          'Basic is its last variation, and a figure with no variations is gone. It leaves the figures list.'))
    sh = kit.bottom_sheet(t, 'Move “Basic” to…', inner,
                          footer=kit.button(t, 'Move and remove figure', 'danger', full=True, on=t['sheet_bg']))
    return cuddle_top(t, sh)


def setenta_top(t, overlay=''):
    body = (summary(t, [kit.badge(t, 'Salsa', 'accent'), kit.badge(t, 'With partner', 'neutral', icon_name='people')],
                    1, 16, 'Open two hands', 'Open two hands', 'Turn her twice under the arm, then step back on 5.')
            + label(t, 'Practice')
            + kit.list_group(t, [dict(title='Every week', meta='Done today', meta_tone='done', trailing=kit.log_button(t, 'Setenta · Basic')),
                                 dict(title='Its exercise', meta='History, how often, active', trailing=kit.chevron(t), href='#')]))
    return kit.page(t, head(t, 'Setenta', 'Basic'), body, pad='18px 16px 0', footer=var_bar(t, 'Setenta', 'Basic', 1, 1), overlay=overlay)


def archive_last(t):
    inner = kit.banner(t, 'error', 'Setenta will be removed',
                       'Basic is its last variation, and a figure with no variations is gone. It leaves the figures list. '
                       'Its recordings and practice history are kept.')
    foot = (f'<div style="display: flex; gap: 8px">'
            f'<div style="flex: 1; display: flex">{kit.button(t, "Cancel", "secondary", full=True, on=t["sheet_bg"])}</div>'
            f'<div style="flex: 2; display: flex">{kit.button(t, "Archive and remove figure", "danger", full=True, on=t["sheet_bg"]).replace("padding: 0 24px", "padding: 0 12px")}</div></div>')
    sh = kit.bottom_sheet(t, 'Archive Basic?', inner, footer=foot)
    return setenta_top(t, sh)


SCREENS = [
    ('A variation', 'Compact band (figure over variation), facts with the 8-count timing strip, Practice, routines; switcher pinned at the bottom', enchufla_top, 'salsa'),
    ('Scrolled · recordings', 'Slim band once scrolled. Follows from / Leads to; a recording with its own sections; Add video or audio', enchufla_recordings, 'salsa'),
    ('Scrolled · sections and links', 'Linked sections loop on tap; Link a section; YouTube link with Save video; add links', enchufla_sections, 'salsa'),
    ('End of the page', 'Taught in, then Move Doble to… and Archive, out of the way', enchufla_end, 'salsa'),
    ('Variation switcher', 'The bar’s middle opens Variations of Enchufla; New variation at the bottom', variations_sheet, 'salsa'),
    ('Add variation · name taken', 'The name sheet (Back to the list) with the server’s refusal on the field', new_variation, 'salsa'),
    ('Edit · field focused', 'Edit swaps the page for the form; X stops editing (asks if unsaved), Save pinned', edit_top, 'salsa'),
    ('Edit · timing refused', 'Start positions as removable chips, Ends at, Starts on 1–8, Counts with the error', edit_timing, 'salsa'),
    ('Edit · delete a recording', 'Delete and Unlink appear only while editing; a dialog replaces confirm()', edit_delete, 'salsa'),
    ('Upload in progress', 'The add button becomes a progress card until the file lands', uploading, 'salsa'),
    ('In the app · problems', 'Missing and unplayable recordings; app hands video to Android; an upload refused', app_recordings, 'bachata'),
    ('One variation, nothing yet', 'No exercise, no routine, no recordings; the switcher still offers New variation', cuddle_top, 'bachata'),
    ('Move to… · name clash', 'Join a figure: Name in Dile que no is checked live; Move stays disabled', move_clash, 'salsa'),
    ('Move to… · last variation', 'Moving the only variation removes the figure: red warning and red button', move_last, 'bachata'),
    ('Archive · last variation', 'Archive asks in a sheet; the last variation takes its figure with it', archive_last, 'salsa'),
]


if __name__ == '__main__':
    html, w, h = kit.artboard('A figure', 'One variation’s page, its switcher, editing, recordings, Move to… and Archive — light and dark.',
                              SCREENS, doc_title='S · A figure')
    out = os.path.join(SCR, 'canvas', 'project', 'S-figure.dc.html')
    kit.write(out, html)
    print(w, h)
