import type { Catalog } from '../catalog';
import { slCount, slForm } from '../plural';

type Forms = [one: string, two: string, few: string, other: string];

/** The noun alone, in the form `n` takes: the count is drawn apart. */
const form = (n: number, [one, two, few, other]: Forms) => ({ one, two, few, other })[slForm(n)];

// A class's day is a "lekcija" (as the exercise page's "Z lekcije tor, 3. nov.");
// the group behind it is a "tečaj".
export const lesson: Catalog['lesson'] = {
	bandLine: (day) => `Lekcija · ${day}`,
	onToday: (day) => `Na vrsti ${day}`,
	// `whenWords` already says a weekday as a time: "v nedeljo".
	onTodayOn: (when) => `Na vrsti ${when}`,
	onTodayNextWeek: 'Na vrsti naslednji teden',
	paused: 'Na premoru',
	goOver: 'Ponovite to lekcijo',
	deleting: (name, day) => `${name} · izbris ${day}`,
	page: {
		notes: 'Opombe',
		videos: 'Videi',
		links: 'Povezave',
		practising: 'Kaj vadite',
		noVideos: 'Videov še ni.',
		addVideos: 'Dodaj videe',
		video: (n) => `Video ${n}`,
		deleteVideo: (n) => `Izbriši video ${n}`,
		missingTitle: 'Datoteke ni',
		missingBody: 'Na strežniku ni datoteke za ta video.',
		unplayableTitle: 'Tu se ne predvaja',
		unplayableBody:
			'Ta brskalnik te datoteke ne more predvajati. Prenesite jo ali jo odprite na telefonu.',
		download: 'Prenesi',
		cantDelete: 'Tega videa ni mogoče izbrisati',
		notInPractice: 'Še ni med vašimi vajami',
		adding: 'Dodajanje …',
		added: 'Dodano na seznam Danes',
		couldNotAdd: 'Dodajanje ni uspelo.',
		couldNotUndo: 'Razveljavitev ni uspela.',
		notNow: 'Ne zdaj',
		menu: 'Meni lekcije',
		edit: 'Uredi lekcijo'
	},
	list: {
		empty: 'Še ni lekcij',
		emptyGroup:
			'Dodajte jo po naslednji uri tečaja: videe in opombe. Vidijo jo vsi v tečaju, ko jo objavite.',
		emptyOwn:
			'Dodajte jo po naslednji uri tečaja: videe, opombe in nekaj na seznamu Danes, da jo boste ponovili.',
		newLesson: 'Nova lekcija',
		drafts: 'Osnutki',
		draft: 'Osnutek',
		isNew: 'Nova',
		videos: (n) => slCount(n, ['video', 'videa', 'videi', 'videov']),
		sections: (n) => form(n, ['odsek', 'odseka', 'odseki', 'odsekov']),
		routines: (n) => form(n, ['kombinacija', 'kombinaciji', 'kombinacije', 'kombinacij']),
		figures: (n) => form(n, ['različica', 'različici', 'različice', 'različic']),
		onDisk: (size) => `Videi na disku: ${size}`,
		groupVideos: (used, limit) => `Videi skupine: ${used} od ${limit}`,
		pick: {
			title: 'Izberite lekcijo',
			body: 'Tu, ob seznamu, se odprejo njene opombe, videi in kar uči.'
		}
	}
};
