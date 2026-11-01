<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import FieldError from '$lib/components/ui/FieldError.svelte';
	import { FIELD, LABEL, TEXTAREA } from '$lib/components/ui/styles';

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
		/** A refusal about one field, shown under it. */
		errors?: Partial<Record<'lessonDay' | 'title' | 'notes', string>>;
		notesRows?: number;
		/** A line under Notes. */
		notesHelp?: string;
		/** The sheet exists to type this: focus Title on open. */
		autofocus?: boolean;
	}

	let {
		lessonDay = '',
		title = '',
		notes = null,
		max,
		errors = {},
		notesRows = 3,
		notesHelp,
		autofocus = false
	}: Props = $props();

	const id = $props.id();
</script>

<div class="flex flex-col gap-3.5">
	<div>
		<label class={LABEL} for="{id}-day">Day of the class</label>
		<div class="relative">
			<!-- `type="date"` serialises as YYYY-MM-DD in every locale: the one native
			     control whose value needs no parsing on the server. -->
			<input
				id="{id}-day"
				type="date"
				name="lessonDay"
				required
				value={lessonDay}
				{max}
				class="{FIELD} pl-11"
				aria-invalid={errors.lessonDay ? 'true' : undefined}
				aria-describedby={errors.lessonDay ? `${id}-day-error` : undefined}
			/>
			<span class="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted">
				<Icon name="calendar" size={20} />
			</span>
		</div>
		{#if errors.lessonDay}<FieldError id="{id}-day-error" message={errors.lessonDay} />{/if}
	</div>

	<div>
		<label class={LABEL} for="{id}-title">Title</label>
		<!-- svelte-ignore a11y_autofocus -->
		<input
			id="{id}-title"
			name="title"
			required
			{autofocus}
			maxlength="200"
			value={title}
			placeholder="Wednesday rueda — enchufla variations"
			class={FIELD}
			aria-invalid={errors.title ? 'true' : undefined}
			aria-describedby={errors.title ? `${id}-title-error` : undefined}
		/>
		{#if errors.title}<FieldError id="{id}-title-error" message={errors.title} />{/if}
	</div>

	<div>
		<label class={LABEL} for="{id}-notes"
			>Notes<span class="font-medium text-muted">&nbsp;(optional)</span></label
		>
		<textarea
			id="{id}-notes"
			name="notes"
			rows={notesRows}
			maxlength="2000"
			placeholder="What the teacher said, what to fix, what you kept getting wrong…"
			class={TEXTAREA}
			aria-invalid={errors.notes ? 'true' : undefined}
			aria-describedby={errors.notes ? `${id}-notes-error` : undefined}>{notes ?? ''}</textarea
		>
		{#if errors.notes}<FieldError id="{id}-notes-error" message={errors.notes} />{/if}
		{#if notesHelp}<p class="mt-1.5 pl-1 text-[13px] text-muted">{notesHelp}</p>{/if}
	</div>
</div>
