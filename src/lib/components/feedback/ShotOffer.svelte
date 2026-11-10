<script lang="ts">
	import { untrack } from 'svelte';
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { button } from '$lib/components/ui/styles';
	import { afterNavigate } from '$app/navigation';
	import { listenForShots, offer } from '$lib/feedback/offer.svelte';
	import { MS, reducedMotion } from '$lib/motion/motion';
	import FeedbackSheet from './FeedbackSheet.svelte';
	import { t } from '$lib/i18n/catalog';

	/**
	 * After a screenshot in the Android app: "Something wrong here?" over the
	 * bottom bars (option C of the report-a-problem board) until × is tapped, another
	 * page opens or the app goes to the background. Report opens Send feedback over this page with the screenshot on it.
	 * In a browser the app never offers one, and nothing shows.
	 */
	const w = $derived(t().feedback);
	let shown = $state<string | null>(null);
	let reporting = $state<string | null>(null);

	$effect(() => listenForShots());

	// Each new screenshot shows the card again; one from before
	// this card was drawn (the layout drew it anew) never comes back.
	const seen = untrack(() => offer.seq);
	$effect(() => {
		if (offer.seq <= seen || offer.shot === null) return;
		shown = offer.shot;
	});

	// Another page, or the app closed or put away: the card goes.
	afterNavigate((nav) => {
		if (nav.from?.url.pathname !== nav.to?.url.pathname) shown = null;
	});
	$effect(() => {
		const away = () => {
			if (document.visibilityState === 'hidden') shown = null;
		};
		document.addEventListener('visibilitychange', away);
		return () => document.removeEventListener('visibilitychange', away);
	});

	function report() {
		reporting = shown;
		shown = null;
	}

	const motion = () => ({ y: 96, duration: reducedMotion() ? 0 : MS.medium, easing: cubicOut });
</script>

{#if shown}
	<div
		role="dialog"
		aria-label={w.offer.title}
		class="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 rounded-t-3xl bg-raised px-4 pt-3.5 shadow-[0_-8px_30px_rgb(0_0_0/0.22)] desk:left-(--pane-left)"
		style:padding-bottom="calc(1.25rem + var(--safe-bottom, 0px))"
		transition:fly={motion()}
	>
		<img
			src={shown}
			alt=""
			class="h-[78px] w-9 flex-none rounded-md object-cover object-top ring-1 ring-hairline"
		/>
		<span class="flex min-w-0 flex-1 flex-col">
			<span class="text-[16px] font-bold text-ink">{w.offer.title}</span>
			<span class="text-[13px] text-muted">{w.offer.sub}</span>
		</span>
		<button type="button" class={button('primary', 'sm')} onclick={report}>{w.offer.report}</button>
		<button
			type="button"
			class="grid size-10 flex-none cursor-pointer place-items-center text-muted"
			aria-label={w.offer.close}
			onclick={() => (shown = null)}
		>
			<Icon name="close" size={20} />
		</button>
	</div>
{/if}

<FeedbackSheet open={reporting !== null} shot={reporting} here onclose={() => (reporting = null)} />
