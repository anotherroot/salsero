<!--
	A thin bar along the top while any navigation is in flight — the first
	sign a tap landed, before the skeleton (see `$lib/nav/pending.ts`). It
	takes no space and no taps. Decorative: the skeleton carries the
	"Loading…" for screen readers.
-->
<div
	class="pointer-events-none fixed inset-x-0 z-50 h-[3px] overflow-hidden"
	style="top: env(safe-area-inset-top)"
	aria-hidden="true"
>
	<div class="run h-full w-2/5 bg-accent"></div>
</div>

<style>
	.run {
		animation: run 1.1s ease-in-out infinite;
	}
	@keyframes run {
		from {
			transform: translateX(-100%);
		}
		to {
			transform: translateX(250%);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.run {
			width: 100%;
			opacity: 0.6;
			animation: none;
		}
	}
</style>
