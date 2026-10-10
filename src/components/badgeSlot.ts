// Extra HUD chips that live INSIDE the identity card (the "guinomo-badge"):
// the daily-visit streak and the explorer-seals album button. When a profile
// is present the card is visible, so the chips are appended to its meta
// column. Without a profile the card is hidden and the caller falls back to
// its standalone (floating) placement by getting `null` back.

import './badgeSlot.css';

export function badgeChipsSlot(): HTMLElement | null {
  const badge = document.querySelector<HTMLElement>('.guinomo-badge');
  if (!badge || badge.hidden) return null;

  const meta = badge.querySelector<HTMLElement>('.guinomo-badge-meta');
  if (!meta) return null;

  let chips = meta.querySelector<HTMLElement>('.guinomo-badge-chips');
  if (!chips) {
    chips = document.createElement('div');
    chips.className = 'guinomo-badge-chips';
    meta.append(chips);
  }
  return chips;
}