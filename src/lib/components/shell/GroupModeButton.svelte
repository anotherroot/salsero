<script lang="ts">
	import { page } from '$app/state';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import { t } from '$lib/i18n/catalog';
	import { gotoWhenSettled } from '$lib/sheets/history.svelte';
	import { workInPath, workInRows } from '$lib/teams/mode';
	import type { DanceSlug } from '$lib/dances/dances';
	import { withView } from '$lib/teams/group-view';
	import type { GroupChoice, GroupMode } from '$lib/types';

	/**
	 * The round group button in a band, beside +: Work in a group (outside) or
	 * Switch group (inside). Nothing when the person has no group to write in.
	 * One choice and not in a group's view: a link straight in. Otherwise the
	 * Work in sheet lists Mine and each group, each a link to this list in that
	 * view (`?in=`, group view spec): no state to switch, so a preload is harmless.
	 */
	const choices = $derived((page.data.groupChoices ?? []) as GroupChoice[]);
	const mode = $derived((page.data.groupMode ?? null) as GroupMode | null);
	// Beside an open item, the tab's own list: the item's own address ignores `in`.
	const to = $derived(
		workInPath(page.url.pathname, page.url.search, page.route.id, page.params.dance as DanceSlug)
	);
	const label = $derived(mode ? t().shell.groupMode.switchGroup : t().shell.groupMode.workInGroup);
	const rows = $derived(workInRows(choices, mode?.teamId ?? null, to));

	let open = $state(false);

	// Same look as BandButton: a bare icon on the band, a 44 px hit area.
	const cls =
		'flex h-11 w-11 flex-none items-center justify-center rounded-full text-band-ink active:bg-band-ink/15';

	// Close-then-go: the sheet's Back lands first, then the list in its new view.
	function pick(e: MouseEvent, href: string) {
		if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
		e.preventDefault();
		open = false;
		void gotoWhenSettled(href);
	}
</script>

{#if choices.length > 0}
	{#if choices.length === 1 && !mode}
		<a href={withView(to, choices[0].teamId)} aria-label="{label} · {choices[0].name}" class={cls}
			><Icon name="people" /></a
		>
	{:else}
		<button type="button" aria-label={label} class={cls} onclick={() => (open = true)}
			><Icon name="people" /></button
		>
		<Sheet title={t().shell.groupMode.workIn} {open} onclose={() => (open = false)}>
			<ul class="flex flex-col gap-1">
				{#each rows as row (row.teamId)}
					<li>
						<a
							href={row.href}
							onclick={(e) => pick(e, row.href)}
							aria-current={row.on ? 'true' : undefined}
							class="flex min-h-[56px] w-full items-center gap-3 rounded-xl px-3 py-2 text-left active:bg-step"
						>
							<span class="flex min-w-0 flex-1 flex-col gap-0.5">
								<span class="truncate text-[16px] leading-[1.3] font-bold text-ink">{row.name}</span
								>
								<span class="text-[13px] text-muted">{row.meta}</span>
							</span>
							{#if row.on}
								<span class="flex flex-none text-accent-text"
									><Icon name="check" size={22} /><span class="sr-only"
										>{t().shell.groupMode.workingIn}</span
									></span
								>
							{/if}
						</a>
					</li>
				{/each}
			</ul>
		</Sheet>
	{/if}
{/if}
