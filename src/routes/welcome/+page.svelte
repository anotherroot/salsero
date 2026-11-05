<script lang="ts">
	import CardFrame from '$lib/components/shell/CardFrame.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import NameFields from '$lib/components/system/NameFields.svelte';
	import { button } from '$lib/components/ui/styles';
	import { guarded } from '$lib/unsaved/guard.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let submitting = $state(false);
</script>

<svelte:head><title>Welcome</title></svelte:head>

<div data-dance={data.dance} style:display="contents">
	<CardFrame
		title="Welcome"
		subtitle="What should we call you?"
		note="Friends in a group see this instead of your email."
	>
		<form
			method="POST"
			class="flex flex-col gap-4 rounded-[22px] bg-surface px-4 pt-5 pb-4"
			use:guarded={{
				label: 'Your name',
				submit: ({ cancel }) => {
					if (submitting) return cancel();
					submitting = true;
					return async ({ update }) => {
						try {
							await update();
						} finally {
							submitting = false;
						}
					};
				}
			}}
		>
			<input type="hidden" name="next" value={data.next} />
			<NameFields
				firstName={form?.firstName ?? ''}
				lastName={form?.lastName ?? ''}
				field={form?.field}
				message={form?.message}
			/>
			<button type="submit" class={button('primary', 'lg', true)} aria-busy={submitting}>
				{#if submitting}
					<Spinner size={24} /> Saving…
				{:else}
					Continue
				{/if}
			</button>
		</form>
	</CardFrame>
</div>
