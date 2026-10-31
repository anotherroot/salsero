<script lang="ts">
	import type { Snippet } from 'svelte';
	import { sheetStack } from '$lib/sheets/history.svelte';
	import Icon from './Icon.svelte';
	import type { IconName } from '$lib/icons/icons';

	/**
	 * A modal question: what a browser `confirm()` used to be. Registers on the
	 * same history stack as `Sheet`, so Back, Escape and the backdrop all dismiss
	 * it by going back one entry. The owner closes it from its actions.
	 */
	interface Props {
		open: boolean;
		title: string;
		body?: string;
		icon?: IconName;
		tone?: 'default' | 'danger';
		actions: Snippet;
		onclose: () => void;
	}

	let { open, title, body, icon, tone = 'default', actions, onclose }: Props = $props();
	let dialog: HTMLDialogElement | undefined = $state();
	let key: number | null = null;

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) {
			dialog.showModal();
			key = sheetStack.open({ tryLeave: (leave) => leave(), close: () => onclose() });
		}
		if (!open && dialog.open) {
			dialog.close();
			release();
		}
	});

	function release() {
		if (key === null) return;
		const k = key;
		key = null;
		sheetStack.closedByOwner(k);
	}
	$effect(() => release);

	function tryClose() {
		if (key !== null) sheetStack.requestClose(key);
		else onclose();
	}
</script>

<dialog
	bind:this={dialog}
	aria-labelledby="dlg-title"
	aria-describedby={body ? 'dlg-body' : undefined}
	role="alertdialog"
	onclose={() => {
		release();
		onclose();
	}}
	oncancel={(e) => {
		e.preventDefault();
		tryClose();
	}}
	onclick={(e) => {
		if (e.target === dialog) tryClose();
	}}
>
	{#if open}
		<div class="flex flex-col gap-3 px-6 pt-6 pb-4">
			{#if icon}
				<span
					class="grid size-12 place-items-center rounded-full {tone === 'danger'
						? 'bg-danger-soft text-danger'
						: 'bg-accent-soft text-accent-text'}"
				>
					<Icon name={icon} />
				</span>
			{/if}
			<h2 id="dlg-title" class="font-display text-[22px] leading-tight font-extrabold text-ink">
				{title}
			</h2>
			{#if body}
				<p id="dlg-body" class="text-[15px] leading-[1.45] text-ink-2">{body}</p>
			{/if}
			<div class="mt-2 -mr-2 flex flex-wrap justify-end gap-2">{@render actions()}</div>
		</div>
	{/if}
</dialog>

<style>
	dialog {
		margin: auto;
		width: calc(100% - 48px);
		max-width: 330px;
		padding: 0;
		border: none;
		border-radius: 22px;
		background: var(--color-raised);
		color: var(--color-ink);
		box-shadow: 0 20px 50px rgb(0 0 0 / 0.3);
	}

	dialog::backdrop {
		background: rgb(0 0 0 / 0.45);
	}
</style>
