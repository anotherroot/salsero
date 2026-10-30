<!-- src/lib/components/ui/LinkSectionSheet.svelte -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import Picker from '$lib/components/picker/Picker.svelte';
	import { sectionGroups } from '$lib/picker/build';
	import type { PickRow } from '$lib/picker/model';
	import SectionPlayer from './SectionPlayer.svelte';
	import type { SectionGroup, SectionVideo, Spot } from '$lib/types';

	/**
	 * "Link a section": the shared picker over every section of the dance, the
	 * lessons this is taught in first, the ones already linked greyed. A tap
	 * links and closes; + links and keeps picking; ▶ previews one, looping. A
	 * link posts `spotId` with the page's own `hidden` fields to `?/linkSection`
	 * through a hidden form (`use:enhance`, nothing typed to lose). A refused
	 * link keeps the picker open with the server's message.
	 */
	interface Props {
		open: boolean;
		onclose: () => void;
		groups: SectionGroup[];
		hidden: Record<string, string | number>;
	}

	let { open, onclose, groups, hidden }: Props = $props();

	let preview = $state<{ video: SectionVideo; spot: Spot } | null>(null);
	/** How many + this opening has linked. */
	let added = $state(0);
	let message = $state<string | null>(null);
	/** Counts openings, so an answer that lands after a close is not counted in the next one. */
	let opening = 0;
	let linkForm: HTMLFormElement | undefined = $state();
	let spotInput: HTMLInputElement | undefined = $state();
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const inFlight = new Set<string>();
	/** What the hidden form is about to send; read by its submit, synchronously. */
	let sending: { key: string; keep: boolean } | null = null;

	// Every opening starts clean; a close of any kind fences off late answers.
	let wasOpen = false;
	$effect(() => {
		if (open !== wasOpen) {
			wasOpen = open;
			opening += 1;
			added = 0;
			message = null;
		}
	});

	function close() {
		opening += 1;
		added = 0;
		message = null;
		onclose();
	}

	function link(row: PickRow, keep: boolean) {
		if (!linkForm || !spotInput || inFlight.has(row.key)) return;
		spotInput.value = String(row.value);
		sending = { key: row.key, keep };
		linkForm.requestSubmit();
	}

	const submit: SubmitFunction = () => {
		const sent = sending;
		sending = null;
		const at = opening;
		if (sent) inFlight.add(sent.key);
		message = null;
		return async ({ result, update }) => {
			if (sent) inFlight.delete(sent.key);
			const here = at === opening;
			if (result.type === 'failure' || result.type === 'error') {
				const m =
					result.type === 'failure'
						? (result.data as { message?: unknown } | undefined)?.message
						: (result.error as { message?: unknown } | undefined)?.message;
				if (here) message = typeof m === 'string' ? m : 'That could not be linked.';
				return;
			}
			await update();
			if (result.type !== 'success' || !here || !sent) return;
			if (sent.keep) added += 1;
			else close();
		};
	};

	function previewRow(row: PickRow) {
		for (const g of groups) {
			const spot = g.sections.find((s) => s.id === row.value);
			if (spot) {
				preview = { video: g.video, spot };
				return;
			}
		}
	}
</script>

<form bind:this={linkForm} method="POST" action="?/linkSection" hidden use:enhance={submit}>
	{#each Object.entries(hidden) as [name, value] (name)}
		<input type="hidden" {name} {value} />
	{/each}
	<input bind:this={spotInput} type="hidden" name="spotId" />
</form>

<Picker
	{open}
	title="Link a section"
	placeholder="Search sections"
	kind="link"
	groups={sectionGroups(groups, 'In this lesson')}
	nothingLeft="No sections to link. Open a lesson video full screen and tap Section to mark one."
	{added}
	{message}
	onpick={(row) => link(row, false)}
	onadd={(row) => link(row, true)}
	onpreview={previewRow}
	ondone={close}
	onclose={close}
/>

{#if preview}
	<SectionPlayer
		src={preview.video.src}
		owner={preview.video.owner}
		spot={preview.spot}
		from={preview.video.from}
		onclose={() => (preview = null)}
	/>
{/if}
