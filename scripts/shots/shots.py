"""Screenshot rig, the Python side.

  shots.py shoot --db DB --base URL --out DIR --size WxH [--theme light|dark] --pages FILE [--group ID] [--viewport] [--no-session] [--unnamed]
  shots.py scene --db DB --base URL --out DIR --size WxH [--theme light|dark] [--group ID] [--viewport] --scenes NAMES|all
  shots.py diff DIR_A DIR_B

`shoot` fills the placeholders in the pages file from the db, inserts a session row,
and shoots every page. `diff` prints `<slug> <changed-pixels>` per page, exit 1 if any differ.
"""
import argparse
import hashlib
import importlib.util
import os
import re
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

DANCE = os.environ.get("SHOTS_DANCE", "salsa")
# The one instant every run pretends it is (server via libfaketime, browser via page clock), so time-relative
# content (due today, 2 days ago, yesterday) is the same whatever day a run happens. Kept in instant.txt (UTC),
# which shots.sh reads too.
INSTANT = datetime.strptime(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "instant.txt")).read().strip(), "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
# Elements marked data-shots-mask (a clock, say) are hidden so a page is stable.
# The rig also marks what depends on the machine, so no page source carries the attribute: the QR of /app
# encodes the dev server's random port; the admin's limits line ends in the disk's free space.
MASK_JS = """() => {
  document.querySelectorAll('svg[role=img][aria-label^="QR code"]').forEach(e => e.setAttribute('data-shots-mask', ''));
  document.querySelectorAll('p, div, span').forEach(e => {
    if (e.children.length === 0 && / GB free$/.test(e.textContent || '')) e.setAttribute('data-shots-mask', '');
  });
}"""
# While a page loads: is each link of the side (`[data-side]`, desktop) what a click at its centre hits?
# "live" if all are, else what covers the first that is not; "" when no side shows.
SIDE_JS = """() => {
  const links = [...document.querySelectorAll('[data-side] a')].filter(a => a.getClientRects().length);
  if (!links.length) return '';
  for (const a of links) {
    const r = a.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    if (!hit || !a.contains(hit)) return 'BLOCKED by ' + (hit ? hit.tagName.toLowerCase() + '.' + String(hit.className).slice(0, 60) : 'nothing');
  }
  return 'live';
}"""
STYLE = (
    "[data-shots-mask]{visibility:hidden!important}"
    "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}"
)


def _scenes_mod():
    # python3 -I has no script directory on sys.path: load scenes.py by path, once
    if "scenes" in sys.modules:
        return sys.modules["scenes"]
    spec = importlib.util.spec_from_file_location("scenes", os.path.join(os.path.dirname(os.path.abspath(__file__)), "scenes.py"))
    mod = importlib.util.module_from_spec(spec)
    sys.modules["scenes"] = mod
    spec.loader.exec_module(mod)
    return mod


def first(db, sql, args=()):
    row = db.execute(sql, args).fetchone()
    return row[0] if row else None


def placeholders(db):
    admin = first(db, "select id from users where is_admin = 1 order by created_at limit 1")
    if admin is None:
        sys.exit("shots: no admin user in the db")
    tz = first(db, "select timezone from users where id = ?", (admin,)) or "UTC"
    yesterday = (INSTANT.astimezone(ZoneInfo(tz)) - timedelta(days=1)).strftime("%Y-%m-%d")
    d = DANCE
    v = {
        "dance": d,
        "yesterday": yesterday,
        "figure": first(db, "select id from figures where user_id=? and dance=? and archived_at is null order by id limit 1", (admin, d)),
        "move": first(db, "select id from figure_groups where user_id=? and dance=? and archived_at is null order by id limit 1", (admin, d)),
        "song": first(db, "select id from songs where user_id=? and dance=? and archived_at is null order by (status='ready') desc, id limit 1", (admin, d)),
        "lesson": first(db, "select id from lessons where user_id=? and dance=? and archived_at is null order by id limit 1", (admin, d)),
        "routine": first(db, "select id from routines where user_id=? and dance=? and archived_at is null order by id limit 1", (admin, d)),
        "group": first(db, "select t.id from teams t join team_members m on m.team_id=t.id where m.user_id=? and t.dance=? and t.deleted_at is null order by t.id limit 1", (admin, d)),
        "position": first(db, "select id from positions where user_id=? and dance=? and archived_at is null order by id limit 1", (admin, d))
        or first(db, "select id from positions where dance=? and archived_at is null order by id limit 1", (d,)),
        "exercise": first(db, "select id from exercises where user_id=? and dance=? and archived_at is null order by id limit 1", (admin, d)),
        # a live group code the admin is not in, of either dance (/g/<code> asks Join?)
        "joincode": first(db, "select code from teams where deleted_at is null and id not in (select team_id from team_members where user_id=?) order by id limit 1", (admin,)),
        # the invite the rig inserts into the copy (shoot), so /join shows its form
        "invite": INVITE,
    }
    for fn in _scenes_mod().load_ext()[1]:
        for k, val in fn(db, admin, d).items():
            if k in v:
                sys.exit(f"shots: placeholder {k} is defined twice")
            v[k] = val
    return admin, v


