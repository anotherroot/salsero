"""The positions map, three ways. Every layout here is computed, not hand-placed: the app can run the same maths
(a small force simulation, or BFS rings, or a circle by type) on a person's own positions in a few milliseconds.

render(t, layout, w, h, sel=None) -> an inline SVG.
"""
import math

# name -> type
POS = {
    'Abierta (dos manos)': 'Salsa', 'Abierta (una mano)': 'Salsa', 'Cerrada': 'Salsa', 'Setenta, derecha': 'Salsa',
    'Sombrero': 'Salsa', 'Candado': 'Salsa', 'Abrazo': 'Salsa',
    'Manos cruzadas': 'Son', 'Paseo': 'Son',
    'Caída': 'Timba', 'Pegao': 'Timba', 'Sombra': 'Timba',
    'Espalda con espalda': 'Other', 'Rueda: círculo': 'Other', 'Rueda: centro': 'Other',
}
A2, A1, CER, SET, SOM, HAM, CUD = 'Abierta (dos manos)', 'Abierta (una mano)', 'Cerrada', 'Setenta, derecha', 'Sombrero', 'Candado', 'Abrazo'
MAN, PAS, CAI, PEG, SOMB, ESP, RC, RCE = 'Manos cruzadas', 'Paseo', 'Caída', 'Pegao', 'Sombra', 'Espalda con espalda', 'Rueda: círculo', 'Rueda: centro'
# (from, to, how many figures)
EDGES = [(A2, CER, 4), (CER, A2, 5), (A2, A1, 3), (A1, A2, 3), (A2, MAN, 3), (MAN, A2, 2), (MAN, SET, 1), (SET, A2, 3),
         (A2, SOM, 2), (SOM, A2, 2), (CER, CAI, 2), (ESP, A2, 1), (A1, HAM, 2), (HAM, A1, 2), (HAM, CUD, 1), (CUD, A2, 1),
         (MAN, PAS, 1), (PAS, CER, 1), (CER, PEG, 1), (PEG, CER, 1), (RC, RCE, 2), (RCE, RC, 1)]
NONE_FIGS = 10


def palette(t):
    dark = t['ground'].lower() in ('#0b0b0d',)
    return {'Salsa': t['accent'], 'Son': '#5cc8c0' if dark else '#17807a', 'Timba': '#b39af5' if dark else '#6d45c9',
            'Other': '#9b99a3' if dark else '#6a6872'}


def status():
    """dead end / orphan / unused / island, from the edges alone."""
    ins = {n: 0 for n in POS}
    outs = {n: 0 for n in POS}
    adj = {n: set() for n in POS}
    for a, b, k in EDGES:
        outs[a] += k
        ins[b] += k
        adj[a].add(b)
        adj[b].add(a)
    # connected parts (ignoring direction); the biggest is "the rest"
    seen, parts = set(), []
    for n in POS:
        if n in seen or not adj[n]:
            continue
        stack, part = [n], set()
        while stack:
            x = stack.pop()
            if x in part:
                continue
            part.add(x)
            stack.extend(adj[x] - part)
        seen |= part
        parts.append(part)
    main = max(parts, key=len)
    st = {}
    for n in POS:
        if not adj[n]:
            st[n] = 'unused'
        elif n not in main:
            st[n] = 'island'
        elif ins[n] and not outs[n]:
            st[n] = 'dead'
        elif outs[n] and not ins[n]:
            st[n] = 'orphan'
        else:
            st[n] = ''
    return st, ins, outs, main


def radius(n, ins, outs):
    return 13 + 2.6 * math.sqrt(ins[n] + outs[n])


# --------------------------------------------------------------------------
# layouts (each gets the main part only; islands and unused go in the tray)
# --------------------------------------------------------------------------

