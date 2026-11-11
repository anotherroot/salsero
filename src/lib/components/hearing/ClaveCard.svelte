<script lang="ts">
	import type { ClavePattern } from '$lib/labels';
	import { button } from '$lib/components/ui/styles';
	import { CLAVE_POSITIONS } from '$lib/scheduler/scheduler';
	import { t } from '$lib/i18n/catalog';
	import PatternRows from './PatternRows.svelte';

	/** Where the clave's five hits fall, drawn on the eight, and Hear it (spec 1b.8). */
	interface Props {
		clave: ClavePattern;
		onhear: () => void;
	}

	let { clave, onhear }: Props = $props();
	const w = $derived(t().hearing.clave);
	const positions = $derived(CLAVE_POSITIONS[clave]);
	const filled = $derived(Object.fromEntries(positions.map((p) => [p, 'filled' as const])));
</script>

<div class="flex flex-col gap-1.5 rounded-2xl bg-surface p-3">
	<p class="text-[15px] font-extrabold text-ink">{clave === '2-3' ? w.t23 : w.t32}</p>
	<p class="text-[13px] leading-snug text-ink-2">{clave === '2-3' ? w.p23 : w.p32}</p>
	<PatternRows {positions} rows={[filled]} labels={['']} label={clave === '2-3' ? w.p23 : w.p32} />
	<button type="button" class={button('secondary', 'md', true)} onclick={onhear}>{w.hear}</button>
</div>