INVITE = "shots-invite"


def slug(line):
    # from the template line, not the filled path: stable across days and across db copies
    s = re.sub(r"[^A-Za-z0-9]+", "_", line.replace("{dance}", DANCE)).strip("_")
    return s or "root"


def prepare(a):
    """Insert the session and the invite into the db copy (and unname the admin if asked); return the placeholders."""
    db = sqlite3.connect(a.db)
    admin, v = placeholders(db)
    now = max(int(time.time() * 1000), int(INSTANT.timestamp() * 1000))
    db.execute("delete from sessions where id = 'shots'")
    db.execute(
        "insert into sessions (id, user_id, expires_at, created_at) values ('shots', ?, ?, ?)",
        (admin, now + 86_400_000, now),
    )
    # an unused invite with a known code (only its sha256 is kept, src/lib/server/invites.ts)
    db.execute("delete from invites where id = 'shots'")
    db.execute(
        "insert into invites (id, code_hash, created_by, created_at, expires_at) values ('shots', ?, ?, ?, ?)",
        (hashlib.sha256(INVITE.encode()).hexdigest(), admin, now, now + 86_400_000),
    )
    if getattr(a, "unnamed", False):
        # a person made before names: every page sends them to /welcome
        db.execute("update users set first_name = null, last_name = null where id = ?", (admin,))
    db.commit()
    db.close()
    return v


def shoot(a):
    from playwright.sync_api import sync_playwright

    v = prepare(a)

    w, h = (int(x) for x in a.size.split("x"))
    lines = [l.strip() for l in open(a.pages) if l.strip() and not l.startswith("#")]
    os.makedirs(a.out, exist_ok=True)
    bad = 0
    wrote = 0
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(
            viewport={"width": w, "height": h},
            color_scheme=a.theme,
            device_scale_factor=1,
            timezone_id="Europe/Ljubljana",
        )
        ctx.clock.set_fixed_time(INSTANT)
        if not a.no_session:
            ctx.add_cookies([{"name": "salsa_session", "value": "shots", "url": a.base}])
        if a.group is not None:
            # group mode (src/lib/teams/mode.ts `groupCookie`): the admin must own or edit the group
            ctx.add_cookies([{"name": f"group_{DANCE}", "value": str(a.group), "url": a.base}])
        for entry in lines:
            # "<path> -> <path>": the page is expected to land elsewhere (signed out, say)
            line, _, lands = (x.strip() for x in entry.partition("->"))
            names = re.findall(r"\{(\w+)\}", line)
            missing = [n for n in names if v.get(n) is None]
            if missing:
                print(f"MISSING {line} (no {', '.join(missing)} in the db)")
                bad += 1
                continue
            path = re.sub(r"\{(\w+)\}", lambda m: str(v[m.group(1)]), line)
            page = ctx.new_page()
            try:
                if a.delay_from:
                    # a loading shot: open the start page, then follow a link to this page with its data delayed
                    start = re.sub(r"\{(\w+)\}", lambda m: str(v[m.group(1)]), a.delay_from)
                    page.goto(a.base + start, wait_until="networkidle", timeout=60000)
                    held = []
                    page.route("**/__data.json*", lambda r: held.append(r))  # held, never answered: the page stays loading
                    page.evaluate("p => { const l = document.createElement('a'); l.href = p; document.body.append(l); l.click(); }", path)
                    page.wait_for_timeout(1200)
                    page.add_style_tag(content=STYLE)
                    page.evaluate(MASK_JS)
                    png = os.path.join(a.out, slug(line) + ".png")
                    page.screenshot(path=png, full_page=not a.viewport)
                    wrote += 1
                    # the side (desktop) must stay live under the skeleton: what is at each side link's centre
                    side = page.evaluate(SIDE_JS)
                    for r in held:
                        r.abort()
                    blocked = side.startswith("BLOCKED")
                    bad += blocked
                    print(f"{'BAD' if blocked else 'ok '} loading {path}" + (f" SIDE {side}" if side else ""))
                    continue
                resp = page.goto(a.base + path, wait_until="networkidle", timeout=60000)
                page.add_style_tag(content=STYLE)
                page.evaluate(MASK_JS)
                page.wait_for_timeout(300)
                status = resp.status if resp else 0
                final = page.url.replace(a.base, "")
                png = os.path.join(a.out, slug(line) + ".png")
                page.screenshot(path=png, full_page=not a.viewport)
                wrote += 1
                expected_404 = "does-not-exist" in path
                want = (lands or path).split("?")[0]
                landed = final.split("?")[0]
                # Today on the desktop opens an exercise by itself: its URL replaces /{dance} (that line only)
                if line == "/{dance}" and w >= 1024 and re.fullmatch(rf"/{DANCE}/exercises/\d+", landed):
                    landed = want
                ok = (status == 404) if expected_404 else (status < 400 and landed == want)
                if not ok:
                    bad += 1
                over = page.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
                print(f"{'ok ' if ok else 'BAD'} {status} {path}" + (f" -> {final}" if final != path else "") + (f" OVERFLOW {over}px" if over > 0 else ""))
            except Exception as e:  # a page that cannot be shot is a failure, not a skip
                bad += 1
                print(f"BAD err {path}: {e}")
            finally:
                page.close()
        browser.close()
    if bad:
        print(f"shots: {bad} page(s) not ok", file=sys.stderr)
        return 1
    if wrote == 0 or wrote < len(lines):
        print(f"shots: wrote {wrote} PNG(s) for {len(lines)} page line(s)", file=sys.stderr)
        return 1
    return 0


