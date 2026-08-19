"use client";

import type { ScratchFaceRecord, ScratchSendLayer } from "@/lib/scratchStillSend";

export function ScratchFloorPanel({
  faces,
  layers,
  joOnPad,
  joPhone,
  onJoPhone,
  disabled,
}: {
  faces: ScratchFaceRecord[];
  layers: ScratchSendLayer[];
  joOnPad: boolean;
  joPhone: boolean;
  onJoPhone: (on: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="scratch-floor">
      <div className="scratch-group-label">Studio floor</div>
      <p className="scratch-floor-lead">
        Models can Fail a still. The studio must not. Face record + Draw send below is what goes — nothing behind the box.
      </p>
      <div className="scratch-group-label">Face record</div>
      {faces.length ? (
        faces.map((f) => (
          <div key={f.name} className="scratch-floor-face">
            <strong>{f.name}</strong>
            {f.fileName ? <span> · {f.fileName}</span> : null}
            <p>{f.look.trim() || "(no look-words saved on this thumb)"}</p>
          </div>
        ))
      ) : (
        <p className="scratch-floor-lead">Park a face on the room to see the card Draw will copy.</p>
      )}
      {joOnPad ? (
        <label className="scratch-floor-jo">
          <input
            type="checkbox"
            checked={joPhone}
            disabled={disabled}
            onChange={(e) => onJoPhone(e.target.checked)}
          />
          Jo phone / maniac — only because Jo is on the pad
        </label>
      ) : null}
      <div className="scratch-group-label">Draw send</div>
      {layers.map((layer) => (
        <details key={layer.id} className="scratch-floor-layer">
          <summary>{layer.label}</summary>
          <pre>{layer.text}</pre>
        </details>
      ))}
    </div>
  );
}