def _separate(pos, r, w, h, mx, my, gap=34, rounds=200):
    """Push overlapping circles (and their labels) apart, then keep them in the box. Cheap: n² per round, n is small."""
    names = list(pos)
    for _ in range(rounds):
        moved = False
        for i, a in enumerate(names):
            for b in names[i + 1:]:
                dx, dy = pos[b][0] - pos[a][0], pos[b][1] - pos[a][1]
                d = max(math.hypot(dx, dy), 0.01)
                need = r[a] + r[b] + gap
                if d < need:
                    push = (need - d) / 2
                    ux, uy = dx / d, dy / d
                    pos[a] = [pos[a][0] - ux * push, pos[a][1] - uy * push * 0.7]
                    pos[b] = [pos[b][0] + ux * push, pos[b][1] + uy * push * 0.7]
                    moved = True
        for m in names:
            pos[m] = [min(max(pos[m][0], mx), w - mx), min(max(pos[m][1], my), h - my - 18)]
        if not moved:
            break
    return {m: tuple(p) for m, p in pos.items()}


def layout_force(w, h, nodes, r):
    """Fruchterman–Reingold, deterministic: start on a circle in name order, 400 steps, cooling. Undirected, weighted.
    Then a separation pass so no two positions or labels overlap."""
    names = sorted(nodes)
    n = len(names)
    cx, cy = w / 2, h / 2
    pos = {m: [cx + 0.3 * w * math.cos(2 * math.pi * i / n), cy + 0.3 * h * math.sin(2 * math.pi * i / n)] for i, m in enumerate(names)}
    k = 0.75 * math.sqrt(w * h / n)
    wts = {}
    for a, b, c in EDGES:
        if a in nodes and b in nodes:
            key = tuple(sorted((a, b)))
            wts[key] = wts.get(key, 0) + c
    temp = w / 10
    for _ in range(400):
        disp = {m: [0.0, 0.0] for m in names}
        for i, a in enumerate(names):
            for b in names[i + 1:]:
                dx, dy = pos[a][0] - pos[b][0], pos[a][1] - pos[b][1]
                d = max(math.hypot(dx, dy), 0.01)
                f = k * k / d
                disp[a][0] += dx / d * f
                disp[a][1] += dy / d * f
                disp[b][0] -= dx / d * f
                disp[b][1] -= dy / d * f
        for (a, b), c in wts.items():
            dx, dy = pos[a][0] - pos[b][0], pos[a][1] - pos[b][1]
            d = max(math.hypot(dx, dy), 0.01)
            f = d * d / k * (0.5 + 0.1 * c)
            disp[a][0] -= dx / d * f
            disp[a][1] -= dy / d * f
            disp[b][0] += dx / d * f
            disp[b][1] += dy / d * f
        for m in names:
            disp[m][0] += (cx - pos[m][0]) * 0.05
            disp[m][1] += (cy - pos[m][1]) * 0.08
            dx, dy = disp[m]
            d = max(math.hypot(dx, dy), 0.01)
            pos[m][0] += dx / d * min(d, temp)
            pos[m][1] += dy / d * min(d, temp)
        temp *= 0.985
    xs, ys = [p[0] for p in pos.values()], [p[1] for p in pos.values()]
    mx, my = 100, 46
    sx = (w - 2 * mx) / max(max(xs) - min(xs), 1)
    sy = (h - 2 * my - 20) / max(max(ys) - min(ys), 1)
    pos = {m: [mx + (p[0] - min(xs)) * sx, my + (p[1] - min(ys)) * sy] for m, p in pos.items()}
    return _separate(pos, r, w, h, 90, 40)


