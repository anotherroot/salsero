<script lang="ts">
	import { enhance } from '$app/forms';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import InviteQr from '$lib/components/admin/InviteQr.svelte';
	import { button } from '$lib/components/ui/styles';
	import { desk } from '$lib/nav/desk.svelte';
	import { t } from '$lib/i18n/catalog';
	import { codeAction, copyFailed } from '$lib/teams/view';

	/**
	 * A group's code as a link and a QR. Whoever may hand it out sees it; only
	 * the owner may make a new one, which ends the old link at once. The desktop
	 * copies the link (Copy link, then Copied); the phone shares it, and copies
	 * where it cannot share (`codeAction`).
	 */
	let {
		open,
		name,
		link,
		qr,
		owner,
		onclose
	}: {
		open: boolean;
		name: string;
		link: string;
		qr: { size: number; cells: boolean[] };
		owner: boolean;
		onclose: () => void;
	} = $props();

	let copied = $state(false);
	/** The desktop's copy failed: the link is selected and a line says so. */
	let failed = $state(false);
	let making = $state(false);
	let linkEl = $state<HTMLParagraphElement>();
	/* Read when the sheet opens: it is closed at SSR, so `navigator` is there by then. */
	let canShare = $state(false);
	$effect(() => {
		if (open) {
			canShare = typeof navigator.share === 'function';
			failed = false;
		}
	});
	const action = $derived(codeAction(desk.current, canShare, copied));
	const w = $derived(t().groups.code);

	/** Select the link's text, so it can be copied by hand. */
	function selectLink() {
		const selection = window.getSelection();
		if (!linkEl || !selection) return;
		const range = document.createRange();
		range.selectNodeContents(linkEl);
		selection.removeAllRanges();
		selection.addRange(range);
	}

	async function share() {
		const onDesk = desk.current;
		try {
			if (!action.copy) {
				await navigator.share({ title: w.shareTitle(name), url: link });
				return;
			}
			await navigator.clipboard.writeText(link);
			copied = true;
			failed = false;
		} catch {
			// A dismissed share sheet is not an error; the link is selectable above.
			if (onDesk && action.copy) {
				failed = true;
				selectLink();
			}
		}
	}
</script>

<Sheet title={w.title} {open} {onclose} size="small">
	<div class="flex flex-col items-center gap-4 pb-4">
		<InviteQr size={qr.size} cells={qr.cells} label={w.qr(name)} />
		<p bind:this={linkEl} class="w-full text-[14px] break-all text-ink select-all">{link}</p>
		<button type="button" class={button('primary', 'lg', true)} onclick={share}>
			<Icon name={action.icon} size={20} />
			{action.label}
		</button>
		{#if failed && desk.current}
			<p role="alert" class="text-center text-[13px] text-danger">{copyFailed()}</p>
		{/if}
		<p class="text-center text-[13px] text-muted">
			{w.accountsOnly}
		</p>
		{#if owner}
			<form
				method="POST"
				action="?/remakeCode"
				class="flex w-full flex-col gap-2"
				use:enhance={({ cancel }) => {
					if (making) return cancel();
					making = true;
					return async ({ update }) => {
						try {
							await update();
							copied = false;
							failed = false;
						} finally {
							making = false;
						}
					};
				}}
			>
				<button type="submit" class={button('secondary', 'md', true)} aria-busy={making}>
					{#if making}<Spinner />{:else}{w.remake}{/if}
				</button>
				<p class="text-center text-[13px] text-muted">
					{w.remakeNote}
				</p>
			</form>
		{/if}
	</div>
</Sheet>
