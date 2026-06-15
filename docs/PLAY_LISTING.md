# Play Console — paste-ready submission pack

Everything to fill the Play Console fields. App name: **Aushang**. Package:
`app.aushang`. This is the "copy out of here, paste into the console" sheet —
pairs with `docs/PLAY_LAUNCH.md` (the process/sequence) and
`docs/STORE_PRIVACY.md` (the source of truth for privacy).

---

## 1. Store listing — German copy

**App name** (≤30 chars): `Aushang`

**Short description** (≤80 chars):

```
Der Aushang eurer Einrichtung – digital, privat, ohne Prozessänderung.
```

**Full description** (≤4000 chars):

```
Aushang bringt die Pinnwand eurer Einrichtung aufs Handy – ohne dass sich an
eurem Alltag etwas ändert.

Eine Person fotografiert den bestehenden Aushang an der Wand. Aushang liest den
Text aus, macht personenbezogene Daten automatisch und lokal unkenntlich, und
schlägt eine Struktur vor (Termin, Speiseplan, Wochenrückblick, Hinweis, Info).
Die Administrator:in prüft und gibt frei – erst dann sehen die Mitglieder den
Beitrag. Nichts wird ohne menschliche Freigabe veröffentlicht.

Für Eltern und Mitglieder bedeutet das: ein privater, übersichtlicher Feed,
durchsuchbare Bereiche (z. B. Speiseplan, Termine, Infos), ein gemeinsamer
Kalender mit Kalender-Abo (ICS) und – auf Wunsch – eine E-Mail-Zusammenfassung.

Gemacht für Kitas, Vereine, Kirchengemeinden und kleine Organisationen, die
weiterhin Papier an die Wand hängen wollen.

Datenschutz ist eingebaut, nicht aufgesetzt:
• Personenbezogene Daten werden lokal maskiert, bevor irgendeine KI-Verarbeitung
  stattfindet.
• Rohfotos verlassen unsere Infrastruktur nicht.
• Datenbank, Speicher und E-Mail laufen in der EU.
• Kein Tracking, keine Werbung, keine Weitergabe an Dritte.
• Konto und Daten jederzeit in der App löschbar.

Zugang ist nur auf Einladung möglich – es gibt keine offene Registrierung.
Konten werden von der Einrichtung angelegt.

Hinweis: Nutri-Score-Angaben bei Speiseplänen sind eine Schätzung, keine
offizielle Bewertung.
```

> Note: the description must stay consistent with `/datenschutz` — it says EU for
> DB/storage/email and does NOT claim the AI step is in the EU (the
> structure-extraction call currently goes to a non-EU sub-processor, on redacted
> text only). Keep it that way.

**Category:** `Produktivität` (Productivity) — alt: `Bildung` (Education).
**Tags/audience:** adults (staff/parents). **Email:** `hallo@kita-connect.cloud`.
**Privacy policy URL:** `https://kita-connect.cloud/datenschutz`.

---

## 2. Data Safety form — field-by-field answers

Transcribe into Play Console → Policy → App content → Data safety. (Source:
`docs/STORE_PRIVACY.md §4`.)

- **Does your app collect or share any required user data?** → **Yes** (collects).
- **Is all user data encrypted in transit?** → **Yes**.
- **Do you provide a way to request data deletion?** → **Yes** — in-app account
  deletion (Einstellungen → Konto löschen) + contact via `/datenschutz`.
- **Data types collected:**
  - **Personal info → Email address** → Collected · purpose: **App functionality
    (account/login)** · **not** shared · processed/required.
  - **Personal info → Name** → Collected (optional display name) · App
    functionality · not shared.
  - **Photos and videos → Photos** → Collected · App functionality (the core
    feature) · not shared · _note: the raw image stays on our infrastructure; PII
    is redacted locally before any external AI call._
  - **App activity / App info & performance / Device or other IDs / Location /
    Contacts / Financial info** → **Not collected.**
- **Sharing with third parties:** **No.** Sub-processors (Supabase EU, Resend, the
  AI extraction sub-processor) are processors acting on our behalf, not
  independent recipients — Play "sharing" does not apply.
- **Ads:** **No ads.** No analytics/tracking SDKs.

---

## 3. Reviewer access — demo account (REQUIRED, invite-only app) ⚠️

The app has no public signup, so a reviewer who can't log in will reject it.
Provide a working demo login in **App access** + the testing notes.

**Plan (do this once, on production or a dedicated demo org):**

1. As operator (`/operator`), create a demo org, e.g. **"Demo Kita (Play
   Review)"**, and add one **admin** + one **member** with real-looking emails you
   control (set their passwords via the set-password link).
2. As that admin, run the capture→review→publish flow a few times so the demo
   member's feed/calendar/Bereiche have realistic published content (a meal plan,
   an event, an info post). Use non-PII sample notices.
3. In Play Console → **App access** → "All or some functionality is restricted" →
   add the **member** demo credentials (email + password) and a one-line note:
   _"Invite-only app, no public signup. Log in with the credentials above to see
   the member experience. Admin demo available on request."_
4. Keep the demo account alive through review (don't delete it).

> A member login is enough for review (shows the core read experience). Offer
> admin creds "on request" so a reviewer who wants the capture flow can ask.

---

## 4. Screenshot shot-list (phone)

Play needs **min 2, up to 8** phone screenshots. Grab these from the live app
(installed PWA or a phone browser at `kita-connect.cloud`), logged in as the demo
**member** (plus two admin shots). Portrait, phone-sized.

1. **Bereiche (home)** — the category hub with "neu seit letztem Besuch" counts.
2. **Feed / Pinnwand** — a few published posts.
3. **A category library** — e.g. Speiseplan or Termine (shows structured detail).
4. **Kalender** — month view with events.
5. **Post detail** — a single notice opened (masked image + structured content).
6. **Einstellungen** — showing language, digest, calendar-abo, delete-account
   (demonstrates the privacy/deletion controls reviewers like to see).
7. _(admin)_ **Aufnahme** — the capture screen (the core feature).
8. _(admin)_ **Review/Prüfen** — confirm content type + publish.

Tips: use a clean demo org with friendly sample content; avoid any real PII on
screen; keep the same device frame across all shots. Feature graphic
(1024×500) + 512² icon: derive from the sun mark (`public/icons/master.svg`).

---

## 5. Quick submit order (cross-ref `docs/PLAY_LAUNCH.md`)

1. Create account ($25) + identity verify · recruit 12 testers.
2. Add keystore secrets → workflow builds the **signed release AAB**.
3. Upload AAB to **closed testing**; fill listing (§1), Data Safety (§2), content
   rating, App access + demo login (§3), screenshots (§4).
4. Run the **14-day** closed test with ≥12 testers.
5. Promote to production → submit for review.
