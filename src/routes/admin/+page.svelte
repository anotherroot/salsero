<script lang="ts">
	import { enhance } from '$app/forms';
	import InviteQr from '$lib/components/admin/InviteQr.svelte';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Screen from '$lib/components/ui/Screen.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { GROUP, ROW_TALL, SECTION_LABEL, button } from '$lib/components/ui/styles';
	import LeadTile from '$lib/components/system/LeadTile.svelte';

	let invite = $state<{ url: string; qr: { size: number; cells: boolean[] } } | null>(null);
	let busy = $state(false);
	let error = $state('');
	let copied = $state(false);

	async function share() {
		if (!invite) return;
		try {
			if (typeof navigator.share === 'function') {
				await navigator.share({ title: 'Join me on the salsa app', url: invite.url });
				return;
			}
			await navigator.clipboard.writeText(invite.url);
			copied = true;
		} catch {
			// A dismissed share sheet is not an error; the link is selectable below.
		}
	}
</script>

<svelte:head><title>Admin</title></svelte:head>

<Screen title="Admin">
	{#snippet left()}
		<BandButton icon="back" label="Back to Settings" href="/settings" />
	{/snippet}

	<span class={SECTION_LABEL}>Invite someone</span>
	<form
		method="POST"
		action="?/invite"
		class={GROUP}
		use:enhance={({ cancel }) => {
			if (busy) return cancel();
			busy = true;
			error = '';
			return async ({ result }) => {
				busy = false;
				if (result.type === 'success' && result.data) {
					invite = result.data as NonNullable<typeof invite>;
					copied = false;
				} else error = 'Could not make an invite.';
			};
		}}
	>
		<button class="{ROW_TALL} w-full text-left" aria-busy={busy}>
			<LeadTile icon="plus" />
			<span class="flex min-w-0 flex-1 flex-col">
				<span class="text-[16px] font-bold text-ink">Invite someone</span>
				<span class="text-[13px] text-muted">One link, works once, for 24 hours</span>
			</span>
			{#if busy}<Spinner size={20} />{/if}
		</button>
	</form>
	{#if error}<Banner kind="error" title={error} />{/if}
</Screen>

<Sheet title="Invite someone" open={invite !== null} onclose={() => (invite = null)}>
	{#if invite}
		<div class="flex flex-col items-center gap-4 pb-4">
			<InviteQr size={invite.qr.size} cells={invite.qr.cells} />
			<p class="w-full text-[14px] break-all text-ink select-all">{invite.url}</p>
			<button type="button" class={button('primary', 'lg', true)} onclick={share}>
				<Icon name="share" size={20} />
				{copied ? 'Copied' : 'Share'}
			</button>
			<p class="text-center text-[13px] text-muted">
				Shown once. Opening this again makes a new code.
			</p>
		</div>
	{/if}
</Sheet>
