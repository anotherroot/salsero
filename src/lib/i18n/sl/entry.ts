import type { Catalog } from '../catalog';
import { slCount } from '../plural';

const NO_ACCOUNT = 'Ta koda doda le tiste, ki že imajo račun.';

// The first screens a person sees after the teacher's link: warm and plain.
// No past tense about the reader, nor about the teacher (whose gender the app
// does not know). U+00A0 before "…": it never starts a line.
export const entry: Catalog['entry'] = {
	email: 'E-pošta',
	password: 'Geslo',
	required: 'Vnesite e-pošto in geslo.',
	tooMany: 'Preveč poskusov. Počakajte 15 minut in poskusite znova.',
	login: {
		title: 'Prijava',
		subtitle: 'Lepo, da ste spet tu. Prijavite se in vadite.',
		note: 'Imate povabilo? Odprite povezavo v njem ali s kamero telefona skenirajte njegovo kodo.',
		signIn: 'Prijavi me',
		signingIn: 'Prijavljanje\u00a0…',
		wrong: 'Napačna e-pošta ali geslo.'
	},
	join: {
		title: 'Pridružite se',
		invited: 'Povabilo za vas',
		passwordRule:
			'Vsaj 12 znakov. Uporabite vsaj tri od teh: male črke, velike črke, številke, posebne znake.',
		form: 'Vaš račun',
		create: 'Ustvari račun',
		creating: 'Ustvarjanje\u00a0…',
		dead: 'To povabilo ne velja več. Prosite za novo.',
		badEmail: 'Vnesite veljaven e-poštni naslov.',
		taken: 'Za ta e-poštni naslov račun že obstaja.',
		weak: {
			short: 'Geslo mora imeti vsaj 12 znakov.',
			common: 'To geslo je preveč znano. Izberite drugo.',
			repeated: 'Geslo ne sme biti en sam ponovljen znak.',
			mix: 'Geslo mora vsebovati vsaj tri od teh: male črke, velike črke, številke, posebne znake.'
		}
	},
	name: {
		first: 'Ime',
		last: 'Priimek',
		firstRefusal: 'Vnesite svoje ime (največ 60 znakov).',
		lastRefusal: 'Vnesite svoj priimek (največ 60 znakov).'
	},
	welcome: {
		title: 'Dobrodošli',
		subtitle: 'Kako naj vas kličemo?',
		// The class's word first: the Slovenian reader is most often a class member.
		note: 'Drugi na vašem tečaju ali v skupini vidijo to namesto vašega e-poštnega naslova.',
		form: 'Vaše ime',
		continue: 'Naprej',
		saving: 'Shranjevanje\u00a0…'
	},
	firstRun: {
		slides: [
			{
				title: 'Vadite, kar je bilo na tečaju',
				body: 'Tukaj najdete vsako lekcijo s tečaja. Doma si jo lahko znova ogledate in vadite, po nekaj minut naenkrat.'
			},
			{
				title: 'Vsak dan le nekaj vaj',
				body: 'Zavihek Danes pokaže le nekaj vaj. Ko jih opravite, je dela za danes konec.'
			},
			{
				title: 'Vi odločite, kdaj pride spet na vrsto',
				body: 'Po vaji izberite, kako je šlo. Aplikacija si zapomni namesto vas.'
			}
		],
		skip: 'Preskoči',
		next: 'Naprej',
		level: {
			title: 'Kaj vse želite videti?',
			note: 'To lahko kadar koli spremenite v Nastavitvah',
			refusal: 'Izberite, kaj vse želite videti.'
		},
		join: {
			title: 'Pridružite se svojemu tečaju',
			subtitle: 'Kodo dobite na tečaju',
			label: 'Koda tečaja',
			or: 'Lahko pa odprete prejeto povezavo ali skenirate kodo na steni plesne šole.',
			notNow: 'Ne zdaj',
			join: 'Pridruži se',
			joining: 'Pridruževanje\u00a0…'
		},
		code: {
			empty: 'Vnesite kodo tečaja.',
			unknown: 'Noben tečaj nima te kode. Preverite jo in poskusite znova.',
			refused: 'Ta tečaj je bil izbrisan, zato se mu ne morete pridružiti.'
		}
	},
	levels: {
		follow: {
			title: 'Sledim svojemu tečaju',
			body: 'Kar delamo na tečaju, vsak dan nekaj vaj. Ničesar ni treba nastavljati.',
			small: 'Nove lekcije s tečaja pridejo pod Danes same.'
		},
		own: {
			title: 'Vadim in imam svoje',
			body: 'Hranim tudi svoje videe, na primer z delavnic ali s svojih nastopov, in svoje skladbe.',
			small: 'Videi se samo predvajajo.'
		},
		all: {
			title: 'Vse',
			body: 'Svoje figure, položaje in kombinacije. V videih označujem in urejam odseke.'
		}
	},
	classes: {
		// A group's name stays as written (never declined). The band's title is the name
		// alone: with "Pridružite se:" before it, two lines no longer held the name, and
		// the button under it says Pridruži se.
		joinTitle: (name) => `Pridružitev: ${name}`,
		joinQuestion: (name) => name,
		people: (n) => slCount(n, ['oseba', 'osebi', 'osebe', 'oseb']),
		// A person's name after a colon, never declined.
		noAccount: (admin) =>
			admin
				? `${NO_ACCOUNT} Za povabilo se obrnite na skrbnika: ${admin}.`
				: `${NO_ACCOUNT} Za povabilo se obrnite na skrbnika.`,
		stale: 'Ta koda ne velja več',
		signIn: 'Prijavite se',
		lastClass: (day) => `Zadnja lekcija: ${day}`,
		noClasses: 'Še ni lekcij',
		videos: (n) => slCount(n, ['video', 'videa', 'videi', 'videov']),
		toPractise: (n) => `${n} za vadbo`,
		songs: 'Skladbe s tečaja',
		songsCount: (n) => `Skladbe s tečaja · ${n}`,
		classes: 'Vaši tečaji',
		latest: 'Zadnja lekcija',
		earlier: 'Prejšnje lekcije',
		menu: 'Meni tečaja',
		pick: { title: 'Izberite tečaj', body: 'Tukaj se odprejo njegove lekcije in skladbe.' },
		somethingNew: ', nekaj novega',
		isNew: 'Nova',
		add: 'Dodaj',
		addLesson: (title) => `Dodaj: ${title}`
	}
};
