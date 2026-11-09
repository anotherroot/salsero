/*
 * The replay of an offline change (offline phase 3): while the server runs an
 * outbox entry's action, `serverNow()` reads when the change was made on the
 * device, `mintId` hands out the ids the device minted, Keep in step's flows
 * wait until the per-field merge is done, and a taken name is suffixed rather
 * than refused. An AsyncLocalStorage, so two replays never see each other's
 * entry across awaits. On the device the store is a stub, and nothing runs a
 * replay there.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import type { CloneKind } from '$lib/types';
import { suffixed } from './clones/names';

export type ReplayContext = {
	entryId: string;
	madeAt: number;
	/** The entry's minted ids per table, taken in order by mintId. */
	minted: Map<string, number[]>;
	/** The flows the actions asked for, run by the replay after the merge. */
	flows: { actorId: string; kind: CloneKind; id: number }[];
	/** True while the action runs; false while the replay runs the deferred flows. */
	deferFlows: boolean;
};

const store = new AsyncLocalStorage<ReplayContext>();

/** The entry being replayed, or undefined outside a replay. */
export function replaying(): ReplayContext | undefined {
	return store.getStore();
}

export function runReplaying<T>(ctx: ReplayContext, fn: () => T): T {
	return store.run(ctx, fn);
}

/** On replay, a taken name becomes `suffixed` (two offline devices made the same one); otherwise the name as it is. */
export function replayName(name: string, taken: (n: string) => boolean): string {
	return replaying() ? suffixed(name, taken) : name;
}
