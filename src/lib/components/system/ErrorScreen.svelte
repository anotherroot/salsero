<script lang="ts">
	import Screen from '$lib/components/ui/Screen.svelte';
	import CardFrame from '$lib/components/shell/CardFrame.svelte';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import StatusBlock from './StatusBlock.svelte';
	import { button } from '$lib/components/ui/styles';
	import type { ErrorView } from '$lib/nav/error-view';
	import { t } from '$lib/i18n/catalog';

	let {
		view,
		back,
		todayHref,
		onretry,
		card = false
	}: {
		view: ErrorView;
		back: { label: string; href?: string; onclick?: () => void };
		todayHref: string;
		onretry?: () => void;
		/**
		 * Outside a dance, or signed out (`frameOfError`): on the desktop the message
		 * sits in the card pages' card (`CardFrame`). Otherwise the sheet, centred at 560.
		 * The phone shows the same screen either way.
		 */
		card?: boolean;
	} = $props();
</script>

<svelte:head><title>{view.title}</title></svelte:head>

{#snippet backButton()}
	<BandButton icon="back" label={back.label} href={back.href} onclick={back.onclick} />
{/snippet}

{#snippet message()}
	{#if !card}
		<!-- The desktop's sheet: the message a little way down, as the boards place it. -->
		<div aria-hidden="true" class="hidden desk:block desk:h-[90px] desk:flex-none"></div>
	{/if}
	<!-- The offline walk (scripts/offline) tells an error page, and its tone, by this mark. -->
	<span hidden data-error-screen={view.tone}></span>
	<StatusBlock
		icon={view.icon}
		tone={view.tone}
		title={view.heading}
		body={view.body}
		code={view.code ?? undefined}
		class={card ? 'desk:px-2 desk:pt-3' : ''}
	>
		{#snippet actions()}
			<!-- On the desktop's wide sheet the buttons stop at 280; in the card they fill it. -->
			<div class="contents {card ? '' : 'desk:flex desk:w-[280px] desk:flex-col desk:gap-2'}">
				{#if view.retry}
					<button type="button" class={button('primary', 'md', true)} onclick={onretry} data-retry>
						<Icon name="refresh" size={20} />{t().common.retry}
					</button>
				{/if}
				{#if view.today}
					<a
						href={todayHref}
						class={view.retry ? button('tertiary', 'md', true) : button('primary', 'md', true)}
					>
						<Icon name="calendar" size={20} />{t().shell.error.goToday}
					</a>
				{/if}
			</div>
		{/snippet}
	</StatusBlock>
{/snippet}

{#if card}
	<CardFrame title={view.title} left={backButton}>{@render message()}</CardFrame>
{:else}
	<Screen title={view.title} left={backButton} width="narrow">{@render message()}</Screen>
{/if}
