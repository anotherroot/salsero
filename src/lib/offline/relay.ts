/*
 * The relay between tabs (offline phase 3). One tab's worker owns the copy
 * (a Web Lock); another tab's worker waits. Writes run on the device first, so
 * a waiting tab asks the owning tab through a BroadcastChannel, and the owner
 * answers through its own worker. The owner also announces its state and
 * outbox, so every tab shows the same sync status.
 */
import type { DeviceIn, DeviceState, OutboxSummary } from './protocol';

export const RELAY_LIMIT_MS = 15_000;

export type RelayMessage =
	| { type: 'relay-ask'; id: string; from: string; message: DeviceIn; body?: ArrayBuffer }
	| { type: 'relay-answer'; id: string; to: string; answer: unknown }
	| { type: 'relay-state'; from: string; state: DeviceState; summary: OutboxSummary | null };

export function createRelay(o: {
	channel: Pick<BroadcastChannel, 'postMessage' | 'addEventListener' | 'close'>;
	/** This tab's id. */
	self: string;
	/** null: this tab does not own the copy, another tab answers. */
	answer: (m: DeviceIn) => Promise<unknown> | null;
	limitMs?: number;
	/** The owning tab announced its state or outbox. */
	onState?: () => void;
}): {
	ask(m: DeviceIn): Promise<unknown | null>;
	announce(state: DeviceState, summary: OutboxSummary | null): void;
	owner(): { state: DeviceState; summary: OutboxSummary | null } | null;
	close(): void;
} {
	const waiting = new Map<string, (answer: unknown) => void>();
	let owner: { state: DeviceState; summary: OutboxSummary | null } | null = null;
	let n = 0;

	o.channel.addEventListener('message', (event: Event) => {
		const m = (event as MessageEvent<RelayMessage>).data;
		if (!m || typeof m !== 'object') return;
		if (m.type === 'relay-ask' && m.from !== o.self) {
			const reply = o.answer(m.message);
			if (!reply) return;
			void reply.then(
				(answer) => o.channel.postMessage({ type: 'relay-answer', id: m.id, to: m.from, answer }),
				() => o.channel.postMessage({ type: 'relay-answer', id: m.id, to: m.from, answer: null })
			);
		} else if (m.type === 'relay-answer' && m.to === o.self) {
			waiting.get(m.id)?.(m.answer);
		} else if (m.type === 'relay-state' && m.from !== o.self) {
			owner = { state: m.state, summary: m.summary };
			o.onState?.();
		}
	});

	return {
		ask(message) {
			const id = `${o.self}-${++n}`;
			return new Promise((resolve) => {
				const timer = setTimeout(() => {
					waiting.delete(id);
					resolve(null);
				}, o.limitMs ?? RELAY_LIMIT_MS);
				waiting.set(id, (answer) => {
					clearTimeout(timer);
					waiting.delete(id);
					resolve(answer);
				});
				o.channel.postMessage({
					type: 'relay-ask',
					id,
					from: o.self,
					message
				} satisfies RelayMessage);
			});
		},
		announce(state, summary) {
			o.channel.postMessage({
				type: 'relay-state',
				from: o.self,
				state,
				summary
			} satisfies RelayMessage);
		},
		owner: () => owner,
		close() {
			for (const resolve of waiting.values()) resolve(null);
			waiting.clear();
			o.channel.close();
		}
	};
}
