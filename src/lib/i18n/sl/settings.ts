import type { Catalog } from '../catalog';
import { slCount } from '../plural';

export const settings: Catalog['settings'] = {
	language: 'Jezik',
	badLanguage: 'Izberite jezik.',
	theme: { system: 'Sistemska', light: 'Svetla', dark: 'Temna' },
	saved: 'Shranjeno',
	couldNotSave: 'Shranjevanje ni uspelo.',
	storage: {
		label: 'Prostor',
		spaceUsed: 'Porabljen prostor',
		using: (used) => `Uporabljate ${used}`,
		usingOf: (used, limit) => `Uporabljate ${used} od ${limit}`,
		whatUses: 'Kaj zaseda prostor',
		whatUsesSub: 'Največje najprej, z možnostjo brisanja',
		askForMore: 'Prosi za več prostora',
		asked: (date) => `Prošnja poslana ${date} · čaka na odgovor`,
		askIntro: 'Skrbnik vidi, koliko prostora porabite. Opomba ni obvezna.',
		note: 'Opomba',
		couldNotAsk: 'Prošnje ni bilo mogoče poslati.',
		noLimit: 'Nimate omejitve, zato vam ni treba prositi za več.',
		noteTooLong: 'Opomba naj bo krajša od 500 znakov.',
		noRoom: (used, limit) =>
			`Ni dovolj prostora: porabite ${used} od ${limit}. Sprostite nekaj prostora ali v Nastavitvah prosite za več.`,
		noRoomGroup: (used, limit) =>
			`Ni dovolj prostora: skupina porabi ${used} od ${limit}. Vodja skupine lahko prosi za več.`,
		noRoomServer: 'Na strežniku ni dovolj prostora. Obrnite se na skrbnika.',
		biggestFirst: 'Največje najprej',
		nothingYet: 'Nič še ne zaseda prostora',
		archived: 'arhivirano',
		deleteLabel: (title, context) => `Izbriši: ${title}, ${context}`,
		couldNotDelete: 'Ni bilo mogoče izbrisati.',
		alreadyGone: 'Tega ni več.',
		freeNote:
			'Prostor sprostite z brisanjem. Arhivirane stvari obdržijo svoje datoteke, dokler jih tukaj ne izbrišete.',
		songBusy: 'Ta skladba se še pripravlja. Poskusite znova čez nekaj minut.',
		songUsedBy: (names) => `V uporabi: ${names}. Najprej jo odstranite tam.`,
		item: {
			untitledSong: 'Skladba brez naslova',
			song: 'Skladba',
			songBy: (artist) => `Skladba · ${artist}`,
			recording: 'Posnetek',
			audioRecording: 'Zvočni posnetek',
			lessonVideo: 'Video lekcije',
			lesson: (title) => `Lekcija · ${title}`,
			countVoice: 'Vaše štetje',
			takes: (n) => slCount(n, ['posnetek', 'posnetka', 'posnetki', 'posnetkov']),
			inDeleted: (label) => `${label} · v »Nedavno izbrisano«`
		}
	},
	onPhone: {
		label: 'Na tem telefonu',
		songs: (size) => `Pesmi in vaše štetje · ${size}`
	},
	practice: {
		label: 'Vadenje',
		perDay: 'Vaj na dan',
		fewer: 'Manj',
		more: 'Več',
		perDayNote: (n) =>
			`Toliko vaj pokaže zavihek Danes. Ko jih opravite, jih z gumbom »Dodaj še ${n}« dobite več.`,
		newFigures: 'Slog novih figur',
		styleIntro: 'Slog, v katerem se začne nova figura. Na figuri ga lahko spremenite.',
		style: 'Slog'
	},
	appearance: {
		label: 'Videz',
		theme: 'Tema',
		themeIntro: 'Sistemska sledi svetli ali temni nastavitvi telefona ali računalnika.',
		note: 'Velja le za ta brskalnik ali telefon.'
	},
	getAppSub: 'Za začetni zaslon telefona',
	you: {
		inApp: 'V aplikaciji za Android',
		allSettings: 'Vse nastavitve'
	},
	android: {
		label: 'Aplikacija za Android',
		version: (v) => `Različica aplikacije ${v}`,
		reminder: 'Dnevni opomnik',
		reminderSub: 'Obvestilo o vajah, ki so na vrsti',
		time: 'Ura',
		reminderTime: 'Ura opomnika',
		compress: 'Velikost stisnjenih videov',
		size: 'Velikost',
		note: 'Aplikacija na telefonu to prebere, ko se odpre.'
	},
	devices: {
		label: 'Povezani telefoni',
		appLabel: (dance) => `Aplikacija ${dance}`,
		removeLabel: (label) => `Odstrani: ${label}`,
		removed: (label) => `Odstranjeno: ${label}`,
		// Nouns, not a participle: "povezan" would agree with the phone's gender.
		paired: (date) => `Povezava: ${date}`,
		lastUsed: (paired, when) => `${paired} · zadnja uporaba: ${when}`,
		gone: 'Ta telefon je že odstranjen.'
	},
	connector: {
		title: (host) => `Povežem ${host}?`,
		calls: (name) => `Sama se imenuje »${name}«.`,
		can: 'Brala bo vaše gibe, figure, kombinacije, vaje, lekcije, položaje in skupine. Kasneje bo lahko predlagala spremembe; nič se ne spremeni, dokler jih ne izvedete v aplikaciji.',
		approve: 'Poveži',
		cancel: 'Prekliči',
		otherDance: (dance) =>
			`Ta povezava je za aplikacijo ${dance}. Tam se prijavite s svojim računom za ${dance}.`,
		apps: {
			label: 'Povezane aplikacije AI',
			// Nouns, as for phones: a participle would agree with the app's gender.
			connected: (date) => `Povezava: ${date}`,
			lastUsed: (connected, when) => `${connected} · zadnja uporaba: ${when}`,
			disconnect: 'Prekini povezavo',
			disconnectLabel: (host) => `Prekini povezavo: ${host}`,
			disconnected: (host) => `Povezava prekinjena: ${host}`,
			empty:
				'V svoji aplikaciji AI (Claude, ChatGPT …) dodajte to aplikacijo kot povezavo po meri, na tem naslovu:',
			gone: 'Ta aplikacija ni več povezana.'
		},
		badRequest: 'Ta povezava za povezovanje aplikacije ni veljavna. Začnite znova v aplikaciji.'
	},
	admin: { label: 'Skrbništvo', sub: 'Povabite nekoga' },
	account: { label: 'Račun', name: 'Ime', signedIn: 'Prijavljeni ste', signOut: 'Odjava' },
	refusals: {
		theme: 'Izberite eno od tem.',
		style: 'Izberite enega od slogov.',
		reminder: 'Izberite uro ali opomnik izklopite.',
		size: 'Izberite eno od velikosti.',
		level: 'Izberite eno od treh možnosti.',
		daily: (min, max) => `Izberite število od ${min} do ${max}.`,
		tooLate: 'Prepozno za razveljavitev.'
	},
	voice: {
		backToPractice: 'Nazaj: Vadenje',
		countPattern: 'Vzorec štetja',
		countSub: (pattern) => `Štejte ${pattern}`,
		atBpm: (pattern, bpm) => `${pattern} pri ${bpm} BPM`,
		recording: 'Snemanje',
		pickBars: 'Izberite takte',
		intro:
			'Posnemite, kako štejete, in predvajalnik bo štel z vašim glasom. Pri tempu brez posnetka šteje vgrajeni glas.',
		tempos: 'Tempi',
		record: 'Snemaj',
		redo: 'Ponovi',
		recordLabel: (bpm) => `Snemaj ${bpm} BPM`,
		redoLabel: (bpm) => `Ponovi ${bpm} BPM`,
		recordedTakes: 'Posnetki',
		headphones: 'Najprej si nadenite slušalke',
		headphonesBody: 'Prek zvočnika se klik posname skupaj z vašim glasom.',
		howItGoes: 'Kako poteka',
		stepOne: 'En takt klikov, da ujamete tempo.',
		stepTwoBefore: 'Štejte',
		stepTwoAfter: (bars) => `na glas, ${slCount(bars, ['takt', 'takta', 'takte', 'taktov'])}.`,
		start: 'Začni',
		sayBefore: 'Recite',
		sayAfter: 'zdaj',
		barsCounted: 'Prešteti takti',
		stopNote:
			'Ustavi obdrži vse cele takte, ki ste jih šteli. Ponovi jih zavrže in začne znova z uvodnim taktom.',
		stop: 'Ustavi',
		couldNotSaveTakes: 'Posnetkov ni bilo mogoče shraniti',
		couldNotSaveTakesLine: 'Posnetkov ni bilo mogoče shraniti.',
		pickIntro:
			'Za vsako polovico izberite najboljši takt. Preden ga obdržite, ga poslušajte: prehiter ali nerazločen je slabši od vgrajenega glasu.',
		firstHalf: 'Prva polovica',
		secondHalf: 'Druga polovica',
		counts: (counts) => `Štetje ${counts}`,
		nothingUsable: 'V tej polovici ni nič uporabnega.',
		barFor: (counts) => `Takt za štetje ${counts}`,
		bar: (n) => `Takt ${n}`,
		listen: (n) => `Poslušaj takt ${n}`,
		saving: 'Shranjevanje\u00a0…',
		keep: 'Obdrži izbrane',
		recordAgain: 'Posnemi znova',
		unsaved: 'Vaše posneto štetje',
		pickFirst: 'Najprej izberite takt, ki ga želite obdržati.',
		couldNotDo: 'Tega ni bilo mogoče narediti.',
		uploadFailed: 'Nalaganje ni uspelo.',
		ownVoice: (done, total) => `${done} od ${total} tempov z vašim glasom`,
		recorded: 'Posneto',
		halfRecorded: (counts) => `Pol posneto · štetje ${counts}`,
		notRecorded: 'Ni posneto',
		temposRecorded: (done, total) => `Tempi · posnetih ${done} od ${total}`,
		takeTitle: (bpm, counts) => `${bpm} BPM · štetje ${counts}`,
		takeMeta: (pattern, letter) => `${pattern} · fraza ${letter}`,
		deleteLabel: (bpm, letter) => `Izbriši ${bpm} BPM, fraza ${letter}`,
		deleted: (title) => `Izbrisano: ${title}`,
		keptBoth: (bpm) => `Obe polovici sta shranjeni za ${bpm} BPM`,
		kept: (counts, bpm) => `Shranjeno štetje ${counts} za ${bpm} BPM`,
		nothingCaptured: 'Nič uporabnega ni bilo posneto',
		checkMic: 'Preverite dovoljenje za mikrofon.',
		getReady: 'Pripravite se',
		countIn: 'Uvodni takt',
		startOnNext: 'Začnite šteti ob naslednji enki',
		barOf: (n, bars) => `Takt ${n} od ${bars}`,
		silentOn: (n) => `Pri ${n} tiho`,
		everyBeat: 'Štejte enakomerno, vsak udarec.',
		leaveSilent: (beats) => `Štejte enakomerno, pri ${beats.join(' in ')} pa molčite.`,
		micRefused: 'Mikrofon ni dovoljen',
		micRefusedBody: 'Dovolite ga tej aplikaciji v nastavitvah telefona in poskusite znova.',
		failed: 'Snemanje ni uspelo',
		failedLine: 'Snemanje ni uspelo.',
		noAudio: 'Mikrofon ni zajel nobenega zvoka.',
		unknownTake: 'Neznan posnetek.',
		takeGone: 'Ta posnetek je že izbrisan.',
		newerTake: 'Na tem mestu je zdaj novejši posnetek.',
		takeTooLarge: (limit) => `Posnetek je večji od ${limit}.`
	},
	pair: {
		title: 'Povezava z\u00a0aplikacijo',
		paired: 'Povezano',
		pairedBody: 'Aplikacija se zdaj odpira. Če se ne odpre sama, pritisnite gumb.',
		openApp: 'Odpri aplikacijo',
		pairPhone: 'Poveži ta telefon',
		body: 'Tako lahko aplikacija v ozadju nalaga videe in vas opomni, kaj je na vrsti. V Nastavitvah lahko povezavo spet odstranite.',
		pairing: 'Povezovanje\u00a0…'
	}
};