def _wav_clips(tmp):
    """The count clips are AAC (.m4a), which Playwright's Chromium cannot decode: convert them once to WAV and
    serve those in their place (the rig only; the app is untouched). Returns {name.m4a: wav bytes}."""
    clips = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "static", "clips")
    ffmpeg = [shutil.which("ffmpeg")] if shutil.which("ffmpeg") else ["nix", "run", "nixpkgs#ffmpeg", "--"]
    out = {}
    try:
        for f in sorted(os.listdir(clips)):
            if not f.endswith(".m4a"):
                continue
            wav = os.path.join(tmp, f[:-4] + ".wav")
            subprocess.run(ffmpeg + ["-v", "error", "-y", "-i", os.path.join(clips, f), wav], check=True, timeout=120)
            with open(wav, "rb") as fh:
                out[f] = fh.read()
    except (OSError, subprocess.SubprocessError) as e:
        print(f"shots: warning: no WAV clips ({e}); scenes that play will fail to start", file=sys.stderr)
        return {}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return out


def scene(a):
    from playwright.sync_api import sync_playwright

    v = prepare(a)
    all_scenes, _ = _scenes_mod().load_ext()
    w, h = (int(x) for x in a.size.split("x"))
    if a.scenes == "all":
        names = [n for n, sc in all_scenes.items() if not (sc.desk and w < 1024)]
    else:
        names = [n.strip() for n in a.scenes.split(",") if n.strip()]
        unknown = [n for n in names if n not in all_scenes]
        if unknown:
            print(f"shots: unknown scene(s): {', '.join(unknown)}", file=sys.stderr)
            return 1
    os.makedirs(a.out, exist_ok=True)
    bad = 0
    clipdir = tempfile.mkdtemp(prefix="shots-clips-")
    with sync_playwright() as p:
        browser = p.chromium.launch(args=[
            "--use-fake-device-for-media-stream",
            "--use-fake-ui-for-media-stream",
            "--autoplay-policy=no-user-gesture-required",
        ])
        ctx = browser.new_context(
            viewport={"width": w, "height": h},
            color_scheme=a.theme,
            device_scale_factor=1,
            timezone_id="Europe/Ljubljana",
            permissions=["microphone"],
        )
        ctx.clock.set_fixed_time(INSTANT)
        ctx.add_cookies([{"name": "salsa_session", "value": "shots", "url": a.base}])
        if a.group is not None:
            ctx.add_cookies([{"name": f"group_{DANCE}", "value": str(a.group), "url": a.base}])
        wavs = _wav_clips(clipdir)
        ctx.route(re.compile(r"/clips/[^/]+\.m4a$"), lambda r: r.fulfill(
            body=wavs[r.request.url.rsplit("/", 1)[1]], content_type="audio/wav") if r.request.url.rsplit("/", 1)[1] in wavs else r.continue_())
        for name in names:
            sc = all_scenes[name]
            missing = [n for n in re.findall(r"\{(\w+)\}", sc.path) if v.get(n) is None]
            if missing:
                print(f"skip {name} (no {', '.join(missing)} in the db)")
                continue
            path = re.sub(r"\{(\w+)\}", lambda m: str(v[m.group(1)]), sc.path)
            page = ctx.new_page()
            try:
                page.goto(a.base + path, wait_until="networkidle", timeout=60000)
                sc.act(page)
                page.wait_for_load_state("networkidle")
                page.wait_for_timeout(300)
                page.add_style_tag(content=STYLE)
                page.evaluate(MASK_JS)
                page.screenshot(path=os.path.join(a.out, f"scene-{name}.png"), full_page=not a.viewport, mask=sc.masks(page))
                print(f"ok  {name} {path}")
            except Exception as e:  # an act that fails is a failure, not a skip
                bad += 1
                print(f"BAD {name} {path}: {e}")
            finally:
                page.close()
        browser.close()
    shutil.rmtree(clipdir, ignore_errors=True)
    if bad:
        print(f"shots: {bad} scene(s) not ok", file=sys.stderr)
        return 1
    return 0


