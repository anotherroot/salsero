import { describe, expect, it } from 'vitest';
import { seenRefusal } from './clash';
import { runReplaying, type ReplayContext } from './replay-context';

const ctx: ReplayContext = {
	entryId: 'e1',
	madeAt: 1000,
	minted: new Map(),
	flows: [],
	deferFlows: true
};
const formWith = (seen: unknown) => {
	const f = new FormData();
	f.set('seen', JSON.stringify(seen));
	return f;
};
const current = { name: 'New', notes: null };
const stale = formWith({ name: 'Old', notes: null });

describe('seenRefusal on replay', () => {
	it("skips a stale seen on a person's own row during a replay", () => {
		expect(seenRefusal(stale, { team: false, copies: true }, current, {})).not.toBeNull();
		expect(
			runReplaying(ctx, () => seenRefusal(stale, { team: false, copies: true }, current, {}))
		).toBeNull();
		expect(
			runReplaying(ctx, () =>
				seenRefusal(new FormData(), { team: false, copies: true }, current, {})
			)
		).toBeNull();
	});

	it("still refuses a group's row with a stale seen during a replay", () => {
		const out = runReplaying(ctx, () =>
			seenRefusal(stale, { team: true, copies: false }, current, {})
		);
		expect(out?.status).toBe(409);
		expect(out?.data).toHaveProperty('clash');
	});

	it('still says gone for an archived row during a replay', () => {
		const out = runReplaying(ctx, () =>
			seenRefusal(stale, { team: false, copies: false }, null, {})
		);
		expect(out?.status).toBe(410);
	});
});
