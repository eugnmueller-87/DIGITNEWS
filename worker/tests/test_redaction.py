"""Tests for the regex PII pack (runs without Presidio/spaCy installed)."""

from __future__ import annotations

from aushang_worker.redaction import redact


def test_email_redacted() -> None:
    r = redact("Kontakt: anna@example.de für Rückfragen")
    assert "anna@example.de" not in r.redacted_text
    assert "[EMAIL_1]" in r.redacted_text
    assert any(x.entity_type == "EMAIL" for x in r.redactions)


def test_phone_redacted() -> None:
    r = redact("Ruf an unter 0151 23456789 oder +49 30 1234567")
    assert "0151" not in r.redacted_text
    assert "[TEL_1]" in r.redacted_text


def test_iban_redacted() -> None:
    r = redact("IBAN DE89370400440532013000 bitte nutzen")
    assert "DE89370400440532013000" not in r.redacted_text
    assert "[IBAN_1]" in r.redacted_text


def test_birthdate_near_geb_redacted() -> None:
    r = redact("Max, geb. 03.04.2019, kommt dazu")
    assert "03.04.2019" not in r.redacted_text
    assert "[GEB_1]" in r.redacted_text


def test_stable_numbering_per_type() -> None:
    r = redact("a@x.de und b@y.de")
    placeholders = sorted(x.placeholder for x in r.redactions)
    assert placeholders == ["[EMAIL_1]", "[EMAIL_2]"]


def test_no_pii_passes_through() -> None:
    text = "Sommerfest am Freitag im Garten."
    r = redact(text)
    assert r.redacted_text == text
    assert r.redactions == []


def test_dates_not_masked_as_phone() -> None:
    # The over-masking bug: a notice full of closure dates must come through
    # untouched. The regex phone pattern excludes dotted dates, and the ML
    # phone recognizer is held to a high threshold (tested via the regex path
    # here, which runs without spaCy installed).
    text = (
        "Schließtage 2026: 11.02.2026- 12.02.2026, 20.07.2026- 10.08.2026, "
        "24.12.2026- 01.01.2027. Frist endet am 31.01.2026."
    )
    r = redact(text)
    assert r.redacted_text == text
    assert r.redactions == []


def test_times_not_masked() -> None:
    text = "Bringzeit 8:00 - 8:30, Abholung 15:00 - 16:00 Uhr."
    r = redact(text)
    assert r.redacted_text == text
    assert r.redactions == []


def test_real_phone_still_masked_despite_dates_around_it() -> None:
    # A genuine German number is still caught deterministically (regex, conf 1.0).
    r = redact("Am 20.07.2026 erreichbar unter 030 1234567 im Büro.")
    assert "030 1234567" not in r.redacted_text
    assert "[TEL_1]" in r.redacted_text
    assert "20.07.2026" in r.redacted_text  # the date stays


def test_empty() -> None:
    r = redact("")
    assert r.redacted_text == ""
