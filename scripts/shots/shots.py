"""Screenshot rig, the Python side.

  shots.py shoot --db DB --base URL --out DIR --size WxH [--theme light|dark] --pages FILE
  shots.py diff DIR_A DIR_B

`shoot` fills the placeholders in the pages file from the db, inserts a session row,
and shoots every page. `diff` prints `<slug> <changed-pixels>` per page, exit 1 if any differ.
"""
import argparse
import os
import re
import sqlite3
import sys
import time
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

DANCE = "salsa"
# Elements marked data-shots-mask (a clock, say) are hidden so a page is stable.
# The rig also marks what depends on the machine, so no page source carries the attribute: the QR of /app
# encodes the dev server's random port; the admin's limits line ends in the disk's free space.
MASK_JS = """() => {
  document.querySelectorAll('svg[role=img][aria-label^="QR code"]').forEach(e => e.setAttribute('data-shots-mask', ''));
  document.querySelectorAll('p, div, span').forEach(e => {
    if (e.children.length === 0 && / GB free$/.test(e.textContent || '')) e.setAttribute('data-shots-mask', '');
  });
}"""
STYLE = (
    "[data-shots-mask]{visibility:hidden!important}"
    "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}"
)


def first(db, sql, args=()):
    row = db.execute(sql, args).fetchone()
    return row[0] if row else None


def placeholders(db):
    admin = first(db, "select id from users where is_admin = 1 order by created_at limit 1")
    if admin is None:
        sys.exit("shots: no admin user in the db")
    tz = first(db, "select timezone from users where id = ?", (admin,)) or "UTC"
    yesterday = (datetime.now(ZoneInfo(tz)) - timedelta(days=1)).strftime("%Y-%m-%d")
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
    }
    return admin, v


def slug(path):
    s = re.sub(r"[^A-Za-z0-9]+", "_", path).strip("_")
    return s or "root"


def shoot(a):
    from playwright.sync_api import sync_playwright

    db = sqlite3.connect(a.db)
    admin, v = placeholders(db)
    now = int(time.time() * 1000)
    db.execute("delete from sessions where id = 'shots'")
    db.execute(
        "insert into sessions (id, user_id, expires_at, created_at) values ('shots', ?, ?, ?)",
        (admin, now + 86_400_000, now),
    )
    db.commit()
    db.close()

    w, h = (int(x) for x in a.size.split("x"))
    lines = [l.strip() for l in open(a.pages) if l.strip() and not l.startswith("#")]
    os.makedirs(a.out, exist_ok=True)
    bad = 0
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(
            viewport={"width": w, "height": h},
            color_scheme=a.theme,
            device_scale_factor=1,
            timezone_id="Europe/Ljubljana",
        )
        ctx.add_cookies([{"name": "salsa_session", "value": "shots", "url": a.base}])
        for line in lines:
            names = re.findall(r"\{(\w+)\}", line)
            missing = [n for n in names if v.get(n) is None]
            if missing:
                print(f"MISSING {line} (no {', '.join(missing)} in the db)")
                bad += 1
                continue
            path = re.sub(r"\{(\w+)\}", lambda m: str(v[m.group(1)]), line)
            page = ctx.new_page()
            try:
                resp = page.goto(a.base + path, wait_until="networkidle", timeout=60000)
                page.add_style_tag(content=STYLE)
                page.evaluate(MASK_JS)
                page.wait_for_timeout(300)
                status = resp.status if resp else 0
                final = page.url.replace(a.base, "")
                png = os.path.join(a.out, slug(path) + ".png")
                page.screenshot(path=png, full_page=True)
                expected_404 = "does-not-exist" in path
                ok = (status == 404) if expected_404 else (status < 400 and final.split("?")[0] == path.split("?")[0])
                if not ok:
                    bad += 1
                print(f"{'ok ' if ok else 'BAD'} {status} {path}" + (f" -> {final}" if final != path else ""))
            except Exception as e:  # a page that cannot be shot is a failure, not a skip
                bad += 1
                print(f"BAD err {path}: {e}")
            finally:
                page.close()
        browser.close()
    if bad:
        print(f"shots: {bad} page(s) not ok", file=sys.stderr)
        return 1
    return 0


def diff(a):
    from PIL import Image, ImageChops

    names_a = {f for f in os.listdir(a.a) if f.endswith(".png")}
    names_b = {f for f in os.listdir(a.b) if f.endswith(".png")}
    differs = False
    for f in sorted(names_a | names_b):
        s = f[:-4]
        if f not in names_a or f not in names_b:
            print(f"{s} missing-in-{'A' if f not in names_a else 'B'}")
            differs = True
            continue
        ia = Image.open(os.path.join(a.a, f)).convert("RGBA")
        ib = Image.open(os.path.join(a.b, f)).convert("RGBA")
        if ia.size != ib.size:
            print(f"{s} size {ia.size[0]}x{ia.size[1]} vs {ib.size[0]}x{ib.size[1]}")
            differs = True
            continue
        d = ImageChops.difference(ia, ib)
        px = d.get_flattened_data() if hasattr(d, "get_flattened_data") else d.getdata()
        n = sum(1 for p in px if any(p))
        print(f"{s} {n}")
        if n:
            differs = True
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
    d = sub.add_parser("diff")
    d.add_argument("a")
    d.add_argument("b")
    a = ap.parse_args()
    sys.exit(shoot(a) if a.cmd == "shoot" else diff(a))


if __name__ == "__main__":
    main()