def layout_rings(w, h, nodes, hub, r):
    """Oval rings by distance from your most-used position (BFS either direction). A ring keeps its nodes in the order
    of their parents' angles and spaces them evenly, so branches stay together."""
    adj = {n: set() for n in nodes}
    for a, b, _ in EDGES:
        if a in nodes and b in nodes:
            adj[a].add(b)
            adj[b].add(a)
    dist, parent, order = {hub: 0}, {hub: None}, [hub]
    for x in order:
        for y in sorted(adj[x]):
            if y not in dist:
                dist[y], parent[y] = dist[x] + 1, x
                order.append(y)
    maxd = max(dist.values())
    cx, cy = w / 2, h / 2 - 6
    sx_, sy_ = (w / 2 - 110) / maxd, (h / 2 - 50) / maxd
    pos, ang = {hub: (cx, cy)}, {hub: -math.pi / 2}
    for d in range(1, maxd + 1):
        ring = [n for n in order if dist[n] == d]
        if d == 1:
            targets = {n: -math.pi / 2 + 2 * math.pi * i / len(ring) for i, n in enumerate(ring)}
        else:
            targets = {n: ang[parent[n]] for n in ring}
        ring.sort(key=lambda n: targets[n] % (2 * math.pi))
        base = sum((targets[n] - 2 * math.pi * i / len(ring)) for i, n in enumerate(ring)) / len(ring) if d > 1 else 0
        for i, n in enumerate(ring):
            ang[n] = (targets[n] if d == 1 else base + 2 * math.pi * i / len(ring))
            f = maxd * (d / maxd) ** 0.6
            pos[n] = (cx + sx_ * f * math.cos(ang[n]), cy + sy_ * f * math.sin(ang[n]))
    pos = _separate({k_: list(v) for k_, v in pos.items()}, r, w, h, 90, 36, gap=30)
    return pos, (cx, cy, sx_, sy_, maxd)


def layout_circle(w, h, nodes):
    """One circle, grouped by type (then name). Nothing to simulate."""
    tord = ['Salsa', 'Son', 'Timba', 'Other']
    order = sorted(nodes, key=lambda n: (tord.index(POS[n]), n))
    cx, cy = w / 2, h / 2
    R = min(w, h) / 2 - 64
    gap = 0.22
    types = [POS[n] for n in order]
    nbreaks = sum(1 for i in range(1, len(order)) if types[i] != types[i - 1]) + 1
    unit = (2 * math.pi - nbreaks * gap) / len(order)
    pos, angs, a = {}, {}, -math.pi / 2 + gap / 2
    for i, n in enumerate(order):
        if i and types[i] != types[i - 1]:
            a += gap
        angs[n] = a + unit / 2
        pos[n] = (cx + R * math.cos(angs[n]), cy + R * math.sin(angs[n]))
        a += unit
    return pos, angs, R, order



# --------------------------------------------------------------------------
# drawing
# --------------------------------------------------------------------------

def _rgba(hex_, a):
    hex_ = hex_.lstrip('#')
    r, g, b = int(hex_[0:2], 16), int(hex_[2:4], 16), int(hex_[4:6], 16)
    return f'rgba({r},{g},{b},{a})'


def _edge(t, p, a, b, k, r, col, op, curve=0.18, center=None, uid='m'):
    (ax, ay), (bx, by) = p[a], p[b]
    dx, dy = bx - ax, by - ay
    L = max(math.hypot(dx, dy), 1)
    if center:  # bend toward the middle (circle layout)
        mx_, my_ = (ax + bx) / 2, (ay + by) / 2
        qx, qy = mx_ + (center[0] - mx_) * 0.55, my_ + (center[1] - my_) * 0.55
        # keep the two directions apart
        qx += -dy / L * 10
        qy += dx / L * 10
    else:
        qx, qy = (ax + bx) / 2 - dy * curve, (ay + by) / 2 + dx * curve
    # trim to the circles: step along the tangent at each end
    def trim(px, py, tx, ty, rr):
        vx, vy = tx - px, ty - py
        d = max(math.hypot(vx, vy), 1)
        return px + vx / d * rr, py + vy / d * rr
    sx, sy = trim(ax, ay, qx, qy, r[a] + 3)
    ex, ey = trim(bx, by, qx, qy, r[b] + 7)
    sw = 1.2 + 0.55 * k
    lab = ''
    if k > 1 and not center:
        lx, ly = 0.25 * sx + 0.5 * qx + 0.25 * ex, 0.25 * sy + 0.5 * qy + 0.25 * ey
        lab = (f'<text x="{lx:.1f}" y="{ly + 4:.1f}" text-anchor="middle" font-family="Manrope" font-size="11" font-weight="800" fill="{col}" '
               f'stroke="{t["ground"]}" stroke-width="4" paint-order="stroke" opacity="{min(1, op + 0.3):.2f}">{k}</text>')
    return (f'<path d="M{sx:.1f} {sy:.1f} Q{qx:.1f} {qy:.1f} {ex:.1f} {ey:.1f}" fill="none" stroke="{col}" stroke-opacity="{op:.2f}" '
            f'stroke-width="{sw:.1f}" stroke-linecap="round" marker-end="url(#{uid}-{"hot" if col != t["muted"] else "dim"})"/>' + lab)


