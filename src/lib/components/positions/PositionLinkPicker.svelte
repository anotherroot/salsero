<script lang="ts">
	import type { Snippet } from 'svelte';
	import { enhance } from '$app/forms';
	import { SvelteSet } from 'svelte/reactivity';
	import Picker from '$lib/components/picker/Picker.svelte';
	import type { IconName } from '$lib/icons/icons';
	import type { PickGroup, PickRow } from '$lib/picker/model';
	import { linkSubmit } from '$lib/picker/link-submit';

	/**
	 * A position page's link picker (Link a section or point…, Link a lesson…):
	 * the shared picker, kind "link". A tap links and closes; + links and keeps
	 * picking; Done · N linked closes. A link posts `field` = the row's value
	 * to `action` through a hidden form (`use:enhance`, nothing typed to lose);
	 * the page's data comes back with the row marked ✓ Linked. A refusal keeps
	 * the picker open with the server's message, as `LinkSectionSheet` does.
	 */
	interface Props {
		open: boolean;
		onclose: () => void;
		title: string;
		sub?: string;
		placeholder: string;
		groups: PickGroup[];
		nothingLeft: string;
		emptyIcon?: IconName;
		/** The page action: `?/linkSpot` or `?/linkLesson`. */
		action: string;
		/** The posted id's field: `spotId` or `lessonId`. */
		field: string;
		top?: Snippet;
		onpreview?: (row: PickRow) => void;
	}

	let {
		open,
		onclose,
		title,
		sub,
		placeholder,
		groups,
		nothingLeft,
		emptyIcon,
		action,
		field,
		top,
		onpreview
	}: Props = $props();

	/** How many + this opening has linked. */
	let added = $state(0);
	let message = $state<string | null>(null);
	/** Counts openings, so an answer that lands after a close is not counted in the next one. */
	let opening = 0;
	let linkForm: HTMLFormElement | undefined = $state();
	let idInput: HTMLInputElement | undefined = $state();
	const inFlight = new SvelteSet<string>();
	/** What the hidden form is about to send; read by its submit, synchronously. */
	let sending: { key: string; label: string; keep: boolean } | null = null;

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
		if (!linkForm || !idInput || inFlight.has(row.key)) return;
		idInput.value = String(row.value);
		sending = { key: row.key, label: row.label, keep };
		linkForm.requestSubmit();
	}

	const submit = linkSubmit({
		take: () => {
			const s = sending;
			sending = null;
			return s;
		},
		opening: () => opening,
		inFlight,
		setMessage: (m) => (message = m),
		added: () => (added += 1),
		close
	});
</script>

<form bind:this={linkForm} method="POST" {action} hidden use:enhance={submit}>
	<input bind:this={idInput} type="hidden" name={field} />
</form>

<Picker
	{open}
	{title}
	{sub}
	{placeholder}
	kind="link"
	pending={inFlight}
	{emptyIcon}
	{groups}
	{nothingLeft}
	{added}
	{message}
	{top}
	onpick={(row) => link(row, false)}
	onadd={(row) => link(row, true)}
	{onpreview}
	ondone={close}
	onclose={close}
/>
