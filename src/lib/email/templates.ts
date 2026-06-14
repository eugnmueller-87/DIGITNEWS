import { brand } from "@/config/brand";

/**
 * Plain, inline-styled email templates (email clients need inline CSS and don't
 * run JS). Each builder returns { subject, html, text }. The footer carries the
 * brand growth loop (Brief §10). No tracking pixels, no third-party assets.
 */

function layout(opts: { heading: string; bodyHtml: string }): string {
  return `<!doctype html>
<html lang="de">
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;border:1px solid #e4e4e7;">
          <tr><td style="padding:28px 28px 8px;">
            <div style="font-weight:600;font-size:18px;color:#18181b;">${brand.name}</div>
          </td></tr>
          <tr><td style="padding:8px 28px 4px;">
            <h1 style="margin:0;font-size:18px;line-height:1.4;color:#18181b;">${opts.heading}</h1>
          </td></tr>
          <tr><td style="padding:8px 28px 28px;color:#3f3f46;font-size:14px;line-height:1.6;">
            ${opts.bodyHtml}
          </td></tr>
          <tr><td style="padding:16px 28px;border-top:1px solid #f4f4f5;color:#a1a1aa;font-size:12px;line-height:1.5;">
            ${brand.name} — ${brand.footerPitch}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-weight:500;font-size:14px;padding:11px 20px;border-radius:12px;">${label}</a>`;
}

/** QR-application email verification. `verifyUrl` carries the single-use token. */
export function applicationVerificationEmail(verifyUrl: string): {
  subject: string;
  html: string;
  text: string;
} {
  const heading = "Bestätige deine E-Mail-Adresse";
  const bodyHtml = `
    <p style="margin:0 0 16px;">Danke für deine Anfrage. Bitte bestätige deine E-Mail-Adresse, um sie abzuschließen. Anschließend prüft deine Einrichtung die Anfrage und schaltet dich frei.</p>
    <p style="margin:0 0 20px;">${button(verifyUrl, "E-Mail bestätigen")}</p>
    <p style="margin:0;color:#71717a;font-size:12px;">Der Link ist 24 Stunden gültig. Wenn du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren.</p>
  `;
  const text = [
    "Bestätige deine E-Mail-Adresse",
    "",
    "Danke für deine Anfrage. Bitte bestätige deine E-Mail-Adresse über diesen Link:",
    verifyUrl,
    "",
    "Der Link ist 24 Stunden gültig. Wenn du diese Anfrage nicht gestellt hast, ignoriere diese E-Mail.",
    "",
    `${brand.name} — ${brand.footerPitch}`,
  ].join("\n");

  return {
    subject: `${brand.name}: E-Mail bestätigen`,
    html: layout({ heading, bodyHtml }),
    text,
  };
}

/**
 * Registration / password-reset CODE email. Shows a 6-digit code AND a button
 * to the registration page. The button links only to /registrieren (with the
 * email prefilled) — it carries NO token, so an email scanner can't consume the
 * OTP; the code itself must still be typed. This gives the user a clear
 * destination without weakening the scanner-proof design. Used for first-time
 * invite onboarding and for "forgot password".
 */
export function registrationCodeEmail(
  code: string,
  registerUrl: string,
): {
  subject: string;
  html: string;
  text: string;
} {
  const safe = code.replace(/[^0-9A-Za-z]/g, "");
  const heading = "Dein Zugangs-Code";
  const bodyHtml = `
    <p style="margin:0 0 8px;">Dein Zugang zu ${brand.name} wurde eingerichtet. So richtest du dein Konto ein:</p>
    <ol style="margin:0 0 16px;padding-left:18px;color:#3f3f46;">
      <li style="margin-bottom:4px;">Tippe unten auf <b>„Konto einrichten"</b>.</li>
      <li style="margin-bottom:4px;">Gib diesen Code ein.</li>
      <li>Lege dein Passwort fest — fertig.</li>
    </ol>
    <p style="margin:0 0 8px;color:#71717a;font-size:13px;">Dein Code:</p>
    <p style="margin:0 0 20px;font-size:30px;font-weight:700;letter-spacing:6px;color:#18181b;font-family:monospace;">${safe}</p>
    <p style="margin:0 0 20px;">${button(registerUrl, "Konto einrichten")}</p>
    <p style="margin:0;color:#71717a;font-size:12px;">Der Code ist nur kurze Zeit gültig und kann nur einmal verwendet werden. Du hast noch kein Passwort — das legst du im letzten Schritt selbst fest. Wenn du das nicht warst, kannst du diese E-Mail ignorieren.</p>
  `;
  const text = [
    "Dein Zugangs-Code",
    "",
    `Dein Zugang zu ${brand.name} wurde eingerichtet. So richtest du dein Konto ein:`,
    "",
    `1. Öffne diese Seite: ${registerUrl}`,
    "2. Gib diesen Code ein:",
    "",
    `   ${safe}`,
    "",
    "3. Lege dein Passwort fest — fertig.",
    "",
    "Der Code ist nur kurze Zeit gültig und einmalig verwendbar. Du hast noch kein Passwort — das legst du im letzten Schritt selbst fest. Wenn du das nicht warst, ignoriere diese E-Mail.",
    "",
    `${brand.name} — ${brand.footerPitch}`,
  ].join("\n");

  return {
    subject: `${brand.name}: Dein Zugangs-Code`,
    html: layout({ heading, bodyHtml }),
    text,
  };
}

/** Notify a member that their org published something. `feedUrl` → the feed. */
export function publishNotificationEmail(
  title: string,
  feedUrl: string,
): { subject: string; html: string; text: string } {
  const heading = "Neuer Aushang";
  const safe = title.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const bodyHtml = `
    <p style="margin:0 0 16px;">Deine Einrichtung hat etwas veröffentlicht:</p>
    <p style="margin:0 0 20px;font-weight:600;color:#18181b;">${safe}</p>
    <p style="margin:0 0 20px;">${button(feedUrl, "Im Feed ansehen")}</p>
    <p style="margin:0;color:#71717a;font-size:12px;">Du erhältst diese E-Mail, weil du Benachrichtigungen aktiviert hast. Du kannst sie in den Einstellungen abstellen.</p>
  `;
  const text = [
    "Neuer Aushang",
    "",
    "Deine Einrichtung hat etwas veröffentlicht:",
    title,
    "",
    feedUrl,
    "",
    `${brand.name} — ${brand.footerPitch}`,
  ].join("\n");
  return {
    subject: `${brand.name}: Neuer Aushang`,
    html: layout({ heading, bodyHtml }),
    text,
  };
}
