"""The offline walk: every page renders from the device's copy. See README.md.

  walk.py <port> <upstream> <db-copy>

<port>, <upstream> and <db-copy> are what serve.sh prints (`port`, `upstream`, `db`). The walk's network
listens on <port> (the server's ORIGIN) and relays to <upstream>; <db-copy> is the server's own copy, read
for the placeholders and to see that an offline write added no `sets` row. One line per check, `ok ...` or
`FAIL ...`; exit 1 on any FAIL. Run under the Playwright command in scripts/shots/README.md.
"""
import importlib.util
import os
import re
import socket
import sqlite3
import statistics
import struct
import sys
import threading
import time
import uuid
import wave
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))


def _shots():
    # python3 -I has no script directory on sys.path: load shots.py by path
    spec = importlib.util.spec_from_file_location("shots", os.path.join(ROOT, "scripts", "shots", "shots.py"))
    mod = importlib.util.module_from_spec(spec)
    sys.modules["shots"] = mod
    spec.loader.exec_module(mod)
    return mod


shots = _shots()
DANCE = shots.DANCE
PHONE = {"width": 390, "height": 844}
READY_CAP_MS = 20_000
PAGE_CAP_MS = 20_000

# Pages the device never answers (src/lib/offline/routes.ts NETWORK_PAGES): offline they show the offline
# error page, by design. Kept here as URL patterns; the walk checks that they do.
NETWORK_PAGES = [r"^/admin$", r"^/app$", r"^/settings/storage$", r"^/[^/]+/groups/[^/]+/(history/[^/]+/[^/]+|deleted|people|storage)$"]

# Pages that draw no band of their own, by design: src/lib/nav/bands.spec.ts NO_BAND, mirrored by its file.
# Only the ones whose SCREEN has no band (the others' layout draws one, which the walk sees). Each gets
# what proves it rendered instead: (route file in bands.spec, URL pattern, selector that must show).
NO_BAND = [
    # 'the map draws its title floating over itself (spec 2026-11-08)': MapPane's own title
    ("src/routes/[dance]/(moves)/positions/map/+page.svelte", r"^/[^/]+/positions/map$", "main h1"),
]


def _no_band_mirrored():
    spec = open(os.path.join(ROOT, "src", "lib", "nav", "bands.spec.ts")).read()
    return [f for f, _, _ in NO_BAND if f"'{f}'" not in spec]


def proof_for(url):
    """The selector that proves a band-less page rendered, or None (a band must show)."""
    path = urlparse(url).path
    for _, pattern, selector in NO_BAND:
        if re.match(pattern, path):
            return selector
    return None


failures = 0


def report(ok, what, why=""):
    global failures
    if ok:
        print(f"ok   {what}")
    else:
        failures += 1
        print(f"FAIL {what}: {why}")
    sys.stdout.flush()


class Net:
    """The network between the browser and the server: a TCP relay on `port` (the server's ORIGIN) to
    `upstream`, that the walk switches off. Off, open connections are cut and new ones closed at once,
    so a fetch fails as it does with no connection, the service worker's included (Playwright's
    offline does not hold for a service worker: it is gone after the next page load)."""

    def __init__(self, port, upstream):
        self.upstream = upstream
        self.online = True
        self.stopping = False
        self.lock = threading.Lock()
        self.socks = set()
        self.server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.server.bind(("127.0.0.1", port))
        self.server.listen(256)
        self.server.settimeout(0.5)
        threading.Thread(target=self._accept, daemon=True).start()

    def _accept(self):
        while not self.stopping:
            try:
                client, _ = self.server.accept()
            except socket.timeout:
                continue
            except OSError:
                return
            if not self.online:
                self._reset(client)
                continue
            try:
                up = socket.create_connection(("127.0.0.1", self.upstream), timeout=10)
                up.settimeout(None)
            except OSError:
                self._reset(client)
                continue
            with self.lock:
                self.socks.update((client, up))
            threading.Thread(target=self._pump, args=(client, up), daemon=True).start()
            threading.Thread(target=self._pump, args=(up, client), daemon=True).start()

    @staticmethod
    def _reset(s):
        # a reset, not a polite close: the browser sees the connection fail
        try:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_LINGER, struct.pack("ii", 1, 0))
        except OSError:
            pass
        s.close()

    def _pump(self, src, dst):
        try:
            while True:
                data = src.recv(65536)
                if not data:
                    break
                dst.sendall(data)
        except OSError:
            pass
        finally:
            for s in (src, dst):
                try:
                    s.shutdown(socket.SHUT_RDWR)
                except OSError:
                    pass
            with self.lock:
                self.socks.discard(src)
                self.socks.discard(dst)
            src.close()

    def set_online(self, online):
        self.online = online
        if not online:
            with self.lock:
                cut, self.socks = list(self.socks), set()
            for s in cut:
                self._reset(s)

    def close(self):
        self.stopping = True
        self.set_online(False)
        self.server.close()


