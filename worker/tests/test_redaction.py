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


def test_empty() -> None:
    r = redact("")
    assert r.redacted_text == ""
