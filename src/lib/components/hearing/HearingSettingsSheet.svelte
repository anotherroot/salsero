<script lang="ts">
	import { resolve } from '$app/paths';
	import { guarded, passNext, unsaved } from '$lib/unsaved/guard.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { button } from '$lib/components/ui/styles';
	import { settingsQuery, type HearingSettings } from '$lib/hearing/drill';
	import { t } from '$lib/i18n/catalog';
	import type { Dance } from '$lib/dances/dances';
	import HearingFields from './HearingFields.svelte';

	/**
	 * Spremeni on a hearing drill (phase 2, spec 13): another kind, target or
	 * length. Začni s temi plays this round with them (the link carries them, the
	 * drill keeps its own); Shrani za vajo, for whoever may edit the drill, saves
	 * them as the drill's (`?/hearing`).
	 */
	interface Props {
		dance: Dance;
		exerciseId: number;
		settings: HearingSettings;
		canSave: boolean;
		open: boolean;
		onclose: () => void;
		/** The page is about to be left for the round. */
		onleave?: () => void;
	}

	let { dance, exerciseId, settings, canSave, open, onclose, onleave }: Props = $props();
	const w = $derived(t().hearing.drill);
	let form: HTMLFormElement | undefined = $state();
	let busy = $state(false);
	let refused = $state<string | null>(null);

	/** The fields as a link's query: what `settingsFrom` reads. */
	function query(): string {
		if (!form) return '';
		const fd = new FormData(form);
		return ['kind', 'target', 'clave', 'positions', 'drops']
			.flatMap((k) => {
				const v = fd.get(k);
				return typeof v === 'string' && v !== '' ? [`${k}=${encodeURIComponent(v)}`] : [];
			})
			.join('&');
	}

	/**
	 * The round takes the changes along, so nothing is lost: the sheet's
	 * unsaved-changes guard lets this one navigation through (`passNext`).
	 */
	function startWith(e: MouseEvent & { currentTarget: HTMLAnchorElement }) {
		const href = `${resolve(`/${dance.slug}/hearing/${exerciseId}`)}?${query()}`;
		// The link's own navigation (a sheet holds its Back moves until it lands), to
		// the fields as they are now; the guard lets this one through.
		e.currentTarget.href = href;
		passNext(href, unsaved(form ?? null));
		onleave?.();
	}
</script>

<Sheet title={w.changeTitle} sub={w.changeSub} {open} {onclose}>
	<form
		bind:this={form}
		id="hearing-settings"
		method="POST"
		action="?/hearing"
		class="flex flex-col gap-3.5"
		use:guarded={{
			label: w.changeTitle,
			submit: () => {
				busy = true;
				refused = null;
				return async ({ update, result }) => {
					try {
						if (result.type === 'failure') {
							const m = (result.data as { message?: unknown } | undefined)?.message;
							refused = typeof m === 'string' ? m : t().exercise.refused.checkValues;
						}
						await update();
						if (result.type === 'success') onclose();
					} finally {
						busy = false;
					}
				};
			}
		}}
	>
		<input type="hidden" name="seen" value={JSON.stringify({ hearing: settingsQuery(settings) })} />
		<HearingFields {dance} {settings} />
		{#if refused}<Banner kind="error" title={refused} />{/if}
	</form>
	{#snippet footer()}
		<div class="flex flex-col gap-2">
			<a
				href={resolve(`/${dance.slug}/hearing/${exerciseId}`)}
				class="{button('primary', 'md', true)} gap-2"
				onclick={startWith}
			>
				<Icon name="play" size={20} filled />{w.startWith}
			</a>
			{#if canSave}
				<button
					type="submit"
					form="hearing-settings"
					class="{button('secondary', 'md', true)} gap-2"
					aria-busy={busy}
					disabled={busy}
				>
					{#if busy}<Spinner size={18} />{/if}{w.save}
				</button>
			{/if}
		</div>
	{/snippet}
</Sheet>