class Watch:
    """What a page logs: uncaught errors and console errors (a media file offline is phase 4's)."""

    MEDIA = re.compile(r"/(recordings|audio|count|lesson-videos)/")

    def __init__(self, page):
        self.errors = []
        page.on("pageerror", lambda e: self.errors.append(f"pageerror: {e}"))
        page.on("console", self._console)

    def _console(self, msg):
        if msg.type != "error":
            return
        url = (msg.location or {}).get("url", "") or ""
        if self.MEDIA.search(url) or self.MEDIA.search(msg.text):
            return
        self.errors.append(f"console: {msg.text[:300]} @ {url}")

    def take(self):
        out, self.errors = self.errors, []
        return out


SCREEN_JS = """(proof) => {
    // the band's title is `display: contents`: it shows when something inside it has a box
    const shows = (e) => [e, ...e.querySelectorAll('*')].some((x) => x.getClientRects().length);
    const err = document.querySelector('[data-error-screen]');
    // a page without a band (NO_BAND) shows its own proof instead
    const band = proof
        ? [...document.querySelectorAll(proof)].some(shows)
        : [...document.querySelectorAll('[data-band-title]')].some(shows);
    return { error: err ? err.getAttribute('data-error-screen') : null, band };
}"""


def screen(page):
    """What is on screen: the error page's tone (or None), and whether a band title (or a band-less page's
    own proof, NO_BAND) shows."""
    return page.evaluate(SCREEN_JS, proof_for(page.url))


def settle(page):
    """The page has drawn: its band (or its NO_BAND proof), or an error page, or the cap."""
    try:
        proof = proof_for(page.url)
        page.wait_for_function(
            f"(proof) => {{ const s = ({SCREEN_JS})(proof); return s.error || s.band; }}",
            arg=proof,
            timeout=PAGE_CAP_MS,
            polling=100,
        )
    except Exception:
        pass
    # late errors (a load that throws after the band drew) still count
    page.wait_for_timeout(400)


def judge(page, watch, what, expect_error=None, allow=()):
    """expect_error: None (a page), or the error page's tone it must show ('warn' offline, 'accent' 404).
    allow: console errors expected on this page (each a substring)."""
    s = screen(page)
    errs = [e for e in watch.take() if not any(a in e for a in allow)]
    if expect_error is None:
        why = []
        if s["error"]:
            why.append(f"error page ({s['error']})")
        if not s["band"]:
            why.append(f"no {proof_for(page.url)} (a page without a band)" if proof_for(page.url) else "no band")
        if errs:
            why.append("; ".join(errs[:3]))
        report(not why, what, " | ".join(why))
    else:
        why = []
        if s["error"] != expect_error:
            why.append(f"expected the {expect_error} error page, got {s['error'] or 'a page'}")
        # the failed read itself is logged by the browser; anything else is not expected
        errs = [e for e in errs if "Failed to load resource" not in e]
        if errs:
            why.append("; ".join(errs[:3]))
        report(not why, what, " | ".join(why))


def wait_ready(page):
    page.wait_for_function(
        "() => window.__device && window.__device.state === 'ready'", timeout=READY_CAP_MS, polling=100
    )


def open_ms(page, url):
    # a warm open of a settled app: the last page's device worker is not still starting beside it
    page.wait_for_timeout(1000)
    page.goto(url, wait_until="load", timeout=60_000)
    page.wait_for_selector("[data-band-title]", timeout=PAGE_CAP_MS)
    return page.evaluate(
        """() => {
            const n = performance.getEntriesByType('navigation')[0];
            return Math.round(n.loadEventEnd - n.startTime);
        }"""
    )


def timed(browser, base, block):
    ctx = browser.new_context(viewport=PHONE, has_touch=True, is_mobile=True, service_workers="block" if block else "allow")
    try:
        ctx.add_cookies([{"name": "salsa_session", "value": "walk", "url": base}])
        page = ctx.new_page()
        url = f"{base}/{DANCE}"
        page.goto(url, wait_until="load", timeout=60_000)
        if not block:
            page.reload(wait_until="load", timeout=60_000)
            wait_ready(page)
        open_ms(page, url)  # warm
        return [open_ms(page, url) for _ in range(5)]
    finally:
        ctx.close()


def sets_count(db_path):
    db = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    try:
        return db.execute("select count(*) from sets").fetchone()[0]
    finally:
        db.close()


def device_data(page, path):
    """A page's data as the device answers it now (offline: through the service worker)."""
    return page.evaluate(
        "async (p) => { const r = await fetch(p + '/__data.json'); return r.status + ' ' + (await r.text()); }",
        path,
    )


