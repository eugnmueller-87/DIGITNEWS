import { NextResponse } from "next/server";

import { buildIcsForToken } from "@/lib/ics";
import { parseJoinCode } from "@/lib/validation";

/**
 * Public ICS calendar feed. Calendar clients (Apple/Google/Outlook) can't send
 * auth headers, so this is unauthenticated — security is the unguessable token +
 * revocability + the feed containing ONLY that user's org's confirmed events.
 *
 * Returns text/calendar. An invalid/revoked token returns an empty (but valid)
 * calendar with 200, so clients don't error-loop, and the token isn't confirmed
 * as valid/invalid to a guesser beyond "empty".
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  // Reuse the safe-charset validator (tokens are base64url, same charset).
  let safeToken: string;
  try {
    safeToken = parseJoinCode(token);
  } catch {
    safeToken = "";
  }

  const ics =
    (safeToken && (await buildIcsForToken(safeToken))) ??
    "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n";

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "private, max-age=300",
      "Content-Disposition": 'inline; filename="aushang.ics"',
    },
  });
}
