import type { Catalog } from '../catalog';
import { slCount } from '../plural';
import { nouns } from './nouns';
import { positions } from './positions';

// The map of positions (položaji) and the walk (sprehod) that builds a kombinacija. A
// position's name stands after a colon, a "·" or an arrow, never declined. The marks
// and the legend are the Positions list's gap words (`positions.gaps`); a figure's
// arrivals and departures are its counts (`positions.counts`: prihod, odhod).
export const map: Catalog['map'] = {
	title: 'Zemljevid',
	back: 'Nazaj: Položaji',
	whole: 'Cel zemljevid',
	info: 'Kako deluje zemljevid',
	hint: 'Pritisnite položaj, da vidite, kam vodi.',
	empty:
		'Še ni položajev. Dodajte jih na strani Položaji in označite, kje se vaše figure začnejo in končajo.',
	unjoined: 'Vaših položajev še nič ne povezuje: označite začetek in konec figure.',
	mark: { deadEnd: positions.gaps.deadEnd, orphan: positions.gaps.orphan },
	twins: 'Dvojčka',
	// Names are never declined: the place goes in brackets after them.
	yourTwin: (name) => `${name} (vaš)`,
	teamTwin: (team, name) => `${name} (skupina: ${team})`,
	fitsAnywhere: 'Figure brez položaja ustrezajo kjer koli.',
	label: (groupMode) => (groupMode ? 'Zemljevid položajev skupine' : 'Zemljevid vaših položajev'),
	summary: (n) => {
		const parts = [nouns.positions(n.positions)];
		if (n.between > 0) parts.push(`${nouns.figures(n.between)} med njimi`);
		// Counts after a colon: the adjective would have to agree with them.
		if (n.none > 0) parts.push(`brez položaja: ${n.none}`);
		if (n.stranded > 0) parts.push(`z vrzeljo: ${n.stranded}`);
		return parts.join(' · ');
	},
	nodeName: (n) => {
		const parts = [n.name, positions.counts.ins(n.ins), positions.counts.outs(n.outs)];
		if (n.mark) parts.push(n.mark === 'dead end' ? positions.gaps.deadEnd : positions.gaps.orphan);
		if (n.twins) parts.push(n.twins);
		return parts.join(' · ');
	},
	chip: {
		orphans: (n) => `${positions.gaps.orphan}: ${n}`,
		deadEnds: (n) => slCount(n, ['slepa ulica', 'slepi ulici', 'slepe ulice', 'slepih ulic']),
		unused: (n) =>
			slCount(n, [
				'neuporabljen položaj',
				'neuporabljena položaja',
				'neuporabljeni položaji',
				'neuporabljenih položajev'
			]),
		noPosition: (n) => `brez položaja: ${n}`
	},
	legend: {
		deadEnd: 'slepa ulica: nič ne gre od tod',
		orphan: 'nedosegljiv: nič ne pride sem',
		island: 'otok: odrezan od drugih',
		arrows: 'Debelejše puščice: več figur · številka: koliko',
		out: 'Vinsko rdeča: kam vodi',
		in: 'Modra: od kod prihaja',
		gestures: 'Povečajte z dvema prstoma · dvakrat pritisnite za ves zemljevid'
	},
	sheet: {
		backTo: (name) => `Nazaj: ${name}`,
		insOuts: (i, o) => `${positions.counts.ins(i)} · ${positions.counts.outs(o)}`,
		open: 'Odpri',
		stays: 'Ostane tu:',
		from: 'Od',
		nothingIn: 'Sem še nič ne vodi',
		stepTo: 'Korak v',
		anywhere: 'Kjer koli',
		noEnd: 'Konec ni določen',
		nothingOut: 'Od tu še nič ne vodi',
		walk: 'Sprehod od tu'
	},
	walk: {
		title: (start) => `Sprehod: ${start}`,
		status: (n, at) =>
			n === 0
				? 'Še ni figur'
				: at === null
					? nouns.figures(n)
					: `${nouns.figures(n)} · zdaj: ${at}`,
		undo: 'Razveljavi',
		clear: 'Počisti',
		make: (n) => `Naredi kombinacijo · ${n}`,
		// The places are where the walk can go next, not a routine's slots (mesta).
		next: (at, n) =>
			`Naprej od: ${at} · ${slCount(n, ['možnost', 'možnosti', 'možnosti', 'možnosti'])}`,
		to: (name) => `→ ${name}`,
		stays: (name) => `↻ Ostane: ${name}`,
		anywhere: 'Kjer koli (brez konca)',
		fitsAnywhere: (n) => `Ustreza kjer koli · ${n}`,
		carryOn: (fig) =>
			`${fig}: konec ni določen, zato lahko sledi karkoli. Za nadaljevanje pritisnite položaj na zemljevidu.`,
		stuck: (name) => `${name}: od tod ne vodi nič. Razveljavite ali naredite kombinacijo, kot je.`,
		hint: 'Pritisnite figuro spodaj, da jo dodate. Vsaka se začne tam, kjer se je prejšnja končala.',
		unsaved: 'Sprehod po zemljevidu',
		defaultName: (start) => `Sprehod: ${start}`,
		newRoutine: 'Nova kombinacija',
		name: 'Ime',
		nameError: 'Kombinaciji dajte ime (do 200 znakov).',
		noFigures: 'Najprej dodajte vsaj eno figuro.',
		notFound: 'Figure ni mogoče najti',
		create: 'Ustvari kombinacijo',
		creating: 'Ustvarjanje kombinacije',
		path: 'Sprehod doslej'
	}
};
