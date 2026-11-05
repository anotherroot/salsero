<script lang="ts">
	import { resolve } from '$app/paths';
	import Screen from '$lib/components/ui/Screen.svelte';
	import BackButton from '$lib/components/shell/BackButton.svelte';
	import PositionMap from '$lib/components/positions/PositionMap.svelte';
	import { button } from '$lib/components/ui/styles';
	import { TONE_VAR } from '$lib/positions/map-view';
	import { MAP, noPositionChip, unusedChip } from '$lib/positions/view';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const dance = $derived(data.dance.slug);
	const list = $derived(resolve('/[dance]/(moves)/positions', { dance }));
	const byId = $derived(new Map(data.positions.map((p) => [p.id, p])));
	const islands = $derived(data.layout.tray.islands.map((id) => byId.get(id)!));
	const unused = $derived(data.layout.tray.unused.map((id) => byId.get(id)!));
	const hrefOf = (id: number) =>
		resolve('/[dance]/(moves)/positions/[id]', { dance, id: String(id) });

	const TRAY_CHIP =
		'inline-flex min-h-9 items-center gap-2 rounded-full border-[1.6px] px-3.5 text-[13px] font-extrabold text-ink-2 active:bg-step';
	const TRAY_HEAD = 'text-[11px] font-extrabold tracking-[0.06em] uppercase';
</script>

<svelte:head><title>{MAP.title} · {data.dance.label}</title></svelte:head>

<!-- Figures with no arrow, and positions with no figures: shown even before any position exists. -->
{#snippet notOnMap()}
	{#if data.noPosition > 0 || unused.length > 0}
		<section class="flex flex-col gap-2.5 rounded-2xl bg-surface p-4">
			<h2 class="{TRAY_HEAD} text-muted">{MAP.notOnMap}</h2>
			<div class="flex flex-wrap gap-2">
				{#if data.noPosition > 0}
					<a
						class="{TRAY_CHIP} border-dashed border-field-line"
						href={resolve('/[dance]/(moves)/positions/none', { dance })}
						>{noPositionChip(data.noPosition)}</a
					>
				{/if}
				{#each unused as p (p.id)}
					<a class="{TRAY_CHIP} border-danger" href={hrefOf(p.id)}>{unusedChip(p.name)}</a>
				{/each}
			</div>
			{#if data.noPosition > 0}
				<p class="text-[12px] font-semibold text-muted">{MAP.fitsAnywhere}</p>
			{/if}
		</section>
	{/if}
{/snippet}

<Screen title={MAP.title} subtitle={data.summary}>
	{#snippet left()}
		<BackButton fallback={{ href: list, label: MAP.back }} />
	{/snippet}

	{#if data.empty}
		<div class="flex flex-col items-start gap-3 px-1 pt-2">
			<p class="text-[14px] leading-[1.45] text-ink-2">{MAP.empty}</p>
			<a class={button('secondary', 'sm')} href={list}>{MAP.back}</a>
		</div>
		<div class="flex flex-col gap-3 pt-3 pb-4">
			{@render notOnMap()}
		</div>
	{:else}
		<div class="flex flex-col gap-3 pb-4">
			{#if data.layout.nodes.length > 0}
				<PositionMap
					{dance}
					layout={data.layout}
					positions={data.positions}
					edges={data.edges}
					label={data.mapLabel}
				/>
			{:else}
				<p class="px-1 text-[14px] leading-[1.45] text-ink-2">{MAP.unjoined}</p>
			{/if}

			{@render notOnMap()}

			{#if islands.length > 0}
				<section class="flex flex-col gap-2.5 rounded-2xl bg-surface p-4">
					<h2 class="{TRAY_HEAD} text-muted">{MAP.islands}</h2>
					<div class="flex flex-wrap gap-2">
						{#each islands as p (p.id)}
							<a class="{TRAY_CHIP} border-field-line" href={hrefOf(p.id)} aria-label={p.ariaLabel}>
								<span
									aria-hidden="true"
									class="size-3 flex-none rounded-full"
									style:background="color-mix(in srgb, {TONE_VAR[p.tone]} 20%, transparent)"
									style:box-shadow="inset 0 0 0 2px {TONE_VAR[p.tone]}"
								></span>{p.label}
							</a>
						{/each}
					</div>
				</section>
			{/if}

			<div class="flex flex-wrap gap-x-[18px] gap-y-2 px-1 text-[13px] font-semibold text-muted">
				{#each data.types as t (t.key)}
					<span class="inline-flex items-center gap-1.5">
						<span
							aria-hidden="true"
							class="size-3 rounded-full"
							style:background="color-mix(in srgb, {TONE_VAR[t.tone]} 20%, transparent)"
							style:box-shadow="inset 0 0 0 2px {TONE_VAR[t.tone]}"
						></span>{t.label}
					</span>
				{/each}
				{#if !data.groupMode}
					<span class="inline-flex items-center gap-1.5">
						<span aria-hidden="true" class="size-3.5 rounded-full border-2 border-danger"
						></span>{MAP.legend.deadEnd}
					</span>
					<span class="inline-flex items-center gap-1.5">
						<span
							aria-hidden="true"
							class="size-3.5 rounded-full border-2 border-dashed border-danger"
						></span>{MAP.legend.orphan}
					</span>
				{/if}
				<span class="inline-flex items-center gap-1.5">
					<span aria-hidden="true" class="size-3.5 rounded-full border-2 border-dotted border-muted"
					></span>{MAP.legend.island}
				</span>
				<span>{MAP.legend.size}</span>
			</div>
		</div>
	{/if}
</Screen>
