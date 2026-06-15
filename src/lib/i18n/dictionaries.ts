/**
 * The single source of UI translations. `de` is authoritative; `en` is typed as
 * `Dict` so TypeScript forces it to have EVERY key (and matching tuple lengths)
 * — a missing/renamed translation is a compile error, not a runtime surprise.
 *
 * Read strings by PROPERTY ACCESS (t.nav.bereiche), never via a stringly-typed
 * key path — the latter is what makes tsc slow.
 *
 * Scope: app CHROME only. Aushang CONTENT (post titles/bodies) stays German (it's
 * OCR'd German source). Emails + brand.tagline/footerPitch are out of scope.
 *
 * Interpolation: strings with {placeholders} are filled via fmt() from ./format.
 */

import type { Locale } from "./types";

export const de = {
  common: {
    save: "Speichern",
    cancel: "Abbrechen",
    delete: "Löschen",
    add: "Hinzufügen",
    rename: "Umbenennen",
    back: "Zurück",
    saving: "Wird gespeichert …",
    saved: "Gespeichert.",
    saveFailed: "Konnte Einstellung nicht speichern.",
    copied: "Kopiert ✓",
    none: "—",
  },

  nav: {
    bereiche: "Bereiche",
    essensplan: "Essensplan",
    essen: "Essen",
    rueckblick: "Rückblick",
    kalender: "Kalender",
    aufnahme: "Aufnahme",
    pruefen: "Prüfen",
    mitglieder: "Mitglieder",
    operator: "Operator",
    mehr: "Mehr",
    primaryNav: "Hauptnavigation",
  },

  account: {
    label: "Konto",
    loggedInAs: "Angemeldet als {role}",
    roles: { superadmin: "Operator", admin: "Admin", member: "Mitglied" },
    settings: "Einstellungen",
    logout: "Abmelden",
  },

  contentTypes: {
    meal_plan: "Speiseplan",
    reflection: "Rückblick",
    health_notice: "Gesundheits-Hinweis",
    event_notice: "Termin",
    info: "Info",
  },

  chip: {
    info: "Info",
    event_notice: "Termin",
    meal_plan: "Speiseplan",
    reflection: "Rückblick",
    health_advisory: "Hinweis",
    health_urgent: "Wichtig",
  },

  feed: {
    title: "Pinnwand",
    loadError:
      "Die Pinnwand konnte gerade nicht geladen werden. Bitte lade die Seite neu.",
    important: "Wichtig",
    emptyTitle: "Noch keine Aushänge.",
    emptyHintAdmin:
      "Tippe auf die Kamera, um einen Aushang aufzunehmen — nach dem Prüfen erscheint er hier.",
    emptyHintMember:
      "Sobald deine Einrichtung etwas veröffentlicht, siehst du es hier.",
    captureCta: "Aushang aufnehmen",
    inCalendar: "Im Kalender ansehen",
    takedown: "Aushang entfernen",
    takingDown: "Wird entfernt …",
    confirmTakedown: "Wirklich entfernen",
  },

  bereiche: {
    title: "Bereiche",
    categories: "Kategorien",
    essensplanTitle: "Essensplan",
    essensplanSubtitle: "Was die Kinder essen",
    termineTitle: "Termine",
    termineSubtitle: "Feste, Schließtage, Fristen",
    rueckblickTitle: "Rückblick",
    rueckblickSubtitle: "Was die Kinder gemacht haben",
    infosTitle: "Infos",
    infosSubtitle: "Allgemeine Mitteilungen",
    gesundheitTitle: "Gesundheit",
    gesundheitSubtitle: "Krankheits- & Gesundheitshinweise",
  },

  essensplan: {
    title: "Essensplan",
    subtitle: "Was die Kinder essen.",
    empty: "Noch kein Essensplan veröffentlicht.",
  },
  rueckblick: {
    title: "Rückblick",
    subtitle: "Was die Kinder unter der Woche gemacht haben.",
    empty: "Noch kein Rückblick veröffentlicht.",
    fallbackAlt: "Rückblick",
  },
  info: {
    title: "Infos",
    subtitle: "Allgemeine Mitteilungen.",
    empty: "Noch keine Infos veröffentlicht.",
  },
  gesundheit: {
    title: "Gesundheit",
    subtitle: "Hinweise zu Krankheiten und Gesundheit.",
    empty: "Keine aktuellen Gesundheitshinweise.",
  },

  calendar: {
    title: "Kalender",
    weekdaysShort: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],
    months: [
      "Januar",
      "Februar",
      "März",
      "April",
      "Mai",
      "Juni",
      "Juli",
      "August",
      "September",
      "Oktober",
      "November",
      "Dezember",
    ],
    viewMonth: "Monat",
    viewList: "Liste",
    prevMonth: "Vorheriger Monat",
    nextMonth: "Nächster Monat",
    eventSheetTitle: "Termin",
    noEventsOnDay: "Keine Termine an diesem Tag.",
    emptyTitle: "Noch keine Termine.",
    emptyHint:
      "Sobald deine Einrichtung Termine veröffentlicht, erscheinen sie hier — und in deinem abonnierten Kalender.",
    allDay: "ganztägig",
    oClock: "Uhr",
    category: { closure: "Schließtag", event: "Fest", deadline: "Frist" },
    subActiveTitle: "Kalender-Abo aktiv",
    subInactiveTitle: "Alle Termine in deinem Kalender",
    subActiveHint: "Tippen, um die Verknüpfung erneut zu öffnen",
    subInactiveHint: "Einmal abonnieren — neue Termine kommen automatisch",
    subSheetTitle: "Kalender abonnieren",
  },

  // post-detail.tsx (server component). NOTE: eventCategory.event = "Termin"
  // here, intentionally different from calendar.category.event = "Fest".
  postDetail: {
    weekOf: "Woche ab",
    estimate: "Schätzung",
    nutriWeek: "Nutri-Score der Woche",
    whatToDo: "Was zu tun ist:",
    from: "ab",
    weekdaysShort: { mon: "Mo", tue: "Di", wed: "Mi", thu: "Do", fri: "Fr" },
    eventCategory: {
      closure: "Schließtag",
      event: "Termin",
      deadline: "Frist",
    },
  },

  aufnahme: {
    title: "Aushang fotografieren",
    subtitle:
      "Wir lesen ihn aus, maskieren persönliche Daten und legen dir einen Entwurf zum Prüfen an.",
    takePhoto: "Foto aufnehmen",
    fromGallery: "Aus Galerie wählen",
    crookedOk: "Auch schräg oder unscharf ist okay.",
    processing: "Wird verarbeitet …",
    shot: "Foto {n}",
    uploading: "lädt hoch …",
    reading: "wird ausgelesen …",
    queued: "in Bearbeitung",
    duplicate: "bereits aufgenommen",
    failed: "fehlgeschlagen",
    done: "Erledigt! Sobald die Aushänge ausgelesen sind, findest du sie unter Prüfen.",
  },

  review: {
    title: "Prüfen",
    empty: "Nichts zu prüfen.",
    emptyHint: "Tippe auf die Kamera, um einen Aushang aufzunehmen.",
    toCheck: "Zu prüfen · {count}",
    processing: "Wird ausgelesen · {count}",
    processingCard: "Aufnahme vom {date} wird verarbeitet …",
    failedSection: "Fehlgeschlagen · {count}",
    failedAlert:
      "Dieser Aushang konnte nicht automatisch ausgelesen werden. Du kannst ihn verwerfen und erneut fotografieren.",
    maskedAlt: "Ausschnitt des Aushangs (maskiert)",
    maskedBadge: "Maskiert",
    coverTitle: "Titelbild (automatisch erstellt)",
    coverHelp:
      "Eine dekorative Illustration, passend zur Art des Aushangs. Schalte sie aus, wenn sie nicht passt.",
    coverAlt: "Automatisch erstelltes dekoratives Titelbild",
    artLabel: "Art",
    aiSuggestion: "Vorschlag der KI: {label} — tippe zum Ändern",
    pickArt: "tippe die passende Art an",
    titleLabel: "Titel",
    textLabel: "Text",
    releaseOriginal: "Originalfoto freigeben",
    releaseOriginalHelp:
      "Mitglieder, die klare Fotos aktiviert haben, sehen dann das unverpixelte Originalfoto statt der maskierten Version. Nur freigeben, wenn keine fremden Klarnamen darauf zu lesen sind.",
    publishing: "Wird veröffentlicht …",
    publish: "Veröffentlichen",
    discard: "Verwerfen",
    duplicateTitleBlock:
      "Ein Aushang mit diesem Titel wurde bereits veröffentlicht. Verwirf diesen Entwurf oder ändere den Titel, wenn es ein anderer ist.",
    publishFailed: "Veröffentlichen fehlgeschlagen.",
    originalDeleteFailed:
      "Veröffentlicht, aber das Originalfoto konnte nicht gelöscht werden. Bitte erneut versuchen oder den Support kontaktieren.",
    pickArtError: "Bitte wähle eine Art.",
    emptyTitleError: "Titel darf nicht leer sein.",
    notFound: "Entwurf nicht gefunden.",
    discardFailed: "Verwerfen fehlgeschlagen.",
    takedownNotFound: "Aushang nicht gefunden.",
    takedownFailed: "Entfernen fehlgeschlagen.",
    published: "Veröffentlicht.",
    discarded: "Verworfen.",
    takenDown: "Aushang entfernt.",
  },

  settings: {
    title: "Einstellungen",
    calendarSubHeading: "Kalender abonnieren",
    calendarSubDesc: "Aushang-Termine automatisch in deiner Kalender-App.",
    calendarSubPanelDesc:
      "Alle bestätigten Termine deiner Einrichtung landen automatisch in deinem Kalender — jederzeit widerrufbar.",
    calendarSubEnable: "Kalender-Abo aktivieren",
    appleCalendar: "Apple Kalender",
    googleCalendar: "Google Kalender",
    otherApp: "Andere App (URL kopieren)",
    revokeSub: "Abo widerrufen",
    digestHeading: "E-Mail-Benachrichtigungen",
    digestDesc:
      "Erhalte eine E-Mail, wenn deine Einrichtung etwas veröffentlicht.",
    pushHeading: "Push-Benachrichtigungen",
    pushDesc:
      "Erhalte eine Push-Nachricht auf diesem Gerät, wenn etwas veröffentlicht wird.",
    pushDenied: "Benachrichtigungen wurden nicht erlaubt.",
    pushOff: "Aus",
    pushEnable: "Aktivieren",
    pushEnableFailed: "Konnte Push nicht aktivieren.",
    pushDisableFailed: "Konnte Push nicht deaktivieren.",
    photoHeading: "Klare Fotos anzeigen",
    photoDesc:
      "Zeigt das unverpixelte Originalfoto bei Aushängen, die deine Einrichtung dafür freigegeben hat. Es ist dasselbe Foto wie am Aushangbrett und verlässt die App nicht. Ohne Zustimmung siehst du die unkenntlich gemachte Version.",
    languageHeading: "Sprache",
    languageDesc: "Sprache der App-Oberfläche.",
    languageDe: "Deutsch",
    languageEn: "English",
    languageInvalid: "Ungültige Sprache.",
    deleteHeading: "Konto löschen",
    deleteOperatorBlocked: "Operator-Konten können hier nicht gelöscht werden.",
    deleteWarning:
      "Dein Konto und deine persönlichen Daten werden dauerhaft gelöscht. Dies kann nicht rückgängig gemacht werden.",
    deleteLastAdmin:
      "Als Administrator:in kannst du dich nicht löschen, wenn du die einzige bist.",
    deleting: "Wird gelöscht …",
    deleteConfirm: "Endgültig löschen",
    deleteLastAdminError:
      "Du bist die letzte Administrator:in. Übergib zuerst die Rolle oder lösche die Organisation.",
    deleteFailed: "Konnte das Konto nicht löschen.",
  },

  mehr: {
    title: "Mehr",
    forYou: "Für dich",
    rueckblickSubtitle: "Wochenrückblicke",
    calendarSubTitle: "Kalender abonnieren",
    calendarSubSubtitle: "Termine automatisch in deinem Kalender",
    settingsTitle: "Einstellungen",
    settingsSubtitle: "Benachrichtigungen, Konto",
    admin: "Verwaltung",
    aufnahmeTitle: "Aufnahme",
    aufnahmeSubtitle: "Aushang fotografieren",
    mitgliederTitle: "Mitglieder",
    mitgliederSubtitle: "Eltern & Team verwalten",
    operatorTitle: "Operator",
    operatorSubtitle: "Organisationen verwalten",
  },

  members: {
    title: "Mitglieder",
    subtitle: "Personen hinzufügen, Gruppen verwalten, Rollen vergeben.",
    requests: "Anfragen",
    listTitle: "Mitglieder ({count})",
    email: "E-Mail-Adresse",
    emailPlaceholder: "person@beispiel.de",
    nameOptional: "Name (optional)",
    namePlaceholder: "z. B. Anna Müller",
    role: "Rolle",
    roleMember: "Mitglied (nur lesen)",
    roleAdmin: "Administrator:in",
    groupOptional: "Gruppe (optional)",
    noGroup: "Keine Gruppe",
    adding: "Wird hinzugefügt …",
    addPerson: "Person hinzufügen",
    groupsHeading: "Gruppen",
    groupsDesc:
      'Lege die Gruppen deiner Einrichtung an (z. B. „Kita 1", „Kita 2") und weise Personen unten einer Gruppe zu.',
    newGroupPlaceholder: "Neue Gruppe, z. B. Kita 1",
    creatingGroup: "Wird angelegt …",
    self: "(du)",
    invited: "eingeladen – noch nicht angemeldet",
    photoYesTitle: "Sieht freigegebene Originalfotos",
    photoNoTitle: "Sieht nur maskierte Fotos",
    photoYes: "Foto: frei",
    photoNo: "Foto: nein",
    group: "Gruppe:",
    promote: "→ Admin",
    demote: "→ Mitglied",
    remove: "Entfernen",
    child: "Kind: {name}",
    awaitingEmail: "wartet auf E-Mail-Bestätigung",
    reject: "Ablehnen",
    approve: "Freigeben",
    qrHeading: "QR-Zugang",
    qrDesc:
      "Häng diesen QR-Code am Aushang aus. Eltern scannen ihn, beantragen Zugang, und du gibst sie hier frei.",
    qrCreating: "Wird erstellt …",
    qrCreate: "QR-Code erstellen",
    copyLink: "Link kopieren",
  },

  operator: {
    title: "Operator",
    subtitle: "Organisationen anlegen und Admin-Rechte verwalten.",
    newOrg: "Neue Organisation",
    orgs: "Organisationen ({count})",
    person: "Person",
    persons: "Personen",
    orgNameLabel: "Name der Organisation",
    orgNamePlaceholder: "z. B. Kita Sonnenschein",
    firstEmailLabel: "E-Mail der ersten Person",
    firstNameLabel: "Name der Person (optional)",
    orgNote: "Jede Organisation braucht mindestens eine Administrator:in.",
    creating: "Wird angelegt …",
    createOrg: "Organisation anlegen",
  },

  auth: {
    loginTitle: "Anmelden",
    loginSubtitle: "Melde dich mit deiner E-Mail und deinem Passwort an.",
    notProvisioned:
      "Dein Zugang wurde noch nicht freigeschaltet. Bitte deine Organisation, dich hinzuzufügen.",
    linkInvalid:
      "Der Link war ungültig oder abgelaufen. Bitte fordere einen neuen an.",
    passwordSet: "Passwort gesetzt. Du kannst dich jetzt anmelden.",
    newHere: "Neu hier?",
    withCode: "Mit Einladungs-Code anmelden",
    noSelfSignup:
      "Zugänge werden von deiner Organisation vergeben. Es gibt keine Selbstregistrierung.",
    email: "E-Mail-Adresse",
    emailPlaceholder: "du@beispiel.de",
    password: "Passwort",
    signingIn: "Wird angemeldet …",
    signIn: "Anmelden",
    forgotPassword: "Passwort vergessen?",
    setPasswordTitle: "Passwort festlegen",
    setPasswordSubtitle:
      "Wähle ein Passwort für deinen Zugang. Danach meldest du dich damit an.",
    setPasswordHint: "Mindestens 8 Zeichen. Bewahre dein Passwort sicher auf.",
    newPassword: "Neues Passwort",
    newPasswordPlaceholder: "mindestens 8 Zeichen",
    repeatPassword: "Passwort wiederholen",
    savingPassword: "Wird gespeichert …",
    savePassword: "Passwort speichern",
    registerMetaTitle: "Anmelden mit Code",
    registerTitle: "Konto einrichten",
    registerSubtitle:
      "Schritt 1 von 2: E-Mail + Code aus der Einladungs-E-Mail eingeben. Dein Passwort legst du danach selbst fest.",
    codeLabel: "Code aus der E-Mail",
    codePlaceholder: "6-stelliger Code",
    checking: "Wird geprüft …",
    next: "Weiter",
    requestNewCode: "Neuen Code anfordern",
    forgotTitle: "Passwort vergessen",
    forgotSubtitle:
      "Gib deine E-Mail ein — wir schicken dir einen Link, um ein neues Passwort festzulegen.",
    sending: "Wird gesendet …",
    requestLink: "Link anfordern",
    enterCode: "Code eingeben",
    backToLogin: "Zurück zur Anmeldung",
    applyTitle: "Zugang beantragen",
    applySubtitle: "Zugang zu {brand} beantragen.",
    applyFallbackTitle: "Zugang",
    applyInvalid:
      "Dieser Zugangs-Code ist ungültig oder nicht mehr aktiv. Bitte wende dich an deine Einrichtung.",
    applyParentName: "Dein Name (Elternteil)",
    applyGroup: "Gruppe",
    applyGroupPlaceholder: "z. B. Sonnengruppe",
    applyChildName: "Name des Kindes",
    applyEmail: "Deine E-Mail-Adresse",
    applySubmit: "Zugang beantragen",
    applyNote:
      "Deine Anfrage wird von der Einrichtung geprüft und freigegeben.",
  },

  // Server-action result messages (shown to the user on success/failure).
  actions: {
    notAuthorized: "Dazu bist du nicht berechtigt.",
    addPersonFailed:
      "Konnte die Person nicht hinzufügen. Bitte erneut versuchen.",
    lastAdminRemove: "Die letzte Administrator:in kann nicht entfernt werden.",
    selfRemove: "Du kannst dich hier nicht selbst entfernen.",
    removeFailed: "Konnte die Person nicht entfernen.",
    removed: "Entfernt.",
    groupExists: "Diese Gruppe gibt es schon.",
    groupCreateFailed: "Konnte Gruppe nicht anlegen.",
    groupCreated: "Gruppe angelegt.",
    nameEmpty: "Name darf nicht leer sein.",
    groupRenameFailed: "Konnte Gruppe nicht umbenennen.",
    groupRenamed: "Umbenannt.",
    groupDeleteFailed: "Konnte Gruppe nicht löschen.",
    groupDeleted: "Gelöscht.",
    groupAssignFailed: "Konnte Gruppe nicht zuweisen.",
    groupAssigned: "Gruppe zugewiesen.",
    lastAdminDemote:
      "Die letzte Administrator:in kann nicht herabgestuft werden.",
    selfRoleChange: "Du kannst deine eigene Rolle nicht ändern.",
    roleChangeFailed: "Konnte Rolle nicht ändern.",
    qrCreateFailed: "Konnte QR-Code nicht erstellen.",
    qrCreated: "QR-Code erstellt.",
    requestNotVerified: "Anfrage ist noch nicht bestätigt.",
    alreadyInOrg: "Diese Person gehört bereits zu einer Organisation.",
    approveFailed: "Freigabe fehlgeschlagen.",
    approved: "Freigegeben. Login-Link verschickt.",
    rejectFailed: "Ablehnen fehlgeschlagen.",
    rejected: "Anfrage abgelehnt.",
    uploadPrepFailed: "Upload konnte nicht vorbereitet werden.",
    duplicatePhoto: "Dieser Aushang wurde bereits aufgenommen.",
    processingStartFailed: "Verarbeitung konnte nicht gestartet werden.",
    orgCreateFailed: "Konnte die Organisation nicht anlegen.",
    orgEmailInUse:
      "Diese E-Mail gehört bereits zu einer Organisation. Bitte eine andere wählen.",
    orgPersonFailed: "Konnte die Person nicht anlegen. Bitte erneut versuchen.",
    orgCreated:
      "Organisation angelegt. Die Person hat einen Login-Link erhalten.",
    applyCodeInvalid: "Dieser Zugangs-Code ist ungültig oder nicht mehr aktiv.",
    applyError: "Etwas ist schiefgelaufen. Bitte versuche es später erneut.",
    enterPassword: "Bitte gib dein Passwort ein.",
    loginInvalid: "E-Mail oder Passwort ist nicht korrekt.",
    codeInvalid: "Code ist ungültig oder abgelaufen. Fordere einen neuen an.",
    passwordsMismatch: "Die Passwörter stimmen nicht überein.",
    enterCode: "Bitte gib den Code aus der E-Mail ein.",
    passwordTooShort: "Das Passwort muss mindestens {min} Zeichen lang sein.",
    passwordTooLong: "Das Passwort ist zu lang.",
    passwordSetFailed: "Passwort konnte nicht gesetzt werden.",
    sessionExpired:
      "Deine Sitzung ist abgelaufen. Bitte öffne den Einladungs-Link erneut.",
    roleChangeFailedOrg: "Konnte die Rolle nicht ändern.",
    calSubCreateFailed: "Konnte Kalender-Abo nicht erstellen.",
    calSubRevokeFailed: "Konnte Abo nicht widerrufen.",
    calSubRevoked: "Abo widerrufen.",
  },

  verify: {
    title: "Bestätigung",
    success:
      "Danke! Deine E-Mail ist bestätigt. Die Einrichtung prüft deine Anfrage und schaltet dich frei. Du bekommst dann eine E-Mail mit deinem Login-Link.",
    invalid:
      "Dieser Bestätigungs-Link ist ungültig oder abgelaufen. Bitte beantrage den Zugang erneut.",
  },
} as const;

