/** Scripted talking-plate Position — human only types the Line after this. */
export function compileScriptedPosition(opts: { name: string; place: string }): string {
  const name = opts.name.trim() || "The character";
  const place = opts.place.trim() || "this place";
  const onBed = /\b(bed|bedroom|cell)\b/i.test(place);
  const sit = onBed
    ? `${name} is sitting on the bed, butt on the mattress, knees forward. The bed frame is under and behind them — not on a chair, not standing, not in front of the bed.`
    : `${name} is sitting at ${place}, weight grounded.`;
  return [
    `Medium close-up of ${name} at ${place}. Upper chest and face fill the frame.`,
    sit,
    "Facing camera, mouth clear.",
    "Empty hands in her lap. No phone.",
    `Only ${name} in frame. No other people.`,
  ].join(" ");
}
