import type { Catalog } from '../catalog';
import { slCount } from '../plural';

// The map of positions (položaji) and the walk (sprehod) that builds a kombinacija. A
// position's name stands after a colon, a "·" or an arrow, never declined.
export const map: Catalog['map'] = {
	title: 'Zemljevid',
	back: 'Nazaj na položaje',
	whole: 'Cel zemljevid',
	info: 'Kako deluje zemljevid',
	hint: 'Dotaknite se položaja in videli boste, kam vodi.',
	empty: 'Še ni položajev. Dodajte jih pri Položajih in označite začetke in konce svojih različic.',
	unjoined: 'Noben položaj še ni povezan: označite začetek in konec različice.',
	mark: { deadEnd: 'slepa ulica', orphan: 'brez prihoda' },
	twins: 'Dvojčka',
	fitsAnywhere: 'Različice brez položaja ustrezajo povsod.',
	label: (groupMode) => (groupMode ? 'Zemljevid položajev skupine' : 'Zemljevid vaših položajev'),
	summary: (n) => {
		const parts = [slCount(n.positions, ['položaj', 'položaja', 'položaji', 'položajev'])];
		if (n.between > 0)
			parts.push(
				`${slCount(n.between, ['različica', 'različici', 'različice', 'različic'])} med njimi`
			);
		if (n.none > 0) parts.push(`${n.none} brez`);
		if (n.stranded > 0) parts.push(`${n.stranded} obtičalih`);
		return parts.join(' · ');
	},
	nodeName: (n) => {
		const parts = [n.name, `${n.ins} noter`, `${n.outs} ven`];
		if (n.mark) parts.push(n.mark === 'dead end' ? 'slepa ulica' : 'brez prihoda');
		if (n.twins) parts.push(n.twins);
		return parts.join(' · ');
	},
	chip: {
		orphans: (n) => `${n} brez prihoda`,
		deadEnds: (n) => slCount(n, ['slepa ulica', 'slepi ulici', 'slepe ulice', 'slepih ulic']),
		unused: (n) => `${n} neuporabljenih`,
		noPosition: (n) => `${n} brez položaja`
	},
	legend: {
		deadEnd: 'slepa ulica: nič ne vodi naprej',
		orphan: 'brez prihoda: nič ne vodi sem',
		island: 'otok: odrezan od ostalih',
		arrows: 'Debelejše puščice: več različic · številka: koliko',
		out: 'Vinsko rdeča: kam vodi',
		in: 'Modra: od kod prihaja',
		gestures: 'Povečajte s ščipom · dvakrat se dotaknite za ves zemljevid'
	},
	sheet: {
		backTo: (name) => `Nazaj: ${name}`,
		insOuts: (i, o) =>
			`${slCount(i, ['različica', 'različici', 'različice', 'različic'])} noter · ${o} ven`,
		open: 'Odpri',
		stays: 'Ostane tu:',
		from: 'Od',
		nothingIn: 'Sem še nič ne vodi',
		stepTo: 'Korak v',
		anywhere: 'Kjerkoli',
		noEnd: 'Konec ni določen',
		nothingOut: 'Od tu še nič ne vodi',
		walk: 'Sprehod od tu'
	},
	walk: {
		title: (start) => `Sprehod: ${start}`,
		status: (n, at) =>
			n === 0
				? 'Še ni različic'
				: at === null
					? slCount(n, ['različica', 'različici', 'različice', 'različic'])
					: `${slCount(n, ['različica', 'različici', 'različice', 'različic'])} · zdaj v: ${at}`,
		undo: 'Razveljavi',
		clear: 'Počisti',
		make: (n) => `Naredi kombinacijo · ${n}`,
		next: (at, n) => `Naprej od: ${at} · ${slCount(n, ['mesto', 'mesti', 'mesta', 'mest'])}`,
		to: (name) => `→ ${name}`,
		stays: (name) => `↻ Ostane v: ${name}`,
		anywhere: 'Kjerkoli (brez konca)',
		fitsAnywhere: (n) => `Ustreza povsod · ${n}`,
		carryOn: (fig) =>
			`${fig}: konec ni določen, zato lahko sledi karkoli. Za nadaljevanje se dotaknite položaja na zemljevidu.`,
		stuck: (name) =>
			`Iz položaja ${name} ne vodi nič. Razveljavite ali naredite kombinacijo, kot je.`,
		hint: 'Dotaknite se različice spodaj, da jo dodate. Vsaka se začne tam, kjer se je prejšnja končala.',
		unsaved: 'Sprehod po zemljevidu',
		defaultName: (start) => `Sprehod: ${start}`,
		newRoutine: 'Nova kombinacija',
		name: 'Ime',
		nameError: 'Kombinaciji dajte ime (do 200 znakov).',
		noFigures: 'Najprej dodajte vsaj eno različico.',
		notFound: 'Različice ni mogoče najti',
		create: 'Ustvari kombinacijo',
		creating: 'Ustvarjanje kombinacije',
		path: 'Sprehod doslej'
	}
};
