// Pure secret-guidance logic for the compass HUD: the distance thresholds and
// the whispered hints that grow more precise as the player approaches the
// secret. Kept free of DOM/three so it is trivially unit-testable.

/** Distance (metres) under which the compass hides — the player has arrived. */
export const HIDE_DISTANCE = 5;

/** Distance (metres) under which the label pulses to signal "almost there". */
export const NEAR_PULSE_DISTANCE = 18;

interface Whisper {
  min: number;
  pt: string;
  en: string;
}

/** Whispered hints, keyed by the distance bracket they apply to (min metres). */
const WHISPERS: Whisper[] = [
  {
    min: 60,
    pt: 'Algo estranho espreita por aí, para lá das ruas…',
    en: 'Something odd is lurking out there, beyond the streets…',
  },
  {
    min: 35,
    pt: 'Estás a aproximar-te… ele já te viu.',
    en: 'You are getting closer… it has seen you.',
  },
  {
    min: 18,
    pt: 'Continua… está mesmo adiante.',
    en: 'Keep going… it is dead ahead.',
  },
  {
    min: HIDE_DISTANCE,
    pt: 'Ouve… o segredo está mesmo ao lado.',
    en: 'Listen… the secret is right beside you.',
  },
];

/**
 * Whisphered hint for a distance to the secret, in the requested language.
 * Returns '' when the player has already arrived (compass is hidden anyway).
 */
export function whisperForDistance(distance: number, english: boolean): string {
  const entry = WHISPERS.find((whisper) => distance >= whisper.min);
  if (!entry) return '';
  return english ? entry.en : entry.pt;
}