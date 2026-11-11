<script lang="ts">
	import { TAP_PAD, TAP_RING } from './styles';

	/**
	 * The one big tap area. It answers on `pointerdown`, not click: a click
	 * lands when the finger lifts, ~100 ms after the tap the person meant.
	 */
	interface Props {
		label: string;
		sub?: string;
		disabled?: boolean;
		/** `timeStamp` is the event's: when the finger (or key) went down, not when this ran. */
		ontap: (timeStamp: number) => void;
	}

	let { label, sub, disabled = false, ontap }: Props = $props();
	let rings = $state<number[]>([]);
	let next = 0;

	function down(e: Event) {
		if (disabled) return;
		e.preventDefault();
		ontap(e.timeStamp);
		const id = next++;
		rings = [...rings.slice(-3), id];
		setTimeout(() => (rings = rings.filter((r) => r !== id)), 400);
	}
</script>

<button
	type="button"
	class={TAP_PAD}
	{disabled}
	onpointerdown={down}
	onkeydown={(e) => {
		// The keyboard taps too (space, enter), on the work PC.
		if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
			down(e);
		}
	}}
>
	{#each rings as id (id)}
		<span class="{TAP_RING} tap-ring" aria-hidden="true"></span>
	{/each}
	<span class="relative font-display text-[22px] font-extrabold">{label}</span>
	{#if sub}<span class="relative text-[14px] text-muted">{sub}</span>{/if}
</button>

<style>
	.tap-ring {
		animation: tap-ring 400ms ease-out forwards;
	}
	@keyframes tap-ring {
		from {
			opacity: 0.5;
			transform: scale(0.6);
		}
		to {
			opacity: 0;
			transform: scale(1.5);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.tap-ring {
			animation: none;
			opacity: 0;
		}
	}
</style>
