<script lang="ts">
	import Screen from '$lib/components/ui/Screen.svelte';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import StatusBlock from './StatusBlock.svelte';
	import { button } from '$lib/components/ui/styles';
	import type { ErrorView } from '$lib/nav/error-view';

	let {
		view,
		back,
		todayHref,
		onretry
	}: {
		view: ErrorView;
		back: { label: string; href?: string; onclick?: () => void };
		todayHref: string;
		onretry?: () => void;
	} = $props();
</script>

<svelte:head><title>{view.title}</title></svelte:head>

<Screen title={view.title}>
	{#snippet left()}
		<BandButton icon="back" label={back.label} href={back.href} onclick={back.onclick} />
	{/snippet}
	<StatusBlock
		icon={view.icon}
		tone={view.tone}
		title={view.heading}
		body={view.body}
		code={view.code ?? undefined}
	>
		{#snippet actions()}
			{#if view.retry}
				<button type="button" class={button('primary', 'md', true)} onclick={onretry}>
					<Icon name="refresh" size={20} />Try again
				</button>
			{/if}
			{#if view.today}
				<!-- eslint-disable svelte/no-navigation-without-resolve -- a built dance path -->
				<a
					href={todayHref}
					class={view.retry ? button('tertiary', 'md', true) : button('primary', 'md', true)}
				>
					<Icon name="calendar" size={20} />Go to Today
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{/if}
		{/snippet}
	</StatusBlock>
</Screen>
