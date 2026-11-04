<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import type { SubmitFunction } from '@sveltejs/kit';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import { gotoWhenSettled } from '$lib/sheets/history.svelte';
	import { workInRows } from '$lib/teams/mode';
	import type { GroupChoice, GroupMode } from '$lib/types';

	/**
	 * The round group button in a band, beside +: Work in a group (outside) or
	 * Switch group (inside). Nothing when the person has no group to write in.
	 * One choice and not in group mode: a tap goes straight in. Otherwise the
	 * Work in sheet lists Mine and each group; each row is a one-tap form.
	 */
	const choices = $derived((page.data.groupChoices ?? []) as GroupChoice[]);
	const mode = $derived((page.data.groupMode ?? null) as GroupMode | null);
	const action = $derived(`/${page.params.dance}/group-mode`);
	const to = $derived(page.url.pathname);
	const label = $derived(mode ? 'Switch group' : 'Work in a group');
	const rows = $derived(workInRows(choices, mode?.teamId ?? null));

	let open = $state(false);

	// Same look as BandButton: a bare icon on the band, a 44 px hit area.
	const cls =
		'flex h-11 w-11 flex-none items-center justify-center rounded-full text-band-ink active:bg-band-ink/15';

	// The switch is a page action that redirects. Close-then-go: the sheet's
	// Back lands first, then the switch's page loads with fresh layout data
	// (a plain update() would race that Back and could be dropped).
	const pick: SubmitFunction = () => {
		return async ({ result, update }) => {
			open = false;
			if (result.type === 'redirect') {
				await gotoWhenSettled(result.location, { invalidateAll: true });
				return;
			}
			await update({ reset: false });
		};
	};
</script>

{#if choices.length > 0}
	{#if choices.length === 1 && !mode}
		<form method="POST" {action} use:enhance>
			<input type="hidden" name="team" value={choices[0].teamId} />
			<input type="hidden" name="to" value={to} />
			<button type="submit" aria-label="{label} · {choices[0].name}" class={cls}
				><Icon name="people" /></button
			>
		</form>
	{:else}
		<button type="button" aria-label={label} class={cls} onclick={() => (open = true)}
			><Icon name="people" /></button
		>
		<Sheet title="Work in" {open} onclose={() => (open = false)}>
			<ul class="flex flex-col gap-1">
				{#each rows as row (row.teamId)}
					<li>
						<form method="POST" {action} use:enhance={pick}>
							<input type="hidden" name="team" value={row.teamId} />
							<input type="hidden" name="to" value={to} />
							<button
								type="submit"
								aria-current={row.on ? 'true' : undefined}
								class="flex min-h-[56px] w-full items-center gap-3 rounded-xl px-3 py-2 text-left active:bg-step"
							>
								<span class="flex min-w-0 flex-1 flex-col gap-0.5">
									<span class="truncate text-[16px] leading-[1.3] font-bold text-ink"
										>{row.name}</span
									>
									<span class="text-[13px] text-muted">{row.meta}</span>
								</span>
								{#if row.on}
									<span class="flex flex-none text-accent-text"
										><Icon name="check" size={22} /><span class="sr-only">Working in</span></span
									>
								{/if}
							</button>
						</form>
					</li>
				{/each}
			</ul>
		</Sheet>
	{/if}
{/if}
