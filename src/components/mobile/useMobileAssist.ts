"use client";

import { useState } from "react";
import { requestAssist } from "@/lib/mobileAssistClient";
import type { AssistKind } from "@/lib/mobileAssist";

export function useMobileAssist(
  kind: AssistKind,
  styleId: string,
  getText: () => string,
  setText: (text: string) => void,
  hint?: string,
) {
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");

  async function runAssist() {
    setAiBusy(true);
    setAiError("");
    try {
      const next = await requestAssist({
        kind,
        text: getText(),
        styleId,
        hint,
      });
      setText(next);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "AI assist failed");
    } finally {
      setAiBusy(false);
    }
  }

  return { aiBusy, aiError, runAssist };
}
