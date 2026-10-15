<script lang="ts">
	/**
	 * Inside the Android app, an upload is the app's job: this link hands the
	 * target to it (`salsa://upload`), and the app picks, compresses and uploads
	 * in the background. Styled as the upload buttons it stands in for.
	 */
	interface Props {
		href: string;
		label: string;
		hint?: string;
	}

	let { href, label, hint = 'Compressed and uploaded in the background' }: Props = $props();
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- an app link, not a route -->
<a
	{href}
	class="flex h-12 items-center justify-center rounded-xl border border-dashed border-rule text-[14px] font-medium text-accent"
>
	{label}
</a>
<!-- eslint-enable svelte/no-navigation-without-resolve -->
<p class="mt-1 text-center text-[12px] text-muted">{hint}</p>
