<script lang="ts">
	import type { IconName } from '$lib/icons/icons';
	import Icon from './Icon.svelte';
	import { t } from '$lib/i18n/catalog';
	import { button, DASHED_ADD } from './styles';

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
		kind?: 'primary' | 'secondary' | 'dashed';
	}

	let { href, label, hint, icon = 'video', kind = 'secondary' }: Props = $props();
</script>

<a {href} class={kind === 'dashed' ? DASHED_ADD : button(kind, 'md', true)}
	><Icon name={kind === 'dashed' ? 'upload' : icon} size={20} />{label}</a
>
<p class="mt-1.5 text-center text-[13px] text-muted">{hint ?? t().shell.upload.inBackground}</p>
