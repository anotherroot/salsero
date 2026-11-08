import type { Catalog } from '../catalog';
import { slCount } from '../plural';

type Forms = [one: string, two: string, few: string, other: string];

/** "pred enim dnevom", "pred 2 dnevoma", "pred 5 dnevi": "pred" takes the instrumental. */
const before = (n: number, one: string, forms: Forms) =>
	n === 1 ? `pred ${one}` : `pred ${slCount(n, forms)}`;

// A name is never declined or the subject of a past tense: it stands before a
// "·" or after a colon ("Odgovarjate: Maja").
export const comments: Catalog['comments'] = {
	title: 'Komentarji',
	empty: 'Še ni komentarjev. Vprašajte ali povejte kaj.',
	newCount: (n) => slCount(n, ['nov', 'nova', 'novi', 'novih']),
	// Reads right beside a woman's name and a man's ("vodja" is both).
	teacher: 'vodja tečaja',
	replies: (n) => slCount(n, ['odgovor', 'odgovora', 'odgovori', 'odgovorov']),
	hideReplies: 'Skrij odgovore',
	deleted: 'Komentar je izbrisan',
	whoSees: (group) => `Komentarje vidi ves tečaj ${group}`,
	loading: 'Nalaganje komentarjev',
	heart: 'Srček',
	heartCount: (n) => `Srček, ${n}`,
	reply: 'Odgovori',
	more: 'Možnosti komentarja',
	comment: 'Komentar',
	placeholder: 'Napišite komentar …',
	replyingTo: (name) => `Odgovarjate: ${name}`,
	newInstead: 'Namesto tega napišite nov komentar',
	send: 'Pošlji',
	stillSending: 'Pošiljanje še poteka.',
	tooShort: 'Najprej kaj napišite.',
	tooLong: (max) =>
		`Komentar je lahko dolg največ ${slCount(max, ['znak', 'znaka', 'znake', 'znakov'])}.`,
	failed: 'Ni uspelo. Poskusite znova.',
	ago: {
		now: 'pravkar',
		minutes: (n) => `pred ${n} min`,
		hours: (n) => `pred ${n} h`,
		days: (n) => before(n, 'enim dnevom', ['dnevom', 'dnevoma', 'dnevi', 'dnevi']),
		weeks: (n) => before(n, 'enim tednom', ['tednom', 'tednoma', 'tedni', 'tedni']),
		years: (n) => before(n, 'enim letom', ['letom', 'letoma', 'leti', 'leti'])
	},
	someone: 'Nekdo',
	refused: {
		closed: 'Ta tečaj je izbrisan, zato lahko komentarje le še berete.',
		notInLesson: 'Tega komentarja ni v tej lekciji.',
		replyDeleted: 'Ta komentar je izbrisan.',
		noLesson: 'Te lekcije ni.',
		noComment: 'Tega komentarja ni.',
		signIn: 'Prijavite se',
		badJson: 'Napačen JSON.'
	}
};
