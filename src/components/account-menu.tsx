"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { signOut } from "@/app/(app)/actions";
import { clsx } from "@/lib/clsx";

const ROLE_LABEL: Record<string, string> = {
  superadmin: "Operator",
  admin: "Admin",
  member: "Mitglied",
};

/**
 * Top-right account menu: shows the user's role, with Einstellungen + Abmelden.
 * Keeps these out of the primary nav so it stays uncluttered.
 */
export function AccountMenu({ role }: { role: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="font-display flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-ink bg-berry text-sm font-bold text-white shadow-felt-sm"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Konto"
      >
        {ROLE_LABEL[role]?.[0] ?? "U"}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-48 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border-[3px] border-ink bg-paper py-1 shadow-felt"
        >
          <div className="px-3 py-2 text-xs font-bold text-ink-soft">
            Angemeldet als {ROLE_LABEL[role] ?? "Nutzer"}
          </div>
          <MenuLink href="/einstellungen" onClick={() => setOpen(false)}>
            Einstellungen
          </MenuLink>
          <form action={signOut}>
            <button
              type="submit"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-sm font-semibold text-ink hover:bg-sunshine/40"
            >
              Abmelden
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className={clsx(
        "block px-3 py-2 text-sm font-semibold text-ink hover:bg-sunshine/40",
      )}
    >
      {children}
    </Link>
  );
}
