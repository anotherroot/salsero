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
		/** Takes no taps for now (listening, between spots): drawn greyed and a little smaller. */
		locked?: boolean;
		/** Changes when the pad wakes: it bounces back. */
		bounce?: number;
		/** `timeStamp` is the event's: when the finger (or key) went down, not when this ran. */
		ontap: (timeStamp: number) => void;
	}

	let { label, sub, disabled = false, locked = false, bounce = 0, ontap }: Props = $props();
	let el = $state<HTMLButtonElement>();
	$effect(() => {
		if (!bounce || !el) return;
		el.classList.remove('bounce');
		void el.offsetWidth;
		el.classList.add('bounce');
	});
	let rings = $state<number[]>([]);
	let next = 0;

	function down(e: Event) {
		if (disabled) return;
		e.preventDefault();
		if (locked) return;
		ontap(e.timeStamp);
		const id = next++;
		rings = [...rings.slice(-3), id];
		setTimeout(() => (rings = rings.filter((r) => r !== id)), 400);
	}
</script>

<button
	bind:this={el}
	type="button"
	class={TAP_PAD}
	class:locked
	aria-disabled={locked || undefined}
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
	.locked {
		opacity: 0.45;
		transform: scale(0.97);
		cursor: default;
	}
	button {
		transition:
			opacity 0.3s ease,
			transform 0.3s ease;
	}
	button:global(.bounce) {
		animation: bounce 0.45s cubic-bezier(0.2, 1.5, 0.4, 1);
	}
	@keyframes bounce {
		0% {
			transform: scale(0.94);
		}
		60% {
			transform: scale(1.03);
		}
		100% {
			transform: scale(1);
		}
	}
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
		button:global(.bounce) {
			animation: none;
		}
		.tap-ring {
			animation: none;
			opacity: 0;
		}
	}
</style>
