"""Decorative cover-image generation (text-to-image, FLUX.1 [schnell]).

Generates a friendly, decorative cover illustration for a post FROM THE
ALREADY-REDACTED EXTRACTION (content_type + title + summary) — never from the raw
board photo. The prompt therefore carries NO PII (same boundary as the text LLM
call). The cover is decorative only and the admin confirms it in review before
any member sees it; it never replaces the real (blurred) image.

PRIVACY / RESIDENCY: this calls a PROVIDER-AGNOSTIC endpoint via env
(IMAGE_API_URL + IMAGE_API_KEY) so the deployment can point at an EU-hosted
FLUX.1 [schnell] endpoint (e.g. Black Forest Labs' EU API) and keep generation in
the EU. Never point this at a US host for the EU product.

GUARDRAILS (non-negotiable for a childcare product):
  * NO people — objects/scenes only (a sun, a plate of food, a calendar). Never a
    rendered child or any person.
  * Decorative, not depictive — the style is keyed to the content_type + a neutral
    mood, NOT to the notice's specifics, so a cheerful image can't land next to a
    closure/illness notice.

FAIL-OPEN: any error (no key, transport, bad response) returns None and the
pipeline writes the draft without a cover. A missing decoration must NEVER fail a
post.
"""

from __future__ import annotations

import base64
import logging

import httpx

log = logging.getLogger("aushang.cover")

# Per content_type decorative scene. Deliberately generic + object-only; NEVER
# references people or the notice's factual content.
_SCENE_BY_TYPE: dict[str, str] = {
    "meal_plan": "a cheerful still life of a healthy plate of food, fruit and "
    "vegetables on a wooden table",
    "reflection": "a warm, cozy scene of crayons, paper and autumn leaves on a "
    "table, soft daylight",
    "health_notice": "a calm, reassuring arrangement of a steaming mug, a "
    "blanket and a small potted plant",
    "event_notice": "a festive flat-lay of a paper calendar, bunting and a small "
    "balloon, bright and friendly",
    "info": "a tidy desk flat-lay with a notebook, a pencil and a small plant, "
    "soft and friendly",
}
_DEFAULT_SCENE = _SCENE_BY_TYPE["info"]

# Fixed style wrapper. "no people, no text, no faces" is repeated because it is
# the store-safety + privacy guardrail, not just an aesthetic choice.
_STYLE = (
    "Cute, friendly children's-book style illustration, soft flat colors, gentle "
    "warm palette. {scene}. NO people, NO children, NO faces, NO text, NO "
    "letters. Simple, decorative, wholesome."
)


def build_prompt(content_type: str) -> str:
    """Build a no-people, decorative prompt keyed only to the content_type."""
    scene = _SCENE_BY_TYPE.get(content_type, _DEFAULT_SCENE)
    return _STYLE.format(scene=scene)


def generate_cover(
    *, api_url: str | None, api_key: str | None, content_type: str
) -> bytes | None:
    """Generate a decorative cover. FAIL-OPEN: returns None on any problem.

    Provider-agnostic: POSTs {prompt} to IMAGE_API_URL with a Bearer key and
    expects either raw image bytes or a JSON body carrying base64 image data
    (common FLUX-endpoint shapes). Adjust _decode_response for a specific
    provider's exact contract.
    """
    if not api_url or not api_key:
        return None
    prompt = build_prompt(content_type)
    try:
        with httpx.Client(timeout=60) as client:
            resp = client.post(
                api_url,
                headers={
                    "authorization": f"Bearer {api_key}",
                    "content-type": "application/json",
                },
                json={
                    "prompt": prompt,
                    # FLUX schnell: few steps; keep the cover small + cheap.
                    "num_inference_steps": 4,
                    "width": 768,
                    "height": 512,
                },
            )
            resp.raise_for_status()
            return _decode_response(resp)
    except Exception as e:  # fail-open — never raise into the pipeline
        log.warning("cover generation skipped: %s", type(e).__name__)
        return None


def _decode_response(resp: httpx.Response) -> bytes | None:
    """Pull image bytes out of a provider response (raw or base64-in-JSON)."""
    ctype = resp.headers.get("content-type", "")
    if ctype.startswith("image/"):
        return resp.content
    try:
        data = resp.json()
    except Exception:
        return None
    # Common shapes: {"image": "<b64>"} or {"images": ["<b64>", ...]} or a
    # data URL. Be liberal in what we accept.
    b64 = None
    if isinstance(data, dict):
        if isinstance(data.get("image"), str):
            b64 = data["image"]
        elif isinstance(data.get("images"), list) and data["images"]:
            first = data["images"][0]
            b64 = first if isinstance(first, str) else None
    if not b64:
        return None
    if b64.startswith("data:") and "," in b64:
        b64 = b64.split(",", 1)[1]
    try:
        return base64.b64decode(b64)
    except Exception:
        return None
