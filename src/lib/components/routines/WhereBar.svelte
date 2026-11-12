<script lang="ts">
	/**
	 * "Where am I" (spec 2026-11-12, routine sections, G3's bar): once the top
	 * of the screen is inside a section opened in place, a bar under the band
	 * names the levels you are in, the deepest three with "n more above". Read
	 * from the `data-path` the panels put on their rows; gone outside them.
	 * Never at the very top edge: it sits under whatever band is fixed there.
	 */
	import { onMount } from 'svelte';
	import { t } from '$lib/i18n/catalog';
	import { wherePath } from '$lib/routines/panels';

	type Step = { name: string; hue: string };
	let chain = $state<Step[]>([]);
	let top = $state(0);

	const HUE: Record<string, string> = {
		h1: 'var(--color-accent)',
		h2: 'var(--color-warn)',
		h3: '#7c3b61',
		h4: 'var(--color-easy)',
		rt: 'var(--color-muted)'
	};

	/** The bottom of whatever is fixed or sticky at the top of the screen (the band). */
	function bandBottom(): number {
		let bottom = 0;
		for (const el of document.elementsFromPoint(innerWidth / 2, 2)) {
			const pos = getComputedStyle(el).position;
			if (pos === 'fixed' || pos === 'sticky')
				bottom = Math.max(bottom, el.getBoundingClientRect().bottom);
		}
		return bottom;
	}

	function update() {
		top = bandBottom();
		const under = top + 4;
		let found: Step[] = [];
		for (const el of document.querySelectorAll<HTMLElement>('[data-path]')) {
			const r = el.getBoundingClientRect();
			if (r.bottom > under && r.top <= under + 40) {
				found = JSON.parse(el.dataset.path ?? '[]');
				break;
			}
		}
		chain = found;
	}

	onMount(() => {
		update();
		addEventListener('scroll', update, { passive: true });
		return () => removeEventListener('scroll', update);
	});

	const view = $derived(wherePath(chain));
</script>

{#if chain.length > 0}
	<div
		class="fixed inset-x-0 z-20 border-b border-hairline bg-surface px-4 py-1 shadow-[0_6px_14px_rgb(0_0_0/0.06)]"
		style="top: {top}px"
		role="status"
		aria-label={t().routine.section.where}
	>
		{#if view.more > 0}
			<p class="py-0.5 text-[12px] font-semibold text-muted">
				{t().routine.section.more(view.more)}
			</p>
		{/if}
		{#each view.rows as step, k (k)}
			<p
				class="flex items-center gap-2 py-0.5 text-[12.5px] font-bold {k === view.rows.length - 1
					? 'text-accent-text'
					: 'text-ink'}"
			>
				<span class="size-2 shrink-0 rounded-full" style="background: {HUE[step.hue]}"></span>
				<span class="min-w-0 flex-1 truncate">{step.name}</span>
				{#if k === view.rows.length - 1}<span class="text-[11px] font-semibold text-muted"
						>{t().routine.section.level(chain.length)}</span
					>{/if}
			</p>
		{/each}
	</div>
{/if}
