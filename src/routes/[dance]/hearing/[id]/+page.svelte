<script lang="ts">
	import { resolve } from '$app/paths';
	import { goBack } from '$lib/nav/trail.svelte';
	import ListenPage from '$lib/components/hearing/ListenPage.svelte';
	import { leaveRound } from '$lib/hearing/handoff';
	import type { HearingRound } from '$lib/hearing/drill';
	import { t } from '$lib/i18n/catalog';
	import type { PageData } from './$types';

	/**
	 * A hearing drill's round (phase 2): its settings, its songs. Done hands the
	 * round back to the drill's page, whose Done sheet saves it with the face.
	 */
	let { data }: { data: PageData } = $props();
	const w = $derived(t().hearing);
	const back = $derived(resolve(`/${data.dance.slug}/exercises/${data.exercise.id}`));

	function done(round: HearingRound) {
		try {
			leaveRound(sessionStorage, data.exercise.id, round);
		} catch {
			// No storage (a private window): the page opens without the score.
		}
		void goBack({ href: back, label: data.exercise.name }, { replace: true });
	}
</script>

<svelte:head><title>{w.pageTitle(data.dance.label)}</title></svelte:head>

<ListenPage
	dance={data.dance}
	songs={data.songs}
	settings={data.settings}
	changed={data.changed}
	title={data.exercise.name}
	name={data.exercise.name}
	backHref={back}
	backLabel={data.exercise.name}
	ondone={done}
/>
