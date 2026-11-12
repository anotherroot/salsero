import type { Catalog } from '../catalog';
import { nouns } from './nouns';

const pct = (n: number) => `${n}\u00a0%`;

export const refusals: Catalog['refusals'] = {
	signIn: 'Prijavite se',
	notFound: 'Ni najdeno',
	notFoundLine: 'Ni najdeno.',
	noDance: 'Ta ples ne obstaja',
	unknownDance: 'Neznan ples',
	noLesson: 'Lekcija ne obstaja',
	noExercise: 'Vaja ne obstaja',
	noSet: 'Vnos ne obstaja',
	noRoutine: 'Kombinacija ne obstaja',
	noGroup: 'Skupina ne obstaja',
	noSong: 'Skladba ne obstaja',
	songNotFound: 'Skladbe ni mogoče najti',
	figureNotFound: 'Figura ne obstaja',
	moveNotFound: 'Gib ne obstaja',
	positionNotFound: 'Položaj ne obstaja',
	noAnalysedSong: 'Tu ni analizirane skladbe',
	notCounted: 'Ta skladba še nima svojega štetja',
	noHearingSongs: 'Nobene pesmi te vaje ni mogoče predvajati: najprej nastavite njihovo štetje',
	nothingShared: 'Nič ni prispelo',
	// After a colon, mid-sentence: »… že obstaja: ta gib · Doble.«
	thatMove: 'ta gib',
	badRequest: 'Napačna zahteva',
	badJson: 'Napačen JSON.',
	crossSite: 'Pošiljanje obrazca z drugega spletnega mesta ni dovoljeno.',
	couldNotSave: 'Shranjevanje ni uspelo. Poskusite znova.',
	stale: 'Ta stran je zastarela. Za nadaljevanje jo naložite znova.',
	sayWhatToRestore: 'Navedite, kaj želite obnoviti.',
	practiceSettings: 'Teh nastavitev vadenja ni mogoče uporabiti.',
	spots: {
		nameVideoQuery: 'Navedite en video: ?recording= ali ?lessonVideo=.',
		nameVideoBody: 'Navedite en video: recordingId ali lessonVideoId.',
		nothingToChange: 'Ni sprememb.',
		sendTarget: 'Pošljite cilj ali to, kar naj se ustvari.'
	},
	take: {
		unknownPattern: 'Neznan vzorec štetja.',
		tempo: 'Ta tempo ni med posnetimi.',
		phrase: 'Fraza mora biti a ali b.',
		metadata: 'Napačni podatki posnetka.',
		shorter: 'Posnetek ne more biti krajši od svoje fraze.',
		empty: 'Nalaganje je prazno.'
	},
	chunk: {
		badUploadId: 'Napačna oznaka nalaganja.',
		noRange: 'Potrebna je glava content-range v obliki bytes <start>-<end>/<total>.',
		tooBig: 'Ta kos je prevelik.',
		empty: 'Kos je prazen.',
		busy: 'To nalaganje se že zapisuje.',
		wrongPlace: 'Ta kos se ne začne tam, kjer se datoteka konča.',
		hostLimit: 'Strežnik je zavrnil kos te velikosti. Preverite BODY_SIZE_LIMIT na gostitelju.',
		notSaved: 'Tega kosa ni bilo mogoče shraniti.'
	},
	files: {
		overLimit: (mb, limit) => `Datoteka meri ${mb} MB; največ je ${limit}.`,
		audioOnly: 'Dodate lahko samo zvočne datoteke.',
		audioOnlyBody: 'Video izberite z gumbom Dodaj video.',
		videoOnly: 'Dodate lahko samo video datoteke.',
		videoOrAudio: 'Dodate lahko samo video ali zvočne datoteke.',
		reason: {
			notVideo: 'ni video',
			overLimit: (size, limit) => `${size} — največ je ${limit}`,
			connection: 'povezava se je prekinila',
			outOfStep: 'nalaganje se je razšlo s strežnikom',
			notSaved: 'nalaganje je končano, video pa ni bil shranjen',
			status: (status) => `strežnik je vrnil ${status}`
		},
		skipped: (list) => `Izpuščeno: ${list}.`,
		addedThenSkipped: (n, skipped) => `Dodano: ${nouns.videos(n)}. ${skipped}`,
		someSkipped: 'Nekatere datoteke so bile izpuščene',
		oneNotAdded: 'Datoteka ni bila dodana',
		noneAdded: 'Noben video ni bil dodan',
		retrying: 'Povezava se je prekinila — ponovni poskus',
		retryingHelper: (n) => `Nadaljuje od tega, kar strežnik že ima · ${pct(n)}`,
		uploading: (n, index, count) =>
			`Nalaganje${index === null ? '' : ` (${index} od ${count})`}\u00a0… ${pct(n)}`,
		keepOpen: 'Pustite to stran odprto — če jo osvežite, se nalaganje začne znova'
	}
};
