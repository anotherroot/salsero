<script lang="ts">
	import { version } from '$app/environment';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import LeadTile from '$lib/components/system/LeadTile.svelte';
	import { GROUP, LABEL, ROW_TALL, TEXTAREA, button, PRESS_ROW } from '$lib/components/ui/styles';
	import { report } from '$lib/feedback/trail';
	import { connection } from '$lib/offline/connection.svelte';
	import { needsConnection } from '$lib/offline/needs-connection-action';
	import { guarded } from '$lib/unsaved/guard.svelte';
	import { t } from '$lib/i18n/catalog';

	/**
	 * Send feedback: a row (on You and Settings) that opens a sheet with one text
	 * box. What the page knows goes with it, added at send (`report`: the page
	 * before this one and the last pages and errors; the site's build; the window);
	 * the server adds the app and the browser from the request. Posts to Settings'
	 * own action, so there is one place that keeps it.
	 */
	const w = $derived(t().feedback);

	let open = $state(false);
	let busy = $state(false);
	let refusal = $state('');
	let toast = $state<{ id: number; message: string } | null>(null);
	let seq = 0;
	let form = $state<HTMLFormElement>();

	function close() {
		open = false;
		refusal = '';
	}
</script>

<div class={GROUP}>
	<button
		type="button"
		class="{ROW_TALL} w-full text-left {PRESS_ROW}"
		onclick={() => {
			refusal = '';
			open = true;
		}}
	>
		<LeadTile icon="flag" />
		<span class="flex min-w-0 flex-1 flex-col">
			<span class="text-[16px] font-bold text-ink">{w.row}</span>
			<span class="text-[13px] text-muted">{w.rowSub}</span>
		</span>
		<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
	</button>
</div>

<Sheet title={w.title} {open} onclose={close}>
	<form
		id="send-feedback"
		method="POST"
		action="/settings?/feedback"
		novalidate
		class="flex flex-col gap-3.5"
		bind:this={form}
		use:guarded={{
			label: w.title,
			submit: ({ formData, cancel }) => {
				// One message per tap: a second tap while the first is out is dropped.
				if (busy) return cancel();
				busy = true;
				refusal = '';
				const sent = report();
				formData.set('page', sent.page ?? '');
				formData.set('trail', JSON.stringify(sent.trail));
				formData.set('errors', JSON.stringify(sent.errors));
				formData.set('version', version);
				formData.set('viewport', `${window.innerWidth}×${window.innerHeight}`);
				// Not `update()`: the action is Settings', and nothing on this page changes.
				return async ({ result }) => {
					busy = false;
					if (result.type === 'success') {
						form?.reset();
						close();
						toast = { id: ++seq, message: w.sent };
					} else if (result.type === 'failure') {
						refusal = String(result.data?.message ?? w.couldNotSend);
					} else refusal = w.couldNotSend;
				};
			}
		}}
	>
		{#if refusal}<Banner kind="error" title={refusal} />{/if}
		<p class="text-[14px] text-muted">{w.intro}</p>
		<label class="block">
			<span class={LABEL}>{w.label}</span>
			<textarea
				name="message"
				rows="6"
				maxlength="4000"
				required
				placeholder={w.placeholder}
				class={TEXTAREA}></textarea>
		</label>
	</form>
	{#snippet footer()}
		<button
			type="submit"
			form="send-feedback"
			class={button('primary', 'md', true)}
			aria-busy={busy}
			aria-label={busy ? w.sending : undefined}
			use:needsConnection={connection.online}
		>
			{#if busy}<Spinner />{:else}{w.send}{/if}
		</button>
	{/snippet}
</Sheet>

<Toast
	toast={toast && { id: toast.id, message: toast.message, icon: 'check', tone: 'done' }}
	ondismiss={() => (toast = null)}
/>
