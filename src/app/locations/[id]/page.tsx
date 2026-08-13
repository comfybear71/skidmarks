"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { LocationEditor } from "@/components/LocationEditor";

export default function LocationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);

  return (
    <div className="space-y-6">
      <Link
        href="/locations"
        className="text-xs uppercase tracking-[0.16em] text-[var(--mute)] hover:text-[var(--acid)]"
      >
        ← Location Lab
      </Link>
      <LocationEditor locationId={id} onDeleted={() => router.push("/locations")} />
    </div>
  );
}
