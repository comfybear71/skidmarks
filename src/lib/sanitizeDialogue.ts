/** Strip em/en dashes from spoken lines — they cut off ElevenLabs / LTX mid-sentence. */
export function sanitizeDialogueForSpeech(text: string): string {
  return text
    .replace(/\u2014/g, ",") // —
    .replace(/\u2013/g, ",") // –
    .replace(/--+/g, ",")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,+/g, ",")
    .replace(/\s{2,}/g, " ")
    .trim();
}
