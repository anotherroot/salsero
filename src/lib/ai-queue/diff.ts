/**
 * What a suggested text change looks like on the Suggestions page: the old
 * words struck through, the new ones marked, word by word. PURE, client-safe.
 *
 * Tokens are words, runs of whitespace and single punctuation marks; the diff
 * is a longest common subsequence over them. A run of changed words stays one
 * strike and one insert even across the spaces between them ("Ucili smos e" →
 * "Učili smo se"), which reads far better than word-by-word alternation.
 */

export type DiffPart = { text: string; op: 'same' | 'del' | 'ins' };

const TOKEN = /\s+|[\p{L}\p{N}'’]+|[^\s\p{L}\p{N}]/gu;
/** Past this many cells the diff is the whole text out and in (a 10 000-character note stays well under it). */
const MAX_CELLS = 4_000_000;

const tokens = (s: string) => s.match(TOKEN) ?? [];
const blank = (s: string) => /^\s+$/.test(s);

type Op = { op: DiffPart['op']; text: string };

function lcsOps(a: string[], b: string[]): Op[] {
	const n = a.length;
	const m = b.length;
	// lengths[i][j]: the LCS of a[i..] and b[j..], in one flat array.
	const w = m + 1;
	const len = new Uint32Array((n + 1) * w);
	for (let i = n - 1; i >= 0; i--)
		for (let j = m - 1; j >= 0; j--)
			len[i * w + j] =
				a[i] === b[j]
					? len[(i + 1) * w + j + 1] + 1
					: Math.max(len[(i + 1) * w + j], len[i * w + j + 1]);
	const ops: Op[] = [];
	let i = 0;
	let j = 0;
	while (i < n && j < m) {
		if (a[i] === b[j]) {
			ops.push({ op: 'same', text: a[i] });
			i++;
			j++;
		} else if (len[(i + 1) * w + j] >= len[i * w + j + 1]) ops.push({ op: 'del', text: a[i++] });
		else ops.push({ op: 'ins', text: b[j++] });
	}
	while (i < n) ops.push({ op: 'del', text: a[i++] });
	while (j < m) ops.push({ op: 'ins', text: b[j++] });
	return ops;
}

export function wordDiff(before: string, after: string): DiffPart[] {
	const a = tokens(before);
	const b = tokens(after);
	const ops: Op[] =
		a.length * b.length > MAX_CELLS
			? [
					...(before ? [{ op: 'del' as const, text: before }] : []),
					...(after ? [{ op: 'ins' as const, text: after }] : [])
				]
			: lcsOps(a, b);

	const out: DiffPart[] = [];
	const push = (op: DiffPart['op'], text: string) => {
		if (!text) return;
		const last = out[out.length - 1];
		if (last && last.op === op) last.text += text;
		else out.push({ op, text });
	};
	let del = '';
	let ins = '';
	const inBlock = () => del !== '' || ins !== '';
	const flush = () => {
		push('del', del);
		push('ins', ins);
		del = '';
		ins = '';
	};
	for (let k = 0; k < ops.length; k++) {
		const { op, text } = ops[k];
		if (op === 'del') del += text;
		else if (op === 'ins') ins += text;
		else if (inBlock() && blank(text) && ops[k + 1] && ops[k + 1].op !== 'same') {
			// A space between two changed words belongs to both sides of the change.
			del += text;
			ins += text;
		} else {
			flush();
			push('same', text);
		}
	}
	flush();
	return out;
}
