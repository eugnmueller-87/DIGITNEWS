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
 * Invite / password-setup email. `setUrl` is the one-time link that establishes
 * a session and lands the user on /set-password. Used both for first-time invite
 * onboarding and for "forgot password".
 */
export function setPasswordEmail(setUrl: string): {
  subject: string;
  html: string;
  text: string;
} {
  const heading = "Lege dein Passwort fest";
  const bodyHtml = `
    <p style="margin:0 0 16px;">Dein Zugang zu ${brand.name} wurde eingerichtet. Lege jetzt dein Passwort fest, um dich anzumelden.</p>
    <p style="margin:0 0 20px;">${button(setUrl, "Passwort festlegen")}</p>
    <p style="margin:0;color:#71717a;font-size:12px;">Der Link ist nur kurze Zeit gültig und kann nur einmal verwendet werden. Wenn du das nicht warst, kannst du diese E-Mail ignorieren.</p>
  `;
  const text = [
    "Lege dein Passwort fest",
    "",
    `Dein Zugang zu ${brand.name} wurde eingerichtet. Lege dein Passwort über diesen Link fest:`,
    setUrl,
    "",
    "Der Link ist nur kurze Zeit gültig und einmalig verwendbar. Wenn du das nicht warst, ignoriere diese E-Mail.",
    "",
    `${brand.name} — ${brand.footerPitch}`,
  ].join("\n");

  return {
    subject: `${brand.name}: Passwort festlegen`,
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
