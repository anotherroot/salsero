<script lang="ts">
	import { untrack } from 'svelte';
	import { version } from '$app/environment';
	import { applyAction } from '$app/forms';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import { LABEL, TEXTAREA, button } from '$lib/components/ui/styles';
	import { report } from '$lib/feedback/trail';
	import { shotFile } from '$lib/feedback/shot';
	import { shrinkPicture } from '$lib/feedback/shrink';
	import { connection } from '$lib/offline/connection.svelte';
	import { needsConnection } from '$lib/offline/needs-connection-action';
	import { guarded } from '$lib/unsaved/guard.svelte';
	import { t } from '$lib/i18n/catalog';

	/**
	 * The Send feedback sheet: a screenshot tile at the top (option S1 of the
	 * report-a-problem board), one text box, Send. What the page knows goes with
	 * it, added at send (`report`, the site's build, the window); the server adds
	 * the app and the browser from the request. Posts to Settings' own action.
	 *
	 * `shot`: a screenshot to start with (the Android app's, after a screenshot),
	 * taken when the sheet opens; × takes it off, the empty tile picks a picture.
	 * `here`: opened over the page it is about (after a screenshot), so the page
	 * sent is the one open; from You or Settings it is the one before.
	 */
	let {
		open,
		onclose,
		shot = null,
		here = false
	}: { open: boolean; onclose: () => void; shot?: string | null; here?: boolean } = $props();

	const w = $derived(t().feedback);
	const uid = $props.id();
	const formId = `send-feedback-${uid}`;

	let busy = $state(false);
	let refusal = $state('');
	let toast = $state<{ id: number; message: string; done: boolean } | null>(null);
	let seq = 0;
	let form = $state<HTMLFormElement>();
	let picker = $state<HTMLInputElement>();
	/** The screenshot that goes with the message, as a JPEG data URL. */
	let picture = $state<string | null>(null);
	/** Whether `picture` was picked here, not handed in. */
	let picked = $state(false);

	// Each opening starts from the screenshot handed in, and no refusal.
	$effect(() => {
		if (!open) return;
		untrack(() => {
			picture = shot;
			picked = false;
			refusal = '';
		});
	});

	async function pick(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		const url = await shrinkPicture(file);
		if (url === null) {
			refusal = w.shot.unreadable;
			return;
		}
		refusal = '';
		picture = url;
		picked = true;
	}
</script>

<Sheet title={w.title} {open} {onclose}>
	<form
		id={formId}
		method="POST"
		action="/settings?/feedback"
		enctype="multipart/form-data"
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
				const sent = report(here);
				formData.set('page', sent.page ?? '');
				formData.set('trail', JSON.stringify(sent.trail));
				formData.set('errors', JSON.stringify(sent.errors));
				formData.set('version', version);
				formData.set('viewport', `${window.innerWidth}×${window.innerHeight}`);
				if (picture) formData.set('shot', shotFile(picture));
				// Not `update()`: the action is Settings', and nothing on this page changes.
				return async ({ result }) => {
					busy = false;
					if (result.type === 'success') {
						form?.reset();
						picture = null;
						onclose();
						toast = { id: ++seq, message: w.sent, done: true };
						return;
					}
					// Signed out meanwhile: the hook sends the page to sign in.
					if (result.type === 'redirect') return applyAction(result);
					const message =
						result.type === 'failure'
							? String(result.data?.message ?? w.couldNotSend)
							: w.couldNotSend;
					// Closed while it was out: the sheet is gone, so the toast says it.
					if (open) refusal = message;
					else toast = { id: ++seq, message, done: false };
				};
			}
		}}
	>
		{#if refusal}<Banner kind="error" title={refusal} />{/if}
		{#if !picture}<p class="text-[14px] text-muted">{w.intro}</p>{/if}
		<div class="flex items-center gap-3.5">
			{#if picture}
				<div class="relative flex-none">
					<img
						src={picture}
						alt={w.shot.title}
						class="h-[138px] w-16 rounded-lg object-cover object-top ring-1 ring-hairline"
					/>
					<button
						type="button"
						class="absolute -top-2 -right-2 grid size-7 cursor-pointer place-items-center rounded-full bg-inverse-bg text-inverse-ink"
						aria-label={w.shot.remove}
						onclick={() => (picture = null)}
					>
						<Icon name="close" size={14} stroke={2.6} />
					</button>
				</div>
				<span class="flex min-w-0 flex-col gap-0.5">
					<span class="text-[15px] font-bold text-ink">{picked ? w.shot.picked : w.shot.title}</span
					>
					<span class="text-[13px] text-muted">{w.shot.goes}</span>
				</span>
			{:else}
				<button
					type="button"
					class="grid h-[108px] w-16 flex-none cursor-pointer place-items-center rounded-lg border-[1.5px] border-dashed border-field-line text-accent-text"
					aria-label={w.shot.add}
					onclick={() => picker?.click()}
				>
					<Icon name="plus" size={24} />
				</button>
				<button
					type="button"
					class="flex min-w-0 cursor-pointer flex-col gap-0.5 text-left"
					onclick={() => picker?.click()}
				>
					<span class="text-[15px] font-bold text-ink">{w.shot.add}</span>
					<span class="text-[13px] text-muted">{w.shot.addSub}</span>
				</button>
			{/if}
			<input
				bind:this={picker}
				type="file"
				accept="image/*"
				class="hidden"
				tabindex="-1"
				aria-hidden="true"
				onchange={pick}
			/>
		</div>
		<label class="block">
			<span class={LABEL}>{w.label}</span>
			<textarea
				name="message"
				rows={picture ? 4 : 5}
				maxlength="4000"
				required
				placeholder={w.placeholder}
				class={TEXTAREA}></textarea>
		</label>
	</form>
	{#snippet footer()}
		<button
			type="submit"
			form={formId}
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
	toast={toast && {
		id: toast.id,
		message: toast.message,
		icon: toast.done ? 'check' : 'warning',
		tone: toast.done ? 'done' : undefined
	}}
	ondismiss={() => (toast = null)}
/>
