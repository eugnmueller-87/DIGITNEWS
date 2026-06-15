"use client";

import { useState, useTransition } from "react";

import { Card, Alert, MiniButton } from "@/components/ui";
import type { Role } from "@/lib/database.types";
import { useT } from "@/lib/i18n/provider";

import { deleteOwnAccount } from "./actions";

/**
 * Account deletion (GDPR). Two-step confirm. The server flow refuses if the user
 * is the last admin of an org. Superadmins (operators) can't self-delete here.
 */
export function DeleteAccountPanel({
  role,
  warnLastAdmin,
}: {
  role: Role;
  warnLastAdmin: boolean;
}) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (role === "superadmin") {
    return (
      <Card>
        <h2 className="font-display text-base font-semibold text-ink">
          {t.settings.deleteHeading}
        </h2>
        <p className="mt-1 text-sm font-semibold text-ink-soft">
          {t.settings.deleteOperatorBlocked}
        </p>
      </Card>
    );
  }

  function remove() {
    setError(null);
    start(async () => {
      const res = await deleteOwnAccount();
      // On success the action redirects; we only get here on error.
      if (res && !res.ok) {
        setError(res.message);
        setConfirming(false);
      }
    });
  }

  return (
    <Card className="border-tomato">
      <h2 className="font-display text-base font-semibold text-tomato">
        {t.settings.deleteHeading}
      </h2>
      <p className="mt-1 text-sm font-semibold text-ink-soft">
        {t.settings.deleteWarning}
        {warnLastAdmin && ` ${t.settings.deleteLastAdmin}`}
      </p>

      {error && (
        <div className="mt-2">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      <div className="mt-3">
        {confirming ? (
          <div className="flex gap-2">
            <MiniButton tone="danger" disabled={pending} onClick={remove}>
              {pending ? t.settings.deleting : t.settings.deleteConfirm}
            </MiniButton>
            <MiniButton disabled={pending} onClick={() => setConfirming(false)}>
              {t.common.cancel}
            </MiniButton>
          </div>
        ) : (
          <MiniButton onClick={() => setConfirming(true)}>
            {t.settings.deleteHeading}
          </MiniButton>
        )}
      </div>
    </Card>
  );
}
