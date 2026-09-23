<script lang="ts">
	/**
	 * The fields a lesson is made of, with no form tag of its own — so the create
	 * sheet and the detail page's edit mode stay identical. Same shape as
	 * `figures/FigureFields.svelte`.
	 */
	interface Props {
		lessonDay?: string;
		title?: string;
		notes?: string | null;
		/** No class can have happened after today; the picker says so too. */
		max?: string;
	}

	let { lessonDay = '', title = '', notes = null, max }: Props = $props();

	const field =
		'w-full rounded-lg border border-rule bg-raised px-3 py-2.5 text-[15px] outline-none focus:border-accent';
	const label = 'mb-1 block text-[13px] text-muted';
</script>

<label class="block">
	<span class={label}>Day of the class</span>
	<!-- `type="date"` serialises as YYYY-MM-DD in every locale: the one native
	     control whose value needs no parsing on the server. -->
	<input type="date" name="lessonDay" required value={lessonDay} {max} class={field} />
</label>

<label class="block">
	<span class={label}>Title</span>
	<input
		name="title"
		required
		maxlength="200"
		value={title}
		placeholder="Wednesday rueda — enchufla variations"
		class={field}
	/>
</label>

<label class="block">
	<span class={label}>Notes</span>
	<textarea
		name="notes"
		rows="5"
		maxlength="2000"
		placeholder="What the teacher said, what to fix, what you kept getting wrong…"
		class={field}>{notes ?? ''}</textarea
	>
</label>
