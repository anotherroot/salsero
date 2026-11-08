<!-- src/lib/components/lessons/UnlinkVia.svelte -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { button } from '$lib/components/ui/styles';
	import { t } from '$lib/i18n/catalog';
	import { unlinkViaBody, unlinkViaTitle } from '$lib/lessons/page';
	import type { ViaSection } from '$lib/types';

	/**
	 * Unlink, from the lesson, a variation, drill or position that is there
	 * through a section or point of its videos. Keeping that link would keep it
	 * on the lesson, so the only Unlink offered takes both — after asking.
	 */
	interface Props {
		/** The form action: `?/unlinkFigure` or `?/unlinkExercise`. */
		action: string;
		/** The posted id field and its value: `figureId` or `exerciseId`. */
		name: string;
		id: number;
		label: string;
		/** Asked from outside the lesson (a position's page): the lesson's title, named in the question. */
		lesson?: string;
		via: ViaSection[];
		onclose: () => void;
		/** The unlink went through (the dialog is closing): the page moves focus off the row that is gone. */
		onunlinked?: () => void;
	}

	let { action, name, id, label, lesson, via, onclose, onunlinked }: Props = $props();
	let busy = $state(false);
</script>

<Dialog
	open
	title={unlinkViaTitle(label, lesson)}
	body={unlinkViaBody(label, via, lesson)}
	icon="unlink"
	tone="danger"
	{onclose}
>
	{#snippet actions()}
		<button type="button" class={button('tertiary', 'sm')} onclick={onclose}
			>{t().common.cancel}</button
		>
		<form
			method="POST"
			{action}
			use:enhance={({ cancel }) => {
				if (busy) return cancel();
				busy = true;
				return async ({ update, result }) => {
					try {
						await update();
					} finally {
						busy = false;
					}
					onclose();
					if (result.type === 'success') onunlinked?.();
				};
			}}
		>
			<input type="hidden" {name} value={id} />
			<input type="hidden" name="alsoSections" value="1" />
			<button
				type="submit"
				class={button('danger', 'sm')}
				aria-busy={busy}
				aria-label={busy ? t().lesson.via.busy : undefined}
			>
				{#if busy}<Spinner />{:else}{t().lesson.via.unlink}{/if}
			</button>
		</form>
	{/snippet}
</Dialog>
