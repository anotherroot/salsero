<script lang="ts">
	import { enhance } from '$app/forms';
	import { LIMIT_PRESETS_GB, personMeta, presetLabel, requestUsesLine } from '$lib/admin-view';
	import { guarded } from '$lib/unsaved/guard.svelte';
	import type { PageData } from './$types';
	import InviteQr from '$lib/components/admin/InviteQr.svelte';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Screen from '$lib/components/ui/Screen.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { FIELD, GROUP, LABEL, ROW_TALL, SECTION_LABEL, button } from '$lib/components/ui/styles';
	import LeadTile from '$lib/components/system/LeadTile.svelte';

	let { data }: { data: PageData } = $props();
	let person = $state<PageData['people'][number] | null>(null);
	let formError = $state('');
	let requestErrors = $state<Record<number, string>>({});
	let sending = $state(false);

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

{#snippet limitFields()}
	<!-- Enter in the number field presses the first submit button: this unnamed one, so only gb is sent -->
	<button type="submit" class="sr-only" tabindex="-1" aria-hidden="true">Set</button>
	<div class="flex flex-wrap gap-2">
		{#each LIMIT_PRESETS_GB as gb (gb)}
			<button type="submit" name="preset" value={gb} class={button('secondary', 'sm')}>
				{presetLabel(gb)}
			</button>
		{/each}
	</div>
	<label class="block">
		<span class={LABEL}>Or a number of GB</span>
		<input name="gb" type="number" inputmode="decimal" min="0.1" step="any" class={FIELD} />
	</label>
{/snippet}

<svelte:head><title>Admin</title></svelte:head>

<Screen title="Admin">
	{#snippet left()}
		<BandButton icon="back" label="Back to Settings" href="/settings" />
	{/snippet}

	{#if data.requests.length > 0}
		<span class={SECTION_LABEL}>Waiting</span>
		{#each data.requests as r (r.id)}
			<div class="{GROUP} flex flex-col gap-3 p-4">
				<div class="flex flex-col">
					<span class="text-[16px] font-bold break-all text-ink">{r.email}</span>
					<span class="text-[13px] text-muted">{requestUsesLine(r.usedBytes, r.limitBytes)}</span>
					{#if r.note}<p class="mt-1 text-[14px] break-words whitespace-pre-wrap text-ink-2">
							{r.note}
						</p>{/if}
				</div>
				<form
					method="POST"
					action="?/grant"
					class="flex flex-col gap-3"
					use:guarded={{
						label: 'Give more',
						submit: ({ cancel }) => {
							if (sending) return cancel();
							sending = true;
							requestErrors[r.id] = '';
							return async ({ result, update }) => {
								if (result.type === 'failure')
									requestErrors[r.id] = String(result.data?.message ?? 'It did not save.');
								try {
									await update();
								} finally {
									sending = false;
								}
							};
						}
					}}
				>
					<input type="hidden" name="id" value={r.id} />
					{@render limitFields()}
					<button type="submit" class={button('primary', 'md', true)} aria-busy={sending}>
						Give more
					</button>
				</form>
				<form
					method="POST"
					action="?/decline"
					use:enhance={({ cancel }) => {
						if (sending) return cancel();
						sending = true;
						requestErrors[r.id] = '';
						return async ({ result, update }) => {
							if (result.type === 'failure')
								requestErrors[r.id] = String(result.data?.message ?? 'It did not save.');
							try {
								await update();
							} finally {
								sending = false;
							}
						};
					}}
				>
					<input type="hidden" name="id" value={r.id} />
					<button type="submit" class={button('tertiary', 'md', true)}>Decline</button>
				</form>
				{#if requestErrors[r.id]}<Banner kind="error" title={requestErrors[r.id]} />{/if}
			</div>
		{/each}
	{/if}

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

	<span class="{SECTION_LABEL} mt-[14px]">People</span>
	<div class={GROUP}>
		{#each data.people as p (p.id)}
			<button
				type="button"
				class="{ROW_TALL} w-full text-left"
				onclick={() => {
					formError = '';
					person = p;
				}}
			>
				<span class="flex min-w-0 flex-1 flex-col">
					<span class="text-[16px] font-bold break-all text-ink">{p.email}</span>
					<span class="text-[13px] text-muted">{personMeta(p)}</span>
				</span>
				<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
			</button>
		{/each}
	</div>
</Screen>

<Sheet title={person?.email ?? 'Limit'} open={person !== null} onclose={() => (person = null)}>
	{#if person}
		<form
			method="POST"
			action="?/setLimit"
			class="flex flex-col gap-3.5 pb-4"
			use:guarded={{
				label: 'Set limit',
				submit: ({ cancel }) => {
					if (sending) return cancel();
					sending = true;
					formError = '';
					return async ({ result, update }) => {
						if (result.type === 'failure')
							formError = String(result.data?.message ?? 'It did not save.');
						try {
							await update();
							if (result.type === 'success') person = null;
						} finally {
							sending = false;
						}
					};
				}
			}}
		>
			{#if formError}<Banner kind="error" title={formError} />{/if}
			<input type="hidden" name="userId" value={person.id} />
			<p class="text-[14px] text-muted">{personMeta(person)}</p>
			{@render limitFields()}
			<button type="submit" name="none" value="1" class={button('secondary', 'md', true)}>
				No limit
			</button>
		</form>
	{/if}
</Sheet>

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
