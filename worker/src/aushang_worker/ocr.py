"""Image preprocessing (OpenCV) + OCR (Tesseract, German).

Heavy native deps (cv2, pytesseract, numpy) live only in the deployed worker
image, so they're imported lazily — the module loads for unit tests without them.
"""

from __future__ import annotations

from dataclasses import dataclass

try:  # pragma: no cover - only in the deployed image
    import cv2
    import numpy as np
    import pytesseract

    _OCR_AVAILABLE = True
except ImportError:  # pragma: no cover
    _OCR_AVAILABLE = False


@dataclass
class OcrResult:
    text: str
    # Word boxes: (text, x, y, w, h) — used later to blur redacted regions.
    boxes: list[tuple[str, int, int, int, int]]


def preprocess(image_bytes: bytes) -> bytes:  # pragma: no cover - needs cv2
    """Deskew, grayscale, and boost contrast to improve OCR. Returns JPEG bytes.

    Best-effort: on any failure returns the original bytes unchanged.
    """
    if not _OCR_AVAILABLE:
        return image_bytes
    try:
        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            return image_bytes
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        # Deskew via the minimum-area rectangle of foreground pixels.
        coords = cv2.findNonZero(cv2.bitwise_not(gray))
        if coords is not None:
            angle = cv2.minAreaRect(coords)[-1]
            angle = -(90 + angle) if angle < -45 else -angle
            if abs(angle) > 0.5:
                h, w = gray.shape
                m = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
                gray = cv2.warpAffine(
                    gray,
                    m,
                    (w, h),
                    flags=cv2.INTER_CUBIC,
                    borderMode=cv2.BORDER_REPLICATE,
                )
        gray = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(gray)
        ok, buf = cv2.imencode(".jpg", gray)
        return buf.tobytes() if ok else image_bytes
    except Exception:
        return image_bytes


def run_ocr(image_bytes: bytes) -> OcrResult:  # pragma: no cover - needs tesseract
    """OCR the image with Tesseract (German). Returns text + word boxes."""
    if not _OCR_AVAILABLE:
        raise RuntimeError("OCR dependencies not installed")
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)
    data = pytesseract.image_to_data(
        img, lang="deu", output_type=pytesseract.Output.DICT
    )
    words: list[str] = []
    boxes: list[tuple[str, int, int, int, int]] = []
    for i, word in enumerate(data["text"]):
        if word.strip():
            words.append(word)
            boxes.append(
                (
                    word,
                    data["left"][i],
                    data["top"][i],
                    data["width"][i],
                    data["height"][i],
                )
            )
    return OcrResult(text=" ".join(words), boxes=boxes)