def _node(t, x, y, n, rr, st, typecol, sel, dim, labels='below', label_pos=None):
    ink, ground, danger = t['ink'], t['ground'], t['danger']
    op = 0.28 if dim else 1
    on = n == sel
    fill = typecol if on else _rgba(typecol, 0.16)
    out = f'<g opacity="{op}">'
    if on:
        out += f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{rr + 9:.1f}" fill="{_rgba(typecol, 0.18)}"/>'
    if st in ('dead', 'orphan'):
        out += (f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{rr + 5:.1f}" fill="none" stroke="{danger}" stroke-width="2"'
                f'{" stroke-dasharray=\"4 4\"" if st == "orphan" else ""}/>')
    if st == 'island':
        out += f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{rr + 5:.1f}" fill="none" stroke="{t["warn"]}" stroke-width="2" stroke-dasharray="2 4" stroke-linecap="round"/>'
    out += f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{rr:.1f}" fill="{fill}" stroke="{typecol}" stroke-width="2.2"/>'
    lx, ly, anchor = (x, y + rr + 18, 'middle') if label_pos is None else label_pos
    out += (f'<text x="{lx:.1f}" y="{ly:.1f}" text-anchor="{anchor}" font-family="Manrope" font-size="13.5" font-weight="800" fill="{ink}" '
            f'stroke="{ground}" stroke-width="5" stroke-linejoin="round" paint-order="stroke">{n}</text>')
    tag = {'dead': ('dead end', danger), 'orphan': ('orphan', danger), 'island': ('island', t['warn'])}.get(st)
    if tag:
        out += (f'<text x="{lx:.1f}" y="{ly + 15:.1f}" text-anchor="{anchor}" font-family="Manrope" font-size="11" font-weight="800" fill="{tag[1]}" '
                f'stroke="{ground}" stroke-width="4" paint-order="stroke" letter-spacing="0.04em">{tag[0].upper()}</text>')
    return out + '</g>'


def _defs(t, uid, hot):
    def m(name, col):
        return (f'<marker id="{uid}-{name}" viewBox="0 0 10 10" refX="7" refY="5" markerUnits="userSpaceOnUse" markerWidth="10" markerHeight="10" '
                f'orient="auto-start-reverse"><path d="M1 1 L9 5 L1 9 z" fill="{col}"/></marker>')
    return f'<defs>{m("dim", t["muted"])}{m("hot", hot)}</defs>'


def _chip(t, x, y, text, col, dash):
    tw = len(text) * 7.1 + 28
    return (f'<rect x="{x:.0f}" y="{y}" width="{tw:.0f}" height="26" rx="13" fill="none" stroke="{col}" stroke-width="1.6"'
            f'{" stroke-dasharray=\"4 3\"" if dash else ""}/>'
            f'<text x="{x + tw / 2:.0f}" y="{y + 17}" text-anchor="middle" font-family="Manrope" font-size="12.5" font-weight="800" fill="{t["ink2"]}">{text}</text>'), tw


