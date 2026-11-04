<script lang="ts">
	import { enhance } from '$app/forms';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import InviteQr from '$lib/components/admin/InviteQr.svelte';
	import { button } from '$lib/components/ui/styles';

	/**
	 * A group's code as a link and a QR. Whoever may hand it out sees it; only
	 * the owner may make a new one, which ends the old link at once.
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
	let making = $state(false);

	async function share() {
		try {
			if (typeof navigator.share === 'function') {
				await navigator.share({ title: `Join ${name}`, url: link });
				return;
			}
			await navigator.clipboard.writeText(link);
			copied = true;
		} catch {
			// A dismissed share sheet is not an error; the link is selectable below.
		}
	}
</script>

<Sheet title="Group code" {open} {onclose}>
	<div class="flex flex-col items-center gap-4 pb-4">
		<InviteQr size={qr.size} cells={qr.cells} label="QR code for joining {name}" />
		<p class="w-full text-[14px] break-all text-ink select-all">{link}</p>
		<button type="button" class={button('primary', 'lg', true)} onclick={share}>
			<Icon name="share" size={20} />
			{copied ? 'Copied' : 'Share'}
		</button>
		<p class="text-center text-[13px] text-muted">
			Only people who already have an account can join with it.
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
						} finally {
							making = false;
						}
					};
				}}
			>
				<button type="submit" class={button('secondary', 'md', true)} aria-busy={making}>
					{#if making}<Spinner />{:else}Make a new code{/if}
				</button>
				<p class="text-center text-[13px] text-muted">
					The old link and QR stop working. People already in the group stay.
				</p>
			</form>
		{/if}
	</div>
</Sheet>
