<script lang="ts">
	import Toast from '$lib/components/ui/Toast.svelte';
	import { actAt } from '$lib/act';
	import { offlineRefusal, refusalMessage } from '$lib/act-toast';
	import { saved } from '$lib/exercises/saved.svelte';
	import { pinned } from '$lib/nav/chrome.svelte';
	import { t } from '$lib/i18n/catalog';

	/*
	 * "Saved · back in 12 days · Undo" on whatever screen comes after a save
	 * (`announceSaved`). Mounted once, by the [dance] layout, so it outlives the
	 * page that saved. Undo puts the day back as it was (Today's `undoDone`).
	 */

	/** Undo's refusal, as a plain toast. A negative id never meets a save's. */
	let failed = $state<{ id: number; message: string } | null>(null);
	let failedSeq = 0;

	// A new save takes the place of an Undo refusal still showing.
	$effect(() => {
		if (saved.current) failed = null;
	});

	const toast = $derived.by(() => {
		if (failed) return failed;
		const s = saved.current;
		if (!s) return null;
		return {
			id: s.id,
			message: s.message,
			icon: 'check' as const,
			tone: 'done' as const,
			action: s.undo ? t().common.undo : undefined
		};
	});

	async function undo() {
		const s = saved.current;
		// The toast goes at the tap, Undo with it, so it cannot be sent twice.
		saved.dismiss();
		if (!s?.undo) return;
		const result = await actAt(`/${s.dance}`, 'undoDone', {
			setId: s.undo.setId,
			before: s.undo.before ?? ''
		});
		const message = refusalMessage(result, t().today.refused.undo);
		if (message && !offlineRefusal(result)) failed = { id: -++failedSeq, message };
	}
</script>

<!-- Above a pinned bar (the next exercise's Done), as the exercise page's own toast sits. -->
<Toast
	{toast}
	bottom={pinned.bar
		? 'calc(5.75rem + var(--pin-bottom, 0px) + var(--pin-safe, var(--safe-bottom)))'
		: undefined}
	onaction={undo}
	ondismiss={() => {
		if (failed) failed = null;
		else saved.dismiss();
	}}
/>