def diff(a):
    from PIL import Image, ImageChops

    names_a = {f for f in os.listdir(a.a) if f.endswith(".png")}
    names_b = {f for f in os.listdir(a.b) if f.endswith(".png")}
    differs = False
    compared = 0
    for f in sorted(names_a | names_b):
        s = f[:-4]
        if f not in names_a or f not in names_b:
            print(f"{s} missing-in-{'A' if f not in names_a else 'B'}")
            differs = True
            continue
        ia = Image.open(os.path.join(a.a, f)).convert("RGB")
        ib = Image.open(os.path.join(a.b, f)).convert("RGB")
        if ia.size != ib.size:
            print(f"{s} size {ia.size[0]}x{ia.size[1]} vs {ib.size[0]}x{ib.size[1]}")
            differs = True
            continue
        d = ImageChops.difference(ia, ib)
        if d.getbbox() is None:
            n = 0
        else:
            # a pixel is changed if any channel is: lighten the bands of a 0/255 mask, count the 255s
            bands = [b.point(lambda v: 255 if v else 0) for b in d.split()]
            mask = bands[0]
            for b in bands[1:]:
                mask = ImageChops.lighter(mask, b)
            n = mask.histogram()[255]
        compared += 1
        print(f"{s} {n}")
        if n:
            differs = True
    if compared == 0:
        print("shots: nothing was compared (no PNG in both directories)", file=sys.stderr)
        return 1
    return 1 if differs else 0


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("shoot")
    s.add_argument("--db", required=True)
    s.add_argument("--base", required=True)
    s.add_argument("--out", required=True)
    s.add_argument("--size", required=True)
    s.add_argument("--theme", default="light", choices=["light", "dark"])
    s.add_argument("--pages", required=True)
    s.add_argument("--group", type=int, help="a group id of the dance: shoot in its group mode")
    s.add_argument("--viewport", action="store_true", help="shoot the window only (desktop: the band row and side are fixed)")
    s.add_argument("--delay-from", help="shoot each page while loading: open this page first, then follow a link to it with its __data.json held")
    s.add_argument("--no-session", action="store_true", help="no session cookie: the signed-out pages")
    s.add_argument("--unnamed", action="store_true", help="the admin has no name in the copy, so pages send them to /welcome")
    c = sub.add_parser("scene")
    c.add_argument("--db", required=True)
    c.add_argument("--base", required=True)
    c.add_argument("--out", required=True)
    c.add_argument("--size", required=True)
    c.add_argument("--theme", default="light", choices=["light", "dark"])
    c.add_argument("--group", type=int)
    c.add_argument("--viewport", action="store_true")
    c.add_argument("--scenes", required=True, help="comma list of scene names, or all")
    d = sub.add_parser("diff")
    d.add_argument("a")
    d.add_argument("b")
    a = ap.parse_args()
    sys.exit({"shoot": shoot, "scene": scene, "diff": diff}[a.cmd](a))


if __name__ == "__main__":
    main()