/**
 * Widen the literal types of the `de` source (which is `as const`, so every value
 * is a string LITERAL) to their base types — string for strings, string[] for the
 * readonly arrays — while preserving the nested KEY structure. This is what lets
 * `en` carry different text yet still be forced to have every key + matching
 * array lengths. (Without widening, `en` would have to equal the German literals.)
 */
type Widen<T> = T extends readonly (infer E)[]
  ? E extends string
    ? readonly string[]
    : readonly Widen<E>[]
  : T extends string
    ? string
    : T extends object
      ? { [K in keyof T]: Widen<T[K]> }
      : T;

export type Dict = Widen<typeof de>;
export type Messages = Dict;

export const en: Dict = {
  common: {
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    add: "Add",
    rename: "Rename",
    back: "Back",
    saving: "Saving …",
    saved: "Saved.",
    saveFailed: "Couldn't save the setting.",
    copied: "Copied ✓",
    none: "—",
  },

  nav: {
    bereiche: "Sections",
    essensplan: "Meal plan",
    essen: "Meals",
    rueckblick: "Recap",
    kalender: "Calendar",
    aufnahme: "Capture",
    pruefen: "Review",
    mitglieder: "Members",
    operator: "Operator",
    mehr: "More",
    primaryNav: "Primary navigation",
  },

  account: {
    label: "Account",
    loggedInAs: "Signed in as {role}",
    roles: { superadmin: "Operator", admin: "Admin", member: "Member" },
    settings: "Settings",
    logout: "Sign out",
  },

  contentTypes: {
    meal_plan: "Meal plan",
    reflection: "Recap",
    health_notice: "Health notice",
    event_notice: "Event",
    info: "Info",
  },

  chip: {
    info: "Info",
    event_notice: "Event",
    meal_plan: "Meal plan",
    reflection: "Recap",
    health_advisory: "Notice",
    health_urgent: "Important",
  },

  feed: {
    title: "Board",
    loadError: "The board couldn't load just now. Please reload the page.",
    important: "Important",
    emptyTitle: "No notices yet.",
    emptyHintAdmin:
      "Tap the camera to capture a notice — after review it appears here.",
    emptyHintMember:
      "As soon as your organization publishes something, you'll see it here.",
    captureCta: "Capture a notice",
    inCalendar: "View in calendar",
    takedown: "Remove notice",
    takingDown: "Removing …",
    confirmTakedown: "Confirm removal",
  },

  bereiche: {
    title: "Sections",
    categories: "Categories",
    essensplanTitle: "Meal plan",
    essensplanSubtitle: "What the children eat",
    termineTitle: "Dates",
    termineSubtitle: "Festivals, closures, deadlines",
    rueckblickTitle: "Recap",
    rueckblickSubtitle: "What the children did",
    infosTitle: "Info",
    infosSubtitle: "General announcements",
    gesundheitTitle: "Health",
    gesundheitSubtitle: "Illness & health notices",
  },

  essensplan: {
    title: "Meal plan",
    subtitle: "What the children eat.",
    empty: "No meal plan published yet.",
  },
  rueckblick: {
    title: "Recap",
    subtitle: "What the children did during the week.",
    empty: "No recap published yet.",
    fallbackAlt: "Recap",
  },
  info: {
    title: "Info",
    subtitle: "General announcements.",
    empty: "No info published yet.",
  },
  gesundheit: {
    title: "Health",
    subtitle: "Notices about illness and health.",
    empty: "No current health notices.",
  },

  calendar: {
    title: "Calendar",
    weekdaysShort: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    months: [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ],
    viewMonth: "Month",
    viewList: "List",
    prevMonth: "Previous month",
    nextMonth: "Next month",
    eventSheetTitle: "Event",
    noEventsOnDay: "No events on this day.",
    emptyTitle: "No dates yet.",
    emptyHint:
      "As soon as your organization publishes dates, they'll appear here — and in your subscribed calendar.",
    allDay: "all day",
    oClock: "",
    category: { closure: "Closure", event: "Festival", deadline: "Deadline" },
    subActiveTitle: "Calendar subscription active",
    subInactiveTitle: "All dates in your calendar",
    subActiveHint: "Tap to open the link again",
    subInactiveHint: "Subscribe once — new dates arrive automatically",
    subSheetTitle: "Subscribe to calendar",
  },

  postDetail: {
    weekOf: "Week of",
    estimate: "Estimate",
    nutriWeek: "Nutri-Score of the week",
    whatToDo: "What to do:",
    from: "from",
    weekdaysShort: {
      mon: "Mon",
      tue: "Tue",
      wed: "Wed",
      thu: "Thu",
      fri: "Fri",
    },
    eventCategory: { closure: "Closure", event: "Event", deadline: "Deadline" },
  },

  aufnahme: {
    title: "Photograph a notice",
    subtitle:
      "We read it, mask personal data, and create a draft for you to review.",
    takePhoto: "Take a photo",
    fromGallery: "Choose from gallery",
    crookedOk: "Crooked or blurry is fine too.",
    processing: "Processing …",
    shot: "Photo {n}",
    uploading: "uploading …",
    reading: "reading …",
    queued: "in progress",
    duplicate: "already captured",
    failed: "failed",
    done: "Done! Once the notices are read, you'll find them under Review.",
  },

  review: {
    title: "Review",
    empty: "Nothing to review.",
    emptyHint: "Tap the camera to capture a notice.",
    toCheck: "To review · {count}",
    processing: "Reading · {count}",
    processingCard: "Capture from {date} is processing …",
    failedSection: "Failed · {count}",
    failedAlert:
      "This notice couldn't be read automatically. You can discard it and photograph it again.",
    maskedAlt: "Excerpt of the notice (masked)",
    maskedBadge: "Masked",
    coverTitle: "Cover image (auto-generated)",
    coverHelp:
      "A decorative illustration matching the notice type. Turn it off if it doesn't fit.",
    coverAlt: "Auto-generated decorative cover image",
    artLabel: "Type",
    aiSuggestion: "AI suggestion: {label} — tap to change",
    pickArt: "tap the right type",
    titleLabel: "Title",
    textLabel: "Text",
    releaseOriginal: "Release original photo",
    releaseOriginalHelp:
      "Members who enabled clear photos will then see the unblurred original instead of the masked version. Only release it if no other people's names are legible on it.",
    publishing: "Publishing …",
    publish: "Publish",
    discard: "Discard",
    duplicateTitleBlock:
      "A notice with this title was already published. Discard this draft or change the title if it's a different one.",
    publishFailed: "Publishing failed.",
    originalDeleteFailed:
      "Published, but the original photo could not be deleted. Please try again or contact support.",
    pickArtError: "Please choose a type.",
    emptyTitleError: "Title can't be empty.",
    notFound: "Draft not found.",
    discardFailed: "Discarding failed.",
    takedownNotFound: "Notice not found.",
    takedownFailed: "Removal failed.",
    published: "Published.",
    discarded: "Discarded.",
    takenDown: "Notice removed.",
  },

  settings: {
    title: "Settings",
    calendarSubHeading: "Subscribe to calendar",
    calendarSubDesc: "Notice dates automatically in your calendar app.",
    calendarSubPanelDesc:
      "All confirmed dates from your organization land in your calendar automatically — revocable anytime.",
    calendarSubEnable: "Enable calendar subscription",
    appleCalendar: "Apple Calendar",
    googleCalendar: "Google Calendar",
    otherApp: "Other app (copy URL)",
    revokeSub: "Revoke subscription",
    digestHeading: "Email notifications",
    digestDesc: "Get an email when your organization publishes something.",
    pushHeading: "Push notifications",
    pushDesc:
      "Get a push notification on this device when something is published.",
    pushDenied: "Notifications were not allowed.",
    pushOff: "Off",
    pushEnable: "Enable",
    pushEnableFailed: "Couldn't enable push.",
    pushDisableFailed: "Couldn't disable push.",
    photoHeading: "Show clear photos",
    photoDesc:
      "Shows the unblurred original photo on notices your organization has released for it. It's the same photo as on the notice board and never leaves the app. Without consent you see the anonymized version.",
    languageHeading: "Language",
    languageDesc: "Language of the app interface.",
    languageDe: "Deutsch",
    languageEn: "English",
    languageInvalid: "Invalid language.",
    deleteHeading: "Delete account",
    deleteOperatorBlocked: "Operator accounts can't be deleted here.",
    deleteWarning:
      "Your account and personal data will be permanently deleted. This can't be undone.",
    deleteLastAdmin:
      "As an admin you can't delete yourself if you're the only one.",
    deleting: "Deleting …",
    deleteConfirm: "Delete permanently",
    deleteLastAdminError:
      "You're the last admin. Hand over the role first or delete the organization.",
    deleteFailed: "Couldn't delete the account.",
  },

  mehr: {
    title: "More",
    forYou: "For you",
    rueckblickSubtitle: "Weekly recaps",
    calendarSubTitle: "Subscribe to calendar",
    calendarSubSubtitle: "Dates automatically in your calendar",
    settingsTitle: "Settings",
    settingsSubtitle: "Notifications, account",
    admin: "Administration",
    aufnahmeTitle: "Capture",
    aufnahmeSubtitle: "Photograph a notice",
    mitgliederTitle: "Members",
    mitgliederSubtitle: "Manage parents & team",
    operatorTitle: "Operator",
    operatorSubtitle: "Manage organizations",
  },

  members: {
    title: "Members",
    subtitle: "Add people, manage groups, assign roles.",
    requests: "Requests",
    listTitle: "Members ({count})",
    email: "Email address",
    emailPlaceholder: "person@example.com",
    nameOptional: "Name (optional)",
    namePlaceholder: "e.g. Anna Müller",
    role: "Role",
    roleMember: "Member (read-only)",
    roleAdmin: "Administrator",
    groupOptional: "Group (optional)",
    noGroup: "No group",
    adding: "Adding …",
    addPerson: "Add person",
    groupsHeading: "Groups",
    groupsDesc:
      'Create your organization\'s groups (e.g. "Kita 1", "Kita 2") and assign people to a group below.',
    newGroupPlaceholder: "New group, e.g. Kita 1",
    creatingGroup: "Creating …",
    self: "(you)",
    invited: "invited – not signed in yet",
    photoYesTitle: "Sees released original photos",
    photoNoTitle: "Sees masked photos only",
    photoYes: "Photo: on",
    photoNo: "Photo: off",
    group: "Group:",
    promote: "→ Admin",
    demote: "→ Member",
    remove: "Remove",
    child: "Child: {name}",
    awaitingEmail: "awaiting email confirmation",
    reject: "Reject",
    approve: "Approve",
    qrHeading: "QR access",
    qrDesc:
      "Post this QR code on the notice board. Parents scan it, request access, and you approve them here.",
    qrCreating: "Creating …",
    qrCreate: "Create QR code",
    copyLink: "Copy link",
  },

  operator: {
    title: "Operator",
    subtitle: "Create organizations and manage admin rights.",
    newOrg: "New organization",
    orgs: "Organizations ({count})",
    person: "person",
    persons: "people",
    orgNameLabel: "Organization name",
    orgNamePlaceholder: "e.g. Kita Sonnenschein",
    firstEmailLabel: "First person's email",
    firstNameLabel: "Person's name (optional)",
    orgNote: "Every organization needs at least one administrator.",
    creating: "Creating …",
    createOrg: "Create organization",
  },

  auth: {
    loginTitle: "Sign in",
    loginSubtitle: "Sign in with your email and password.",
    notProvisioned:
      "Your access hasn't been activated yet. Ask your organization to add you.",
    linkInvalid: "The link was invalid or expired. Please request a new one.",
    passwordSet: "Password set. You can sign in now.",
    newHere: "New here?",
    withCode: "Sign in with an invite code",
    noSelfSignup:
      "Access is granted by your organization. There is no self-registration.",
    email: "Email address",
    emailPlaceholder: "you@example.com",
    password: "Password",
    signingIn: "Signing in …",
    signIn: "Sign in",
    forgotPassword: "Forgot password?",
    setPasswordTitle: "Set password",
    setPasswordSubtitle:
      "Choose a password for your access. Then you'll sign in with it.",
    setPasswordHint: "At least 8 characters. Keep your password safe.",
    newPassword: "New password",
    newPasswordPlaceholder: "at least 8 characters",
    repeatPassword: "Repeat password",
    savingPassword: "Saving …",
    savePassword: "Save password",
    registerMetaTitle: "Sign in with code",
    registerTitle: "Set up account",
    registerSubtitle:
      "Step 1 of 2: enter the email + code from the invitation email. You set your password afterwards.",
    codeLabel: "Code from the email",
    codePlaceholder: "6-digit code",
    checking: "Checking …",
    next: "Next",
    requestNewCode: "Request a new code",
    forgotTitle: "Forgot password",
    forgotSubtitle:
      "Enter your email — we'll send you a link to set a new password.",
    sending: "Sending …",
    requestLink: "Request link",
    enterCode: "Enter code",
    backToLogin: "Back to sign in",
    applyTitle: "Request access",
    applySubtitle: "Request access to {brand}.",
    applyFallbackTitle: "Access",
    applyInvalid:
      "This access code is invalid or no longer active. Please contact your organization.",
    applyParentName: "Your name (parent)",
    applyGroup: "Group",
    applyGroupPlaceholder: "e.g. Sunshine group",
    applyChildName: "Child's name",
    applyEmail: "Your email address",
    applySubmit: "Request access",
    applyNote: "Your request is reviewed and approved by the organization.",
  },

  actions: {
    notAuthorized: "You're not authorized to do that.",
    addPersonFailed: "Couldn't add the person. Please try again.",
    lastAdminRemove: "The last administrator can't be removed.",
    selfRemove: "You can't remove yourself here.",
    removeFailed: "Couldn't remove the person.",
    removed: "Removed.",
    groupExists: "That group already exists.",
    groupCreateFailed: "Couldn't create the group.",
    groupCreated: "Group created.",
    nameEmpty: "Name can't be empty.",
    groupRenameFailed: "Couldn't rename the group.",
    groupRenamed: "Renamed.",
    groupDeleteFailed: "Couldn't delete the group.",
    groupDeleted: "Deleted.",
    groupAssignFailed: "Couldn't assign the group.",
    groupAssigned: "Group assigned.",
    lastAdminDemote: "The last administrator can't be demoted.",
    selfRoleChange: "You can't change your own role.",
    roleChangeFailed: "Couldn't change the role.",
    qrCreateFailed: "Couldn't create the QR code.",
    qrCreated: "QR code created.",
    requestNotVerified: "The request isn't confirmed yet.",
    alreadyInOrg: "This person already belongs to an organization.",
    approveFailed: "Approval failed.",
    approved: "Approved. Login link sent.",
    rejectFailed: "Rejection failed.",
    rejected: "Request rejected.",
    uploadPrepFailed: "The upload couldn't be prepared.",
    duplicatePhoto: "This notice was already captured.",
    processingStartFailed: "Processing couldn't be started.",
    orgCreateFailed: "Couldn't create the organization.",
    orgEmailInUse:
      "This email already belongs to an organization. Please choose another.",
    orgPersonFailed: "Couldn't create the person. Please try again.",
    orgCreated: "Organization created. The person received a login link.",
    applyCodeInvalid: "This access code is invalid or no longer active.",
    applyError: "Something went wrong. Please try again later.",
    enterPassword: "Please enter your password.",
    loginInvalid: "Email or password is incorrect.",
    codeInvalid: "The code is invalid or expired. Request a new one.",
    passwordsMismatch: "The passwords don't match.",
    enterCode: "Please enter the code from the email.",
    passwordTooShort: "The password must be at least {min} characters long.",
    passwordTooLong: "The password is too long.",
    passwordSetFailed: "The password couldn't be set.",
    sessionExpired:
      "Your session has expired. Please open the invitation link again.",
    roleChangeFailedOrg: "Couldn't change the role.",
    calSubCreateFailed: "Couldn't create the calendar subscription.",
    calSubRevokeFailed: "Couldn't revoke the subscription.",
    calSubRevoked: "Subscription revoked.",
  },

  verify: {
    title: "Confirmation",
    success:
      "Thanks! Your email is confirmed. The organization reviews your request and approves you. You'll then get an email with your login link.",
    invalid:
      "This confirmation link is invalid or expired. Please request access again.",
  },
};

export const DICTS: Record<Locale, Dict> = { de, en };
