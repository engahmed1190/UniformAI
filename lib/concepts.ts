import type { Concept } from './spec';
import { applyBrief } from './refine';

// Canned concept library. Stands in for the generation call: a brief selects
// from these instead of a model writing one. Everything downstream -- render,
// edit, price -- is the real code path.
// ponytail: hand-authored. Swap selectConcepts() for an API call when live
// generation earns it; nothing else changes.

export const CONCEPTS: Concept[] = [
  {
    id: 'front-office',
    name: 'Front Office',
    garments: [
      {
        type: 'shirt',
        parts: { body: '#ffffff', collar: '#ffffff', cuffs: '#ffffff' },
        fabric: 'Cotton Poplin 130 GSM',
        fit: 'regular',
        unitPrice: 380,
      },
      {
        type: 'chino',
        parts: { leg: '#1b2a4a' },
        fabric: 'Cotton Twill 240 GSM',
        fit: 'regular',
        unitPrice: 420,
      },
      {
        type: 'blazer',
        parts: { body: '#1b2a4a', lapel: '#1b2a4a', buttons: '#c8a24a' },
        fabric: 'Wool Blend 260 GSM',
        fit: 'regular',
        unitPrice: 1150,
      },
    ],
    cuts: ['men', 'women'],
    logo: { position: 'left_chest', method: 'embroidery' },
  },
  {
    id: 'operations',
    name: 'Operations',
    garments: [
      {
        type: 'polo',
        parts: { body: '#1b2a4a', collar: '#ffffff', placket: '#ffffff' },
        fabric: 'Cotton Pique 220 GSM',
        fit: 'regular',
        unitPrice: 260,
      },
      {
        type: 'cargo',
        parts: { leg: '#3d4a3a', pockets: '#3d4a3a' },
        fabric: 'Ripstop Cotton 280 GSM',
        fit: 'relaxed',
        unitPrice: 460,
      },
    ],
    cuts: ['men', 'women'],
    logo: { position: 'left_chest', method: 'embroidery' },
  },
  {
    id: 'management',
    name: 'Management',
    garments: [
      {
        type: 'shirt',
        parts: { body: '#dfe6ef', collar: '#ffffff', cuffs: '#ffffff' },
        fabric: 'Egyptian Cotton 120 GSM',
        fit: 'slim',
        unitPrice: 520,
      },
      {
        type: 'chino',
        parts: { leg: '#2f3640' },
        fabric: 'Wool Blend 240 GSM',
        fit: 'slim',
        unitPrice: 640,
      },
      {
        type: 'blazer',
        parts: { body: '#2f3640', lapel: '#2f3640', buttons: '#8a8f98' },
        fabric: 'Wool Blend 300 GSM',
        fit: 'slim',
        unitPrice: 1480,
      },
    ],
    cuts: ['men', 'women'],
    logo: { position: 'sleeve', method: 'embroidery' },
  },
  {
    id: 'technicians',
    name: 'Technicians',
    garments: [
      {
        type: 'polo',
        parts: { body: '#c8b393', collar: '#7a6a4f', placket: '#7a6a4f' },
        // The fabric step's base grade is cotton pique 220. A seed naming a
        // different cloth made the quote contradict the option the customer
        // had selected on screen.
        fabric: 'Cotton Pique 220 GSM',
        fit: 'relaxed',
        unitPrice: 230,
      },
      {
        type: 'cargo',
        parts: { leg: '#7a6a4f', pockets: '#6a5c44' },
        fabric: 'Ripstop Poly-Cotton 300 GSM',
        fit: 'relaxed',
        unitPrice: 440,
      },
    ],
    cuts: ['men', 'women'],
    logo: { position: 'back', method: 'print' },
  },
];

/** Stands in for generation: pick concepts matching the brief, then bend
 *  them to the colour and logo placement the brief actually named. Picking
 *  alone was the tell -- a brief saying "navy, logo on the chest" came back
 *  sand with the logo on the back, while the copy above it quoted the brief.
 *  ponytail: keyword match, not a model. Real generation replaces this body. */
export function selectConcepts(brief: { industry: string }): Concept[] {
  const industrial = /facilit|construc|manufact|logist|industr|technic/i.test(
    brief.industry,
  );
  const seeds = industrial
    ? [CONCEPTS[3], CONCEPTS[1], CONCEPTS[0]]
    : [CONCEPTS[0], CONCEPTS[1], CONCEPTS[2]];
  return seeds.map((c) => applyBrief(c, brief.industry));
}
