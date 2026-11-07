// The Slovenian catalog, typed against the English one: a missing key fails svelte-check.
//
// Register: vikanje in sentences ("Vnesite kodo", "Ste prepričani?"), short
// imperatives on buttons ("Shrani", "Prekliči"). Plurals through `slCount`.
// Decimal comma. A person's name goes after a colon or a "·", never inside a
// phrase that declines it or a past tense that agrees with it.
//
// Glossary (spec 2026-11-07, "The language"). Use exactly these words; a change
// to one is made here first.
//
//   English (app)                         Slovenian
//   ------------------------------------  ------------------------------------
//   Today                                 Danes
//   Moves (tab)                           Figure
//   a move                                figura
//   a figure (a version of a move)        različica
//   Routine                               kombinacija
//   Drill, exercise                       vaja
//   Lesson                                lekcija
//   Group                                 skupina
//   class (Follow my class, My class)     tečaj
//   Music                                 Glasba
//   Song                                  skladba
//   Position                              položaj
//   Hold                                  drža
//   Section (of a video)                  odsek
//   Point (a saved moment)                točka
//   Recording                             posnetek
//   Set (a logged practice)               vnos
//   Practise                              vadi
//   Count, My count                       štetje, moje štetje
//   Copy, twins                           kopija, dvojčka
//   Levels: Follow my class               Sledim svojemu tečaju
//           Practise and keep my own      Vadim in imam svoje
//           Everything                    Vse
import type { Catalog } from '../catalog';
import { admin } from './admin';
import { common } from './common';
import { settings } from './settings';

export const sl: Catalog = { common, admin, settings };