def _tray(t, y, w, islands, r, pal, st, sel, uid):
    """Under the map: what is not on it (no position, unused), and the islands as a small map of their own."""
    th = 112
    out = f'<rect x="0" y="{y}" width="{w}" height="{th}" rx="20" fill="{t["surface"]}" stroke="{t["hairline"]}"/>'
    out += (f'<text x="20" y="{y + 26}" font-family="Manrope" font-size="11" font-weight="800" fill="{t["muted"]}" letter-spacing="0.06em">NOT ON THE MAP</text>')
    cx = 20
    for text, col, dash in [(f'No position · {NONE_FIGS} figures', t['field_line'], True)] + [(f'{n} · no figures', t['danger'], False) for n in POS if st[n] == 'unused']:
        c, tw = _chip(t, cx, y + 40, text, col, dash)
        out += c
        cx += tw + 8
    out += (f'<text x="20" y="{y + 92}" font-family="Manrope" font-size="12" font-weight="600" fill="{t["muted"]}">Figures without a position fit anywhere.</text>')
    if islands:
        x0 = w * 0.56
        out += f'<line x1="{x0 - 20:.0f}" y1="{y + 16}" x2="{x0 - 20:.0f}" y2="{y + th - 16}" stroke="{t["hairline"]}"/>'
        out += (f'<text x="{x0:.0f}" y="{y + 26}" font-family="Manrope" font-size="11" font-weight="800" fill="{t["warn"]}" letter-spacing="0.06em">'
                f'ISLANDS · CUT OFF FROM THE REST</text>')
        p = {n: (x0 + 36 + i * 150, y + 62) for i, n in enumerate(islands)}
        rr = {n: 15 for n in islands}
        for a, b, k in EDGES:
            if a in p and b in p:
                out += _edge(t, p, a, b, k, rr, t['muted'], 0.6, curve=0.22, uid=uid)
        for n in islands:
            out += _node(t, p[n][0], p[n][1], n, 15, '', pal[POS[n]], sel, False, label_pos=(p[n][0] + 22, p[n][1] + 5, 'start'))
    return out


