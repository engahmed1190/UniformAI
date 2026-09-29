// lib/pace.ts
// A person pauses before answering. The dock waits this long from the tap
// (time spent fetching counts toward it) and shows that it is typing.

export const TYPING = { min: 600, max: 1000, perChar: 4, reduced: 150 } as const;

export function typingMs(text: string, reduced: boolean): number {
  if (reduced) return TYPING.reduced;
  return Math.min(TYPING.max, TYPING.min + TYPING.perChar * text.length);
}
