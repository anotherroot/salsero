<script lang="ts">
	import { enhance } from '$app/forms';
	import Screen from '$lib/components/ui/Screen.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { FIELD, LABEL, button } from '$lib/components/ui/styles';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let submitting = $state(false);
</script>

<svelte:head><title>Sign in</title></svelte:head>

<div data-dance={data.dance} style:display="contents">
	<Screen title="Sign in" subtitle="Welcome back. Sign in to practise.">
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
				<span class={LABEL}>Email</span>
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
				<span class={LABEL}>Password</span>
				<input
					name="password"
					type="password"
					autocomplete="current-password"
					required
					disabled={submitting}
					class={FIELD}
				/>
			</label>

			{#if form?.message}
				<Banner kind="error" title={form.message} />
			{/if}

			<button type="submit" class={button('primary', 'lg', true)} aria-busy={submitting}>
				{#if submitting}
					<Spinner size={24} /> Signing in…
				{:else}
					Sign in
				{/if}
			</button>
		</form>

		<p class="mt-1.5 text-center text-[13px] text-muted">
			Got an invite? Open its link, or scan its code with your camera.
		</p>
	</Screen>
</div>
