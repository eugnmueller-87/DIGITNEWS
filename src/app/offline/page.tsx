import type { Metadata } from "next";

import { PageShell, Alert } from "@/components/ui";

export const metadata: Metadata = { title: "Offline" };

/** Shown when a navigation fails and there's no cached page. */
export default function OfflinePage() {
  return (
    <PageShell title="Offline">
      <Alert variant="info">
        Du bist gerade offline. Sobald du wieder Verbindung hast, lädt die Seite
        automatisch.
      </Alert>
    </PageShell>
  );
}
