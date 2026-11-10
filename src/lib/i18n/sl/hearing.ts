import type { Catalog } from '../catalog';

const seconds = (s: number) => s.toFixed(1).replace('.', ',');

export const hearing: Catalog['hearing'] = {
	pageTitle: (dance) => `Ali najdete ena? · ${dance}`,
	back: 'Nazaj',
	card: {
		title: 'Ali najdete ena?',
		sub: 'Tapkajte zraven ali začnite sredi skladbe',
		try: 'Poskusite',
		countFirst: 'Za to najprej nastavite štetje'
	},
	setup: {
		kind: 'Način',
		target: 'Poslušajte za',
		part: 'Del skladbe',
		wholeSong: 'Cela skladba',
		start: 'Začni'
	},
	kinds: {
		tapAlong: 'Tapkajte zraven',
		dropped: 'Sredi skladbe'
	},
	kindSub: {
		tapAlong: 'Štetje je skrito. Tapkajte zraven do konca.',
		dropped: 'Deset naključnih mest v skladbi. Vsakič poiščite naslednjo.'
	},
	targets: {
		one: 'Ena',
		every: 'Vsak udarec',
		clave: 'Klava'
	},
	onTarget: {
		one: 'na ena',
		every: 'na udarec',
		ones: 'na 1 in 5',
		odd: 'na 1 3 5 7',
		fourEight: 'na 4 in 8',
		clave: 'na klavo'
	},
	tapOn: {
		one: 'Tapnite na ena',
		every: 'Tapnite vsak udarec',
		ones: 'Tapnite na 1 in 5',
		odd: 'Tapnite na 1 3 5 7',
		fourEight: 'Tapnite na 4 in 8',
		clave: 'Tapkajte klavo'
	},
	tapNext: {
		one: 'Tapnite naslednjo ena',
		every: 'Tapnite naslednji udarec',
		ones: 'Tapnite naslednjo 1 ali 5',
		odd: 'Tapnite naslednjo 1, 3, 5 ali 7',
		fourEight: 'Tapnite naslednjo 4 ali 8',
		clave: 'Tapnite naslednji udarec klave'
	},
	anywhere: 'kjerkoli tukaj',
	hidden: 'Štetje je skrito do konca',
	drop: (n, of) => `Mesto ${n} od ${of}`,
	listen: 'Poslušajte, nato tapnite',
	reveal: {
		spot: 'Točno',
		late: (ms) => `Najdeno · ${ms} ms prepozno`,
		early: (ms) => `Najdeno · ${ms} ms prezgodaj`,
		other: (count) => `To je bila ${count}`,
		missed: 'Ni na udarcu'
	},
	result: {
		title: 'Kako blizu ste bili',
		score: (hit, of) => `${hit} od ${of}`,
		late: (ms) => `V povprečju ${ms} ms prepozno`,
		early: (ms) => `V povprečju ${ms} ms prezgodaj`,
		onTime: 'V povprečju pravočasno',
		listened: (s) => `Pred tapom ste poslušali približno ${seconds(s)} s`,
		verdict: {
			on: 'Pravočasno',
			late: (ms) => `Prepozno, ${ms} ms`,
			early: (ms) => `Prezgodaj, ${ms} ms`,
			other: (count) => `Na ${count}`,
			missed: 'Zgrešeno'
		},
		wholeSong: 'Skladba',
		drop: (n) => `Mesto ${n}`,
		noTap: 'Brez tapa',
		strip: 'Vaši tapi na štetju, ena vrstica na osmico'
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
