<script lang="ts">
	import { enhance } from '$app/forms';
	import CardFrame from '$lib/components/shell/CardFrame.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { FIELD, LABEL, button } from '$lib/components/ui/styles';
	import { t } from '$lib/i18n/catalog';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let submitting = $state(false);
	const w = $derived(t().entry);
</script>

<svelte:head><title>{w.login.title}</title></svelte:head>

<div data-dance={data.dance} style:display="contents">
	<CardFrame title={w.login.title} subtitle={w.login.subtitle} note={w.login.note}>
		<form
			method="POST"
			class="flex flex-col gap-4 rounded-[22px] bg-surface px-4 pt-5 pb-4"
			use:enhance={({ cancel }) => {
				// A second tap or Enter while signing in sends nothing: its fields are
				// disabled by then, so it would post an empty login.
				if (submitting) return cancel();
				// Disabling the fields below is safe: enhance builds the FormData
				// before this callback runs, so they are still sent.
				submitting = true;
				return async ({ update }) => {
					await update();
					submitting = false;
				};
			}}
		>
			<input type="hidden" name="next" value={data.next} />

			<label class="block">
				<span class={LABEL}>{w.email}</span>
				<input
					name="email"
					type="email"
					autocomplete="username"
					required
					disabled={submitting}
					value={form?.email ?? ''}
					class={FIELD}
				/>
			</label>

			<label class="block">
				<span class={LABEL}>{w.password}</span>
				<input
					name="password"
					type="password"
					autocomplete="current-password"
					required
					disabled={submitting}
					class={FIELD}
				/>
			</label>

			{#if data.noAccount}<Banner kind="info" title={data.noAccount} />{/if}

			{#if form?.message}
				<Banner kind="error" title={form.message} />
			{/if}

			<button type="submit" class={button('primary', 'lg', true)} aria-busy={submitting}>
				{#if submitting}
					<Spinner size={24} /> {w.login.signingIn}
				{:else}
					{w.login.signIn}
				{/if}
			</button>
		</form>
	</CardFrame>
</div>
