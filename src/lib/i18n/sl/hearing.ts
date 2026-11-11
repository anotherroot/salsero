import type { Catalog } from '../catalog';
import { slCount } from '../plural';

const seconds = (s: number) => s.toFixed(1).replace('.', ',');

export const hearing: Catalog['hearing'] = {
	pageTitle: (dance) => `Ali najdete ena? · ${dance}`,
	back: 'Nazaj',
	card: {
		title: 'Ali najdete ena?',
		sub: 'Tapkajte zraven ali začnite sredi skladbe',
		try: 'Poskusite',
		countFirst: 'Deluje, ko nekdo nastavi štetje skladbe'
	},
	setup: {
		kind: 'Način',
		target: 'Poslušajte za',
		part: 'Del skladbe',
		wholeSong: 'Cela skladba',
		ownCounts: 'Vaše številke',
		start: 'Začni'
	},
	kinds: {
		tapAlong: 'Tapkajte zraven',
		dropped: 'Sredi skladbe'
	},
	kindSub: {
		tapAlong: 'Štetje je skrito. Tapkajte zraven do konca.',
		dropped: 'Deset naključnih mest v skladbi. Poiščite udarec in ga tapkajte dve osmici.'
	},
	targets: {
		one: 'Ena',
		every: 'Vsak udarec',
		clave: 'Klava',
		own: 'Svoje'
	},
	tapOn: {
		one: 'Tapnite na ena',
		every: 'Tapnite vsak udarec',
		ones: 'Tapnite na 1 in 5',
		odd: 'Tapnite na 1 3 5 7',
		fourEight: 'Tapnite na 4 in 8',
		clave: 'Tapkajte klavo',
		own: 'Tapnite na svoje številke'
	},
	anywhere: 'kjerkoli tukaj',
	hidden: 'Štetje je skrito do konca',
	drop: (n, of) => `Mesto ${n} od ${of}`,
	listen: 'Poslušajte, nato tapnite',
	keepTapping: 'Tapkajte še dve osmici',
	result: {
		title: 'Kako blizu ste bili'
	},
	eightRow: (n) => `Osmica ${n}`,
	reset: 'Znova',
	skip: 'Preskoči',
	startOver: {
		noTap: 'Štiri osmice brez tapa: znova od začetka mesta',
		stopped: 'Nehali ste: znova od začetka mesta',
		reset: 'Od začetka tega mesta'
	},
	listening: 'Poslušajte …',
	listenFirst: 'najprej poslušajte',
	nextSpot: 'prihaja naslednje mesto',
	restartsLine: (n) => slCount(n, ['ponovitev', 'ponovitvi', 'ponovitve', 'ponovitev']),
	firstTry: 'V prvo',
	posName: (whole, and) => (and ? `»in« po ${whole}` : `${whole}`),
	score: {
		title: (n) => `Ocena ${n}`,
		onBeat: (hit, of) => `${hit} od ${of} na udarcu`,
		findEach: (s) => `približno ${seconds(s)} s za vsako mesto`,
		timing: 'Natančnost',
		restarts: 'Ponovitve',
		listening: 'Poslušanje',
		stackTitle: 'Vse vaše osmice, ena čez drugo',
		stackLabel: 'Vsak tap igre pod udarcem, za katerega je bil',
		early: '◂ prezgodaj',
		late: 'prepozno ▸',
		dropRow: (n, section) => (section ? `Mesto ${n} · ${section}` : `Mesto ${n}`),
		counted: (hit, of) => `${hit} od ${of}`,
		skipped: 'preskočeno',
		replayDrop: (n) => `Znova predvajaj mesto ${n}`,
		verdict: {
			late: (pos) => `Zamujate na ${pos}`,
			early: (pos) => `Prehitevate na ${pos}`,
			offSub: (ms) => `Približno ${ms} ms, skoraj vsakič. Drugo je pravočasno.`,
			missed: (pos) => `Najpogosteje zgrešite ${pos}`,
			missedSub: (n, of) => `${n}-krat od ${of}.`,
			onTime: 'Vse pravočasno',
			onTimeSub: 'Vsak udarec znotraj 60 ms.'
		}
	},
	replay: {
		title: (n) => `Znova · mesto ${n}`,
		countOn: 'Štetje je vključeno',
		yourTap: 'vaš tap',
		onTime: 'pravočasno',
		close: 'blizu',
		missed: 'zgrešeno',
		now: 'zdaj',
		back: 'Nazaj na rezultat',
		prev: 'Udarec nazaj',
		next: 'Udarec naprej',
		play: 'Predvajaj',
		pause: 'Premor',
		slower: 'Počasneje'
	},
	clave: {
		t23: 'Klava 2-3: dva udarca, nato trije',
		p23: 'Na 2 in na 3, nato na 5, na »in« po 6 (med 6 in 7) in na 8.',
		t32: 'Klava 3-2: trije udarci, nato dva',
		p32: 'Na 1, na »in« po 2 (med 2 in 3) in na 4, nato na 6 in na 7.',
		hear: 'Poslušaj'
	},
	count: {
		off: (n) => `Zamaknjeno za ${slCount(n, ['štetje', 'štetji', 'štetja', 'štetij'])}`,
		right: 'Pravo štetje',
		keeps: (pct) => `obdrži ${pct} %`,
		tag: (n) => `zamik ${n}`,
		you: (n) => `vi ${n}`,
		verdict: (yours, music) => `Vaša ${yours} je bila glasbena ${music}`,
		tip4: 'Poslušajte, kje bas in klavir pristaneta skupaj: tam je ena.',
		tip2: 'Vsak tap na udarcu, zamaknjeno za dve štetji.',
		tip1: 'Lihe in sode ste zamenjali. Poskusite 1 3 5 7, da slišite, kateri udarci vodijo.',
		part: 'Štetje',
		dropsOff: (n) => `${slCount(n, ['mesto', 'mesti', 'mesta', 'mest'])} z zamikom`,
		often: (yours, music) => `Vaša ${yours} je bila pogosto ${music}`,
		oftenSub: (n) =>
			`${slCount(n, ['mesto', 'mesti', 'mesta', 'mest'])} šteto od tam. Udarec je, delo je ena.`
	},
	again: 'Še enkrat',
	done: 'Končano',
	stop: 'Ustavi',
	check: {
		title: 'Vaša zakasnitev tapa',
		intro:
			'Nekaj sekund tapkajte s štetjem. Nato se vaši tapi merijo od trenutka, ko slišite udarec.',
		tapWith: 'Tapnite ob vsakem štetju',
		progress: (n, of) => `${n} od ${of} tapov`,
		result: (ms) => `Tapnete ${ms} ms po tem, ko slišite`,
		uneven: 'Tapi so bili neenakomerni. Poskusite znova.',
		save: 'Uporabi',
		again: 'Še enkrat',
		skip: 'Zdaj preskoči',
		start: 'Začni',
		row: 'Preveri zakasnitev tapa',
		rowValue: (ms) => (ms === null ? 'Ni preverjeno' : `${ms} ms`)
	}
};