def render(t, layout='rings', w=780, h=620, sel=None, uid='m', compact=False):
    st, ins, outs, main = status()
    pal = palette(t)
    drawn = [n for n in POS if n in main]
    islands = [n for n in POS if st[n] == 'island']
    r = {n: radius(n, ins, outs) * (0.8 if compact else 1) for n in POS}
    hot = pal[POS[sel]] if sel else t['accent']
    tray_h = 0 if compact else 112
    gh = h - tray_h - (14 if tray_h else 0)
    bg, center, label_pos = '', None, {}
    if layout == 'force':
        p = layout_force(w, gh, set(drawn), r)
    elif layout == 'rings':
        p, (cx, cy, sx_, sy_, maxd) = layout_rings(w, gh, set(drawn), A2, r)
        for d in range(maxd, 0, -1):
            f_ = maxd * (d / maxd) ** 0.6
            bg += (f'<ellipse cx="{cx:.1f}" cy="{cy:.1f}" rx="{sx_ * f_:.1f}" ry="{sy_ * f_:.1f}" fill="{_rgba(t["accent"], 0.035 * (maxd - d + 1))}" '
                   f'stroke="{t["hairline"]}" stroke-width="1.5"/>')
        for d in range(1, maxd + 1):
            f_ = maxd * (d / maxd) ** 0.6
            bg += (f'<text x="{cx:.1f}" y="{cy - sy_ * f_ + 14:.1f}" text-anchor="middle" font-family="Manrope" font-size="11" font-weight="800" '
                   f'fill="{t["muted"]}" letter-spacing="0.04em" opacity="0.8">{d} FIGURE{"S" if d > 1 else ""} AWAY</text>')
    else:
        p, angs, R, order = layout_circle(w, gh, set(drawn))
        cx, cy = w / 2, gh / 2
        center = (cx, cy)
        by_type = {}
        for n in order:
            by_type.setdefault(POS[n], []).append(angs[n])
        for ty, aa in by_type.items():
            a0, a1 = min(aa) - 0.12, max(aa) + 0.12
            rr = R - 44
            x0, y0 = cx + rr * math.cos(a0), cy + rr * math.sin(a0)
            x1, y1 = cx + rr * math.cos(a1), cy + rr * math.sin(a1)
            large = 1 if a1 - a0 > math.pi else 0
            bg += (f'<path d="M{x0:.1f} {y0:.1f} A{rr} {rr} 0 {large} 1 {x1:.1f} {y1:.1f}" fill="none" stroke="{pal[ty]}" stroke-opacity="0.3" '
                   f'stroke-width="6" stroke-linecap="round"/>')
            am = (a0 + a1) / 2
            tx, ty_ = cx + (rr - 20) * math.cos(am), cy + (rr - 20) * math.sin(am)
            bg += (f'<text x="{tx:.1f}" y="{ty_ + 4:.1f}" text-anchor="middle" font-family="Manrope" font-size="11" font-weight="800" fill="{pal[ty]}" '
                   f'letter-spacing="0.08em">{ty.upper()}</text>')
        for n in order:
            a = angs[n]
            c_, s_ = math.cos(a), math.sin(a)
            lx, ly = cx + (R + r[n] + 9) * c_, cy + (R + r[n] + 9) * s_
            anchor = 'start' if c_ > 0.25 else ('end' if c_ < -0.25 else 'middle')
            label_pos[n] = (lx, ly + (5 if anchor != 'middle' else (16 if s_ > 0 else -4)), anchor)
    near = set()
    if sel:
        near = {sel} | {b for a, b, _ in EDGES if a == sel} | {a for a, b, _ in EDGES if b == sel}
    edges = ''
    for a, b, k in EDGES:
        if a not in p or b not in p:
            continue
        he = bool(sel) and sel in (a, b)
        edges += _edge(t, p, a, b, k, r, hot if he else t['muted'], 0.95 if he else (0.1 if sel else 0.45), center=center, uid=uid)
    nodes = ''
    for n in drawn:
        nodes += _node(t, p[n][0], p[n][1], n, r[n], st[n], pal[POS[n]], sel, bool(sel) and n not in near, label_pos=label_pos.get(n))
    tray = _tray(t, h - tray_h, w, islands, r, pal, st, sel, uid) if tray_h else ''
    return (f'<svg viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" aria-label="The map of your positions" '
            f'style="display: block; max-width: 100%; height: auto; flex: none">{_defs(t, uid, hot)}{bg}{edges}{nodes}{tray}</svg>')



def legend(t):
    pal = palette(t)
    sw = ''.join(f'<span style="display: inline-flex; align-items: center; gap: 6px"><span style="width: 12px; height: 12px; border-radius: 50%; '
                 f'background: {_rgba(c, 0.2)}; box-shadow: inset 0 0 0 2px {c}"></span>{ty}</span>' for ty, c in pal.items())

    def ring(text, col, dash):
        return (f'<span style="display: inline-flex; align-items: center; gap: 6px"><span style="width: 14px; height: 14px; border-radius: 50%; '
                f'border: 2px {dash} {col}; box-sizing: border-box"></span>{text}</span>')
    return (f'<div style="display: flex; gap: 8px 18px; flex-wrap: wrap; font-size: 13px; font-weight: 600; color: {t["muted"]}; flex: none">{sw}'
            f'{ring("dead end: nothing leaves", t["danger"], "solid")}{ring("orphan: nothing gets there", t["danger"], "dashed")}'
            f'{ring("island: cut off from the rest", t["warn"], "dotted")}<span>Bigger: more figures · arrows: how many</span></div>')
