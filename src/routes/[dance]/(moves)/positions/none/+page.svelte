<script lang="ts">
	import { resolve } from '$app/paths';
	import Screen from '$lib/components/ui/Screen.svelte';
	import BackButton from '$lib/components/shell/BackButton.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { GROUP, SECTION_LABEL, button } from '$lib/components/ui/styles';
	import { FITS_ANYWHERE, noPositionEmpty } from '$lib/positions/view';
	import { t } from '$lib/i18n/catalog';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const slug = $derived(data.dance.slug);
	const figureHref = (id: number) =>
		resolve('/[dance]/(moves)/figures/[id]', { dance: slug, id: String(id) });
	// "Positions" opens the figure page in edit mode (ruling 8).
	const editHref = (id: number) => `${figureHref(id)}?edit=1`;
</script>

<svelte:head><title>{t().positions.none.title} · {data.dance.label}</title></svelte:head>

<Screen title={t().positions.none.title} subtitle={data.head}>
	{#snippet left()}
		<BackButton
			fallback={{
				href: resolve('/[dance]/(moves)/positions', { dance: slug }),
				label: t().shell.backTo(t().moves.segments.positions)
			}}
		/>
	{/snippet}

	<div class="flex flex-col gap-2 pb-4">
		<div class="flex flex-col gap-1 rounded-2xl bg-accent-soft px-4 py-3.5">
			<h2 class="text-[15px] font-bold text-accent-text">{FITS_ANYWHERE.title}</h2>
			<p class="text-[14px] leading-[1.4] text-accent-text">{FITS_ANYWHERE.body}</p>
		</div>

		{#if data.empty}
			<p class="px-1 pt-2 text-[14px] text-muted">{noPositionEmpty()}</p>
		{/if}

		{#each data.groups as g (g.title)}
			<h2 class="{SECTION_LABEL} pt-3.5">{g.title}</h2>
			<ul class={GROUP}>
				{#each g.rows as f (f.id)}
					<li class="flex items-center gap-2 pr-3.5">
						<a
							class="flex min-h-16 min-w-0 flex-1 flex-col justify-center gap-0.5 py-[9px] pl-4 active:bg-step"
							href={figureHref(f.id)}
						>
							<span class="text-[16px] leading-[1.3] font-bold break-words text-ink">{f.label}</span
							>
							<span class="text-[13px] leading-[1.35] text-muted">
								{f.tag ?? f.meta}
							</span>
						</a>
						{#if f.canEdit}
							<a class={button('secondary', 'sm')} href={editHref(f.id)}
								>{t().positions.none.edit}</a
							>
						{:else}
							<span class="flex flex-none text-chevron"
								><Icon name="chevron-right" size={20} /></span
							>
						{/if}
					</li>
				{/each}
			</ul>
		{/each}
	</div>
</Screen>
