"use client";

import { useEffect, useState } from "react";
import {
  BUILTIN_DESKS,
  MOBILE_DESK_EVENT,
  deskLabel,
  normalizeDeskId,
  readDeskId,
  readKnownDesks,
  writeDeskId,
} from "@/lib/mobileDesk";

/**
 * Whose phone. Mum and Stuie were sharing one last-job cookie.
 * Not a password login — a desk switch so her plates stay off his pack.
 */
export function DeskSwitcher({ onChange }: { onChange?: (deskId: string) => void }) {
  const [desk, setDesk] = useState("stuie");
  const [desks, setDesks] = useState(BUILTIN_DESKS.map((d) => d.id));
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    setDesk(readDeskId(window.localStorage));
    setDesks(readKnownDesks(window.localStorage));
  }, []);

  function pick(id: string) {
    const next = writeDeskId(window.localStorage, id);
    setDesk(next);
    setDesks(readKnownDesks(window.localStorage));
    window.dispatchEvent(new Event(MOBILE_DESK_EVENT));
    onChange?.(next);
  }

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "6px",
        alignItems: "center",
        padding: "10px 16px 0",
      }}
    >
      <div
        style={{
          color: "var(--chrome-dim)",
          fontSize: "10px",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginRight: "4px",
        }}
      >
        Desk
      </div>
      {desks.map((id) => {
        const on = id === desk;
        return (
          <button
            key={id}
            type="button"
            onClick={() => pick(id)}
            style={{
              padding: "5px 10px",
              borderRadius: "2px",
              border: on ? "1px solid var(--acid)" : "1px solid var(--line)",
              background: on ? "var(--acid)" : "var(--panel-2)",
              color: on ? "#111" : "var(--chrome)",
              fontSize: "12px",
              fontWeight: 700,
            }}
          >
            {deskLabel(id)}
          </button>
        );
      })}
      {adding ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const id = normalizeDeskId(name);
            if (id) pick(id);
            setName("");
            setAdding(false);
          }}
          style={{ display: "flex", gap: "4px" }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            autoFocus
            style={{
              width: "90px",
              padding: "5px 8px",
              borderRadius: "2px",
              border: "1px solid var(--line)",
              background: "var(--panel-2)",
              color: "var(--chrome)",
              fontSize: "12px",
            }}
          />
          <button
            type="submit"
            style={{
              padding: "5px 8px",
              borderRadius: "2px",
              border: "1px solid var(--acid)",
              background: "transparent",
              color: "var(--acid)",
              fontSize: "12px",
              fontWeight: 700,
            }}
          >
            Go
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          style={{
            padding: "5px 8px",
            borderRadius: "2px",
            border: "1px dashed var(--line)",
            background: "transparent",
            color: "var(--chrome-dim)",
            fontSize: "12px",
          }}
        >
          +
        </button>
      )}
    </div>
  );
}
