<script lang="ts">
	import type { IconName } from '$lib/icons/icons';
	import Icon from './Icon.svelte';
	import { button } from './styles';

	/**
	 * Inside the Android app, an upload is the app's job: this link hands the
	 * target to it (`salsa://upload`), and the app picks, compresses and uploads
	 * in the background. Styled as the upload buttons it stands in for.
	 */
	interface Props {
		href: string;
		label: string;
		hint?: string;
		icon?: IconName;
		kind?: 'primary' | 'secondary';
	}

	let {
		href,
		label,
		hint = 'Compressed and uploaded in the background',
		icon = 'video',
		kind = 'secondary'
	}: Props = $props();
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- an app link, not a route -->
<a {href} class={button(kind, 'md', true)}><Icon name={icon} size={20} />{label}</a>
<!-- eslint-enable svelte/no-navigation-without-resolve -->
<p class="mt-1.5 text-center text-[13px] text-muted">{hint}</p>
