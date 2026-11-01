<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		tone = 'neutral',
		solid = false,
		children
	}: {
		tone?: 'neutral' | 'accent' | 'status' | 'danger' | 'warn' | 'done';
		solid?: boolean;
		children: Snippet;
	} = $props();

	const soft: Record<string, string> = {
		neutral: 'bg-chip text-ink-2',
		accent: 'bg-accent-soft text-accent-text',
		status: 'bg-accent-soft text-status',
		danger: 'bg-danger-soft text-danger',
		warn: 'bg-warn-soft text-warn',
		done: 'bg-done-soft text-done'
	};
	const strong: Record<string, string> = {
		neutral: 'bg-ink-2 text-surface',
		accent: 'bg-accent text-on-accent',
		status: 'bg-status text-on-accent',
		danger: 'bg-danger text-on-danger',
		warn: 'bg-warn text-surface',
		done: 'bg-done text-on-done'
	};
</script>

<span
	class="inline-flex h-6 flex-none items-center gap-1 rounded-full px-2.5 text-[12px] font-extrabold whitespace-nowrap {solid
		? strong[tone]
		: soft[tone]}"
>
	{@render children()}
</span>
