/** A tick that scales with the text it sits in. One drawing, so the kit
 *  card, the step trail and the order timeline cannot render three glyphs. */
export function Check() {
  return (
    <svg width="1em" height="1em" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8.5l3 3 7-7" />
    </svg>
  );
}
