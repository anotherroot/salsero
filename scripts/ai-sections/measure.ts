// The video sections experiment's measure (AI connector plan 3): the AI's
// proposed sections on one video against the person's own.
//
//   npx tsx scripts/ai-sections/measure.ts <db file> lv:<lesson video id>|rec:<recording id> [tolerance ms]
//
// Run it on a copy of a backup (it only reads). The person's sections are the
// video's spans, without those a run of the AI's own lines created; the AI's
// are every add_section line for the video that was not withdrawn (pending,
// dropped, left out, done or undone).
import Database from 'better-sqlite3';
import { compareSections, type Span } from '../../src/lib/ai-queue/measure';

const [file, which, tol] = process.argv.slice(2);
const m = /^(lv|rec):(\d+)$/.exec(which ?? '');
if (!file || !m) {
	console.error('usage: measure.ts <db file> lv:<id>|rec:<id> [tolerance ms]');
	process.exit(2);
}
const id = Number(m[2]);
const column = m[1] === 'lv' ? 'lesson_video_id' : 'recording_id';
const key = m[1] === 'lv' ? 'lessonVideoId' : 'recordingId';
const tolerance = tol ? Number(tol) : 2000;

const db = new Database(file, { readonly: true, fileMustExist: true });
const hasQueue = !!db
	.prepare(`select 1 from sqlite_master where type = 'table' and name = 'ai_lines'`)
	.get();

type Line = { status: string; payload: string; result: string | null };
const lines: Line[] = hasQueue
	? (db
			.prepare(`select status, payload, result from ai_lines where kind = 'add_section'`)
			.all() as Line[])
	: [];
const onThisVideo = lines.filter(
	(l) => (JSON.parse(l.payload) as { video?: Record<string, number> }).video?.[key] === id
);
const madeByAi = new Set(
	onThisVideo
		.filter((l) => l.status === 'done' && l.result)
		.map((l) => Number((JSON.parse(l.result!) as { id?: number }).id))
);

type SpotRow = { id: number; start_ms: number; end_ms: number; label: string | null };
const mine: Span[] = (
	db
		.prepare(
			`select id, start_ms, end_ms, label from video_spots where ${column} = ? and end_ms is not null order by start_ms`
		)
		.all(id) as SpotRow[]
)
	.filter((s) => !madeByAi.has(s.id))
	.map((s) => ({ startMs: s.start_ms, endMs: s.end_ms, label: s.label }));
const ai: Span[] = onThisVideo
	.filter((l) => l.status !== 'withdrawn')
	.map((l) => JSON.parse(l.payload) as { startMs: number; endMs: number; label: string | null })
	.map((p) => ({ startMs: p.startMs, endMs: p.endMs, label: p.label }))
	.sort((a, b) => a.startMs - b.startMs);

const r = compareSections(mine, ai, tolerance);
const at = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
const span = (s: Span) => `${at(s.startMs)}–${at(s.endMs)} ${s.label ?? ''}`.trim();
const delta = (ms: number) => `${ms >= 0 ? '+' : ''}${(ms / 1000).toFixed(1)}`;

console.log(`${which}: ${mine.length} of yours, ${ai.length} from the AI`);
for (const p of r.pairs)
	console.log(
		`${p.close ? 'close' : 'off  '}  ${span(p.mine)}  ←  ${span(p.ai)}  (start ${delta(p.startDeltaMs)} s, end ${delta(p.endDeltaMs)} s)`
	);
for (const s of r.missed) console.log(`missed ${span(s)}`);
for (const s of r.extra) console.log(`extra  ${span(s)}`);
const close = r.pairs.filter((p) => p.close).length;
console.log(
	`${close} of ${mine.length} close (±${tolerance / 1000} s), ${r.missed.length} missed, ${r.extra.length} extra`
);
