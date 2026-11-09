<script lang="ts">
	import { t } from '$lib/i18n/catalog';
	import type { GroupMode } from '$lib/types';
	import GroupBadge from './GroupBadge.svelte';

	/**
	 * The desktop side's card in a group's view (spec 2026-11-09, idea H3): first in
	 * the side, cream on the band, the group's badge, its name and its people.
	 */
	let { group }: { group: GroupMode } = $props();
</script>

<div
	class="-mx-2 mb-3 flex items-center gap-3 rounded-[18px] bg-band-ink py-3 pr-3 pl-3 text-band"
	data-group-card
>
	<GroupBadge size={34} tone="band" />
	<div class="flex min-w-0 flex-col">
		<span class="line-clamp-2 text-[15px] leading-[1.3] font-extrabold break-words"
			>{group.name}</span
		>
		<span class="text-[13px] leading-[1.3] font-bold opacity-80"
			>{t().entry.classes.people(group.people)}</span
		>
	</div>
</div>