def shot(page, name):
    """With WALK_SHOTS=<dir>, a picture of the page as the walk sees it (the offline strip, for a look)."""
    out = os.environ.get("WALK_SHOTS")
    if out:
        os.makedirs(out, exist_ok=True)
        page.screenshot(path=os.path.join(out, f"{name}.png"))


def outbox(page):
    """The device's outbox as the page knows it (offline phase 3)."""
    return page.evaluate("() => (window.__device && window.__device.outbox) || null")


def wait_outbox(page, test, ms=30_000):
    """Waits until `test` (a JS expression over `o`, the outbox) holds; False on time out."""
    try:
        page.wait_for_function(
            f"() => {{ const o = window.__device && window.__device.outbox; return !!o && ({test}); }}",
            timeout=ms,
            polling=200,
        )
        return True
    except Exception:
        return False


def server_rows(db_path, sql, *args):
    db = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    try:
        return db.execute(sql, args).fetchall()
    finally:
        db.close()


def server_write(db_path, sql, *args):
    db = sqlite3.connect(db_path)
    try:
        db.execute(sql, args)
        db.commit()
    finally:
        db.close()


UUID_FILE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{1,5}$")


def put_song(db_path):
    """Check 13's song: a 1-second WAV as the walk person's first song's audio, in the server's DATA_DIR
    (the db's own dir, serve.sh). A name the server would refuse (not a uuid) is given a uuid one, in this
    copy only. Its name, or None when the person has no song with an audio file."""
    db = sqlite3.connect(db_path)
    try:
        row = db.execute(
            "select s.id, s.audio_file from songs s join sessions se on se.user_id = s.user_id "
            "where se.id = 'walk' and s.audio_file is not null and s.archived_at is null order by s.id"
        ).fetchone()
        if row is None:
            return None
        name = row[1] if UUID_FILE.match(row[1]) else f"{uuid.uuid4()}.wav"
        db.execute("update songs set audio_file = ?, mime = 'audio/wav' where id = ?", (name, row[0]))
        db.commit()
    finally:
        db.close()
    folder = os.path.join(os.path.dirname(db_path), "audio")
    os.makedirs(folder, exist_ok=True)
    with wave.open(os.path.join(folder, name), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(8000)
        w.writeframes(b"\x00\x00" * 8000)
    return name


def put_video(db_path):
    """Check 14's video: a lesson of the walk person's (or a group's they are in) with one video, its file
    made small and real in the server's DATA_DIR, its row's size to match (the phone checks it), in this
    copy only. (lesson id, file name), or None when there is no such lesson."""
    db = sqlite3.connect(db_path)
    try:
        row = db.execute(
            "select lv.id, lv.lesson_id, lv.file from lesson_videos lv join lessons l on l.id = lv.lesson_id "
            "join sessions se on se.id = 'walk' "
            "where l.archived_at is null and (l.published_at is not null or l.user_id is not null) and ("
            "l.user_id = se.user_id or l.team_id in (select team_id from team_members where user_id = se.user_id)) "
            "and (select count(*) from lesson_videos o where o.lesson_id = l.id) = 1 order by lv.id"
        ).fetchone()
        if row is None:
            return None
        name = row[2] if UUID_FILE.match(row[2]) else f"{uuid.uuid4()}.webm"
        data = bytes(range(256)) * 64
        db.execute("update lesson_videos set file = ?, mime = 'video/webm', size_bytes = ? where id = ?", (name, len(data), row[0]))
        db.commit()
    finally:
        db.close()
    folder = os.path.join(os.path.dirname(db_path), "lesson-videos")
    os.makedirs(folder, exist_ok=True)
    with open(os.path.join(folder, name), "wb") as f:
        f.write(data)
    return row[1], name


def main():
    if len(sys.argv) != 4:
        sys.exit("usage: walk.py <port> <upstream> <db-copy>")
    port, upstream, db_path = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
    base = f"http://127.0.0.1:{port}"
    unmirrored = _no_band_mirrored()
    report(not unmirrored, "walk: its NO_BAND pages are bands.spec.ts's", f"not in bands.spec.ts: {unmirrored}")
    # the server's own copy (serve.sh's mktemp): some scenes' placeholders fill a gap in it, as in shots.py
    db = sqlite3.connect(db_path)
    try:
        _, v = shots.placeholders(db)
        db.commit()
    finally:
        db.close()
    lines = [l.strip() for l in open(os.path.join(ROOT, "scripts", "shots", "pages.txt")) if l.strip() and not l.startswith("#")]

    song = put_song(db_path)
    video = put_video(db_path)
    net = Net(port, upstream)
    try:
        walk(base, db_path, v, lines, net, song, video)
    finally:
        net.close()


def walk(base, db_path, v, lines, net, song=None, video=None):
    def offline(ctx, on):
        # both: the page's navigator.onLine, and the connection itself
        if on:
            ctx.set_offline(True)
            net.set_online(False)
        else:
            net.set_online(True)
            ctx.set_offline(False)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            # 1. Online: how long a warm open of Today takes, without and then with the service worker.
            without = timed(browser, base, block=True)
            ctx = browser.new_context(viewport=PHONE, has_touch=True, is_mobile=True)
            try:
                ctx.add_cookies([{"name": "salsa_session", "value": "walk", "url": base}])
                page = ctx.new_page()
                watch = Watch(page)
                url = f"{base}/{DANCE}"
                page.goto(url, wait_until="load", timeout=60_000)
                page.reload(wait_until="load", timeout=60_000)
                try:
                    wait_ready(page)
                    report(True, "online: the device is ready")
                except Exception as e:
                    report(False, "online: the device is ready", f"state {page.evaluate('window.__device?.state')}: {str(e)[:120]}")
                    return
                open_ms(page, url)  # warm
                with_sw = [open_ms(page, url) for _ in range(5)]
                m_with, m_without = statistics.median(with_sw), statistics.median(without)
                print(f"     open /{DANCE}: median {m_with} ms with the service worker {with_sw}, {m_without} ms without {without}")
                report(m_with <= m_without + 100, "online: opens no slower with the service worker", f"{m_with} > {m_without} + 100 ms")
                judge(page, watch, f"online: /{DANCE}")

                # 2. Offline, a full load of every page.
                offline(ctx, True)
                sw = ctx.service_workers[0] if ctx.service_workers else None
                cut = sw.evaluate("fetch('/health').then((r) => 'answered ' + r.status, () => 'rejected')") if sw else "no service worker"
                report(cut == "rejected", "offline: the service worker cannot reach the server", cut)
                for line in lines:
                    names = re.findall(r"\{(\w+)\}", line)
                    missing = [n for n in names if v.get(n) is None]
                    if missing:
                        report(False, f"offline: {line}", f"no {', '.join(missing)} in the db")
                        continue
                    path = re.sub(r"\{(\w+)\}", lambda m: str(v[m.group(1)]), line)
                    bare = path.split("?")[0]
                    try:
                        page.goto(base + path, wait_until="load", timeout=60_000)
                    except Exception as e:
                        watch.take()
                        report(False, f"offline: {path}", f"goto: {str(e)[:160]}")
                        continue
                    settle(page)
                    if "does-not-exist" in path:
                        # Offline, a 404 shows as offline (`errorView`: offline wins; the copy may be behind).
                        # SvelteKit's client logs a missing route itself, and the device's server its 404, as the
                        # server does (hooks.server.ts `handleError`).
                        judge(page, watch, f"offline: {path}", expect_error="warn", allow=("Not found: /", "[404] GET /"))
                    elif any(re.match(r, bare) for r in NETWORK_PAGES):
                        judge(page, watch, f"offline: {path} (a network page)", expect_error="warn")
                    else:
                        judge(page, watch, f"offline: {path}")

                # still cut after every page load (Playwright's own offline would be gone by now)
                sw = ctx.service_workers[0] if ctx.service_workers else None
                cut = sw.evaluate("fetch('/health').then((r) => 'answered ' + r.status, () => 'rejected')") if sw else "no service worker"
                report(cut == "rejected", "offline: the service worker still cannot reach the server", cut)

                # 3. Offline, client navigation: each tab, then the first row of its list.
                # A new tab: a fresh trail (sessionStorage), so each tab leads to its list, not the last page
                # walked. The old tab goes first: one tab holds the device.
                page.close()
                page = ctx.new_page()
                watch = Watch(page)
                page.goto(f"{base}/{DANCE}", wait_until="load", timeout=60_000)
                settle(page)
                watch.take()
                tabs = page.locator("nav[data-tab-bar] a")
                hrefs = [tabs.nth(i).get_attribute("href") for i in range(tabs.count())]
                if not hrefs:
                    report(False, "offline: the tab bar", "no tabs")
                for i, href in enumerate(hrefs):
                    label = href
                    try:
                        tabs.nth(i).click(timeout=5000)
                        page.wait_for_url(lambda u: href.split("?")[0] in u, timeout=PAGE_CAP_MS)
                    except Exception as e:
                        report(False, f"offline tap: tab {label}", str(e)[:160])
                        continue
                    settle(page)
                    judge(page, watch, f"offline tap: tab {label} ({page.url.replace(base, '')})")
                    row = page.locator(
                        "main a[href*='/exercises/'], main a[href*='/figures/'], main a[href*='/lessons/'], "
                        "main a[href*='/songs/'], main a[href*='/groups/']"
                    ).first
                    if not row.count():
                        print(f"     (tab {label}: no row to open)")
                        continue
                    to = row.get_attribute("href")
                    try:
                        row.click(timeout=5000)
                        page.wait_for_url(lambda u: to.split("?")[0] in u, timeout=PAGE_CAP_MS)
                    except Exception as e:
                        report(False, f"offline tap: {label}'s first row {to}", str(e)[:160])
                        continue
                    settle(page)
                    judge(page, watch, f"offline tap: {label}'s first row ({to})")
                    # back to the tab bar's page for the next tab
                    tabs = page.locator("nav[data-tab-bar] a")

                # The last tab's row is a group: its first lesson, a class lesson (opening it reports an open,
                # a background write: offline, no toast and no error).
                lesson = page.locator("main a[href*='/lessons/']").first
                if "/groups/" in page.url and lesson.count():
                    to = lesson.get_attribute("href")
                    try:
                        lesson.click(timeout=5000)
                        page.wait_for_url(lambda u: to.split("?")[0] in u, timeout=PAGE_CAP_MS)
                        settle(page)
                        page.wait_for_timeout(1000)
                        judge(page, watch, f"offline tap: the group's first lesson ({to})")
                        quiet = page.get_by_text("Needs a connection", exact=False).count() == 0
                        report(quiet, "offline tap: opening a class lesson says nothing", "a needs-connection toast")
                    except Exception as e:
                        report(False, f"offline tap: the group's first lesson {to}", str(e)[:160])

                # 4. Offline, a write: Today's first exercise, its page's Done and a face (run the day plan 2:
                # the face is the send). Offline phase 3: it saves on the device, the sheet closes, nothing reaches
                # the server yet, and after the grace the band says "· 1 waiting".
                page.goto(f"{base}/{DANCE}", wait_until="load", timeout=60_000)
                settle(page)
                watch.take()
                row = page.locator("main a[href*='/exercises/']").first
                if not row.count():
                    report(False, "offline write: Done", "no exercise on Today")
                else:
                    ex_path = row.get_attribute("href").split("?")[0]
                    before_rows = sets_count(db_path)
                    before_copy = device_data(page, ex_path)
                    row.click()
                    page.wait_for_url(lambda u: ex_path in u, timeout=PAGE_CAP_MS)
                    settle(page)
                    page.evaluate("() => { window.__nc = 0; addEventListener('salsa:needs-connection', () => window.__nc++); }")
                    done = page.locator('[data-focus="exercise-done"]')
                    if not done.count():
                        report(False, "offline write: Done", "no Done on the exercise page")
                    else:
                        done.first.click()
                        sheet = page.locator("dialog[open]")
                        try:
                            sheet.first.wait_for(timeout=3000)
                        except Exception:
                            pass
                        in_sheet = sheet.count() > 0
                        typed = "walk: offline note"
                        note = sheet.locator("textarea[name=note]") if in_sheet else None
                        if note is not None and note.count():
                            note.first.fill(typed)
                        if in_sheet:
                            # FaceRating: four aria-pressed buttons, each named by its word and the time it sets
                            faces = sheet.locator("fieldset button[aria-pressed]")
                            if not faces.count():
                                report(False, "offline write: Done", "no face in the Done sheet")
                            else:
                                faces.first.click(timeout=10_000)
                        page.wait_for_timeout(800)
                        closed = page.locator("dialog[open]").count() == 0
                        report(closed, "offline write: saved on the device, the Done sheet closes", "the sheet stayed open")
                        report(page.evaluate("() => window.__nc") == 0, "offline write: no needs-connection", "it said needs a connection")
                        after_rows = sets_count(db_path)
                        report(after_rows == before_rows, "offline write: nothing on the server yet", f"{before_rows} -> {after_rows}")
                        after_copy = device_data(page, ex_path)
                        report(after_copy != before_copy, "offline write: the device's copy holds the log", "its data did not change")
                        ob = outbox(page)
                        report(bool(ob) and ob["waiting"] >= 1, "offline write: one change waits", f"outbox {ob}")
                        made_at = ob["oldestWaitingAt"] if ob else None
                        strip = page.locator("[data-offline-strip]")
                        said = strip.inner_text() if strip.count() else ""
                        report("Offline" in said and "1 change waiting" in said, "offline write: the strip says offline and that 1 change waits", f"strip {said!r}")
                        shot(page, "offline-exercise")
                        errs = [e for e in watch.take() if "Failed to load resource" not in e]
                        report(not errs, "offline write: no errors", "; ".join(errs[:3]))

                # 5. Offline, a network page: a group lesson's History (team_changes never leaves the server)
                # shows the offline error page, not an empty History.
                hist = None
                if v.get("group") is not None:
                    db = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
                    try:
                        lesson = db.execute("select id from lessons where team_id = ? order by id limit 1", (v["group"],)).fetchone()
                    finally:
                        db.close()
                    if lesson:
                        hist = f"/{DANCE}/groups/{v['group']}/history/lesson/{lesson[0]}"
                if hist is None:
                    report(False, "offline: a group lesson's History", "no group lesson in the db")
                else:
                    page.goto(base + hist, wait_until="load", timeout=60_000)
                    settle(page)
                    judge(page, watch, f"offline: {hist} (a network page)", expect_error="warn")

                # 6. Back online: a rename lands in the copy, and offline the figure page shows it.
                offline(ctx, False)
                fig = f"{base}/{DANCE}/figures/{v['figure']}"
                page.goto(fig, wait_until="load", timeout=60_000)
                wait_ready(page)
                pulls = page.evaluate("window.__device.pulls")
                new_name = f"Walk {int(time.time()) % 100000}"
                try:
                    page.get_by_role("button", name="Edit", exact=True).first.click()
                    page.locator('#edit-form input[name="name"]').fill(new_name)  # the variation's name (master: Edit asks no move name)
                    page.locator("#edit-form").evaluate("(f) => f.requestSubmit()")
                    page.locator("#edit-form").wait_for(state="detached", timeout=PAGE_CAP_MS)
                    page.wait_for_function(f"() => window.__device.pulls > {pulls}", timeout=READY_CAP_MS, polling=100)
                    report(True, "online: renamed, and the device pulled")
                except Exception as e:
                    report(False, "online: renamed, and the device pulled", str(e)[:200])
                # the pull invalidates the page: let that load finish before the network goes, or its fetch fails
                try:
                    page.wait_for_load_state("networkidle", timeout=10_000)
                except Exception:
                    pass
                watch.take()
                offline(ctx, True)
                page.goto(fig, wait_until="load", timeout=60_000)
                settle(page)
                judge(page, watch, "offline: the renamed figure's page")
                has = page.get_by_text(new_name, exact=False).count() > 0
                report(has, "offline: the figure page shows the new name", f"no {new_name!r} on the page")

                # 7. Offline, an edit: rename the figure on the device; its page shows it and it waits (step 4.s log
                # went up when step 6 came online).
                offline_name = f"Offline {int(time.time()) % 100000}"
                try:
                    page.get_by_role("button", name="Edit", exact=True).first.click()
                    page.locator('#edit-form input[name="name"]').fill(offline_name)
                    page.locator("#edit-form").evaluate("(f) => f.requestSubmit()")
                    page.locator("#edit-form").wait_for(state="detached", timeout=PAGE_CAP_MS)
                    settle(page)
                    report(page.get_by_text(offline_name, exact=False).count() > 0, "offline edit: the page shows the new name", "not shown")
                    # The strip sits above the figure switcher (look C2), not on it.
                    strip = page.locator("[data-offline-strip]")
                    bar = page.locator("nav[aria-label^='Figures of']").first
                    if strip.count() and bar.count():
                        sb, bb = strip.bounding_box(), bar.bounding_box()
                        report(sb["y"] + sb["height"] <= bb["y"] + 1, "offline edit: the strip sits above the figure switcher", f"strip {sb}, bar {bb}")
                        shot(page, "offline-figure")
                    else:
                        report(False, "offline edit: the strip above the figure switcher", f"strip {strip.count()}, bar {bar.count()}")
                except Exception as e:
                    report(False, "offline edit: renamed on the device", str(e)[:200])
                ob = outbox(page)
                report(bool(ob) and ob["waiting"] >= 1, "offline edit: the rename waits", f"outbox {ob}")

                # 8. Back online: everything goes up once, dated when it was made, with the device's ids.
                offline(ctx, False)
                page.evaluate("() => window.dispatchEvent(new Event('online'))")
                landed = wait_outbox(page, "o.waiting === 0 && o.refused === 0")
                report(landed, "online again: everything synced", f"outbox {outbox(page)}")
                rows = server_rows(db_path, "select id, done_at from sets where id >= 4294967296 order by id")
                report(len(rows) == 1, "online again: exactly one set from the device, with its own id", f"{rows}")
                if rows and made_at:
                    report(abs(rows[0][1] - made_at) <= 1000, "online again: the set is dated when it was made", f"done_at {rows[0][1]}, made {made_at}")
                name = server_rows(db_path, "select name from figures where id = ?", v["figure"])
                report(bool(name) and name[0][0] == offline_name, "online again: the server has the offline rename", f"{name}")
                try:
                    page.locator("[data-offline-strip]").wait_for(state="detached", timeout=6000)
                    report(True, "online again: the strip goes (after All sent)")
                except Exception:
                    report(False, "online again: the strip goes", page.locator("[data-offline-strip]").inner_text())

                # 10. Refused: offline, a note on the figure; meanwhile the figure is archived on the server.
                offline(ctx, True)
                page.goto(fig, wait_until="load", timeout=60_000)
                settle(page)
                try:
                    page.get_by_role("button", name="Edit", exact=True).first.click()
                    page.locator('#edit-form textarea[name="notes"]').fill("walk: offline note")
                    page.locator("#edit-form").evaluate("(f) => f.requestSubmit()")
                    page.locator("#edit-form").wait_for(state="detached", timeout=PAGE_CAP_MS)
                    report(True, "refused: a note made offline")
                except Exception as e:
                    report(False, "refused: a note made offline", str(e)[:200])
                server_write(db_path, "update figures set archived_at = ? where id = ?", int(time.time() * 1000), v["figure"])
                offline(ctx, False)
                page.evaluate("() => window.dispatchEvent(new Event('online'))")
                refused = wait_outbox(page, "o.refused === 1")
                report(refused, "refused: the change couldn't sync", f"outbox {outbox(page)}")
                page.wait_for_timeout(400)
                pill = page.locator("a[href$='/sync']:visible", has_text=re.compile(r"couldn.t sync"))
                report(pill.count() > 0, "refused: the band shows the pill", "no pill")
                if pill.count():
                    pill.first.click()
                    try:
                        page.wait_for_url(lambda u: u.endswith("/sync"), timeout=PAGE_CAP_MS)
                    except Exception:
                        pass
                settle(page)
                report(page.get_by_text("archived or deleted meanwhile", exact=False).count() > 0, "refused: the Sync page says why", "no reason shown")
                discard = page.get_by_role("button", name="Discard", exact=True)
                if discard.count():
                    discard.first.click()
                    page.locator("dialog[open]").get_by_role("button", name="Discard", exact=True).click()
                    try:
                        page.get_by_text("Everything is synced.").wait_for(timeout=10_000)
                        report(True, "refused: discarded, everything is synced")
                    except Exception:
                        report(False, "refused: discarded, everything is synced", "not said")
                else:
                    report(False, "refused: Discard", "no Discard on the Sync page")
                server_write(db_path, "update figures set archived_at = null where id = ?", v["figure"])

                # 11. Online, no nag: a log made online never shows "waiting", and lands.
                page.goto(f"{base}/{DANCE}/exercises/{v['exercise']}", wait_until="load", timeout=60_000)
                wait_ready(page)
                done = page.locator('[data-focus="exercise-done"]')
                if done.count():
                    done.first.click()
                    sheet = page.locator("dialog[open]")
                    try:
                        sheet.first.wait_for(timeout=3000)
                        faces = sheet.locator("fieldset button[aria-pressed]")
                        if faces.count():
                            faces.first.click(timeout=10_000)
                    except Exception:
                        pass
                    nag = False
                    for _ in range(10):
                        page.wait_for_timeout(200)
                        if page.locator("[data-offline-strip]").count():
                            nag = True
                    report(not nag, "online: a log never shows the strip", "the strip showed")
                    report(wait_outbox(page, "o.waiting === 0"), "online: the log lands", f"outbox {outbox(page)}")
                    # Once all has landed, the page's reads go to the server again: a change made on the
                    # server alone (the device has not pulled it) shows.
                    server_only = f"Server {int(time.time()) % 100000}"
                    server_write(db_path, "update figures set name = ? where id = ?", server_only, v["figure"])
                    page.wait_for_timeout(300)
                    fresh = device_data(page, f"/{DANCE}/figures/{v['figure']}")
                    report(server_only in fresh, "online: after the landing, reads come from the server again", "the device answered")
                else:
                    report(False, "online: a log", "no Done on the exercise page")

                # 12. Needs a connection: offline, the figure's ⋯ greys what needs one under one note (none
                # of its own items does, so no note unless a group's Copy to is there), and Settings' Storage
                # is greyed and a tap says so instead of opening it.
                offline(ctx, True)
                page.goto(fig, wait_until="load", timeout=60_000)
                settle(page)
                more = page.get_by_role("button", name=re.compile(r"menu$", re.I))
                if more.count():
                    more.first.click()
                    page.locator("dialog[open]").first.wait_for(timeout=5000)
                    page.wait_for_timeout(300)
                    note = page.get_by_text("Needs a connection for these").count() > 0
                    copy = page.locator("dialog[open]").get_by_text("Copy to", exact=False)
                    if copy.count():
                        greyed = copy.first.evaluate("(e) => !!e.closest('button')?.disabled")
                        report(note and greyed, "needs a connection: the menu greys Copy to under one note", f"note {note}, greyed {greyed}")
                    else:
                        report(not note, "needs a connection: a menu with nothing that needs one has no note", "the note shows")
                    page.keyboard.press("Escape")
                else:
                    report(False, "needs a connection: the figure's menu", "no ⋯ menu")
                page.goto(f"{base}/settings", wait_until="load", timeout=60_000)
                settle(page)
                storage = page.locator("a[href='/settings/storage']")
                if storage.count():
                    page.evaluate("() => { window.__nc = 0; addEventListener('salsa:needs-connection', () => window.__nc++); }")
                    marked = storage.first.get_attribute("data-offline") is not None
                    storage.first.click(force=True)  # aria-disabled: Playwright would wait for it
                    page.wait_for_timeout(500)
                    told = page.evaluate("() => window.__nc") > 0
                    stayed = page.url.rstrip("/").endswith("/settings")
                    report(marked and told and stayed, "needs a connection: Settings' Storage is greyed and says so", f"greyed {marked}, told {told}, at {page.url.replace(base, '')}")
                else:
                    report(False, "needs a connection: Settings' Storage", "no Storage row")

                # 13. A song with no signal (offline phase 4a): online the device keeps the song's audio, and
                # the service worker answers it from the phone, online and offline, with Range.
                offline(ctx, False)
                if song is None:
                    report(False, "songs on the phone", "the walk person has no song with an audio file")
                else:
                    page.goto(f"{base}/{DANCE}", wait_until="load", timeout=60_000)
                    settle(page)
                    held = False
                    for _ in range(60):
                        held = page.evaluate(
                            """async (f) => { try {
                                const d = await (await (await navigator.storage.getDirectory())
                                    .getDirectoryHandle('media')).getDirectoryHandle('audio');
                                await d.getFileHandle(f); return true; } catch { return false; } }""",
                            song,
                        )
                        if held:
                            break
                        page.wait_for_timeout(500)
                    report(held, "songs on the phone: the device keeps the song's audio", "not in the store after 30 s")
                    probe = """async (f) => { const r = await fetch('/audio/' + f, { headers: { Range: 'bytes=0-99' } });
                        return [r.status, (await r.arrayBuffer()).byteLength, r.headers.get('X-Salsa-From')]; }"""
                    got = page.evaluate(probe, song)
                    report(got == [206, 100, "device"], "songs on the phone: online the phone's copy answers", f"{got}")
                    offline(ctx, True)
                    got = page.evaluate(probe, song)
                    report(got == [206, 100, "device"], "songs on the phone: offline it plays from the phone", f"{got}")
                    page.goto(f"{base}/settings", wait_until="load", timeout=60_000)
                    settle(page)
                    line = page.locator("[data-songs-on-phone]")
                    text = line.first.inner_text() if line.count() else ""
                    shown = "Songs " in text and "videos " in text
                    report(shown, "songs on the phone: Settings' On this phone row says how much they take", text or "no line")
                    offline(ctx, False)

                # 14. A lesson video kept on the phone (offline phase 4b): its button under the video keeps it,
                # and the service worker answers it from the phone, online and offline, with Range.
                if video is None:
                    report(False, "videos on the phone", "the walk person has no lesson with one video")
                else:
                    lesson, vfile = video
                    page.goto(f"{base}/{DANCE}/lessons/{lesson}", wait_until="load", timeout=60_000)
                    settle(page)
                    button = page.locator("[data-keep='off']")
                    try:
                        button.first.wait_for(timeout=30_000)
                        button.first.click()
                        page.locator("[data-keep='on']").first.wait_for(timeout=30_000)
                        kept = True
                    except Exception as e:  # noqa: BLE001 - reported as a failure
                        kept = False
                        print("   ", e)
                    report(kept, "videos on the phone: the button under the video keeps it", "no button, or it never came")
                    vprobe = """async (f) => { const r = await fetch('/lesson-videos/' + f, { headers: { Range: 'bytes=0-99' } });
                        return [r.status, (await r.arrayBuffer()).byteLength, r.headers.get('X-Salsa-From')]; }"""
                    got = page.evaluate(vprobe, vfile)
                    report(got == [206, 100, "device"], "videos on the phone: online the phone's copy answers", f"{got}")
                    offline(ctx, True)
                    got = page.evaluate(vprobe, vfile)
                    report(got == [206, 100, "device"], "videos on the phone: offline it plays from the phone", f"{got}")
                    offline(ctx, False)
            finally:
                ctx.close()
        finally:
            browser.close()


if __name__ == "__main__":
    main()
    print(f"walk: {failures} failed" if failures else "walk: all ok")
    sys.exit(1 if failures else 0)
