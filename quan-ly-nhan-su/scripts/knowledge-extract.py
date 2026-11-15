"""Bounded, page-by-page OCR. JSONL on stdout; diagnostics contain no source text.

Gemini is the verified default. Paddle is selectable for a validated OCR server.
One initialized model is reused for every page. No API keys in this process.
"""
import argparse
import base64
from contextlib import redirect_stdout
import importlib.metadata
import json
import math
import os
from pathlib import Path
import sys
import time
import unicodedata

DEFAULTS = {
    "mode": "gemini", "fallback": "gemini", "device": "cpu", "profile": "vl", "vlVersion": "v1.6",
    "detector": "PP-OCRv6_small_det", "recognizer": "latin_PP-OCRv5_mobile_rec",
    "dpi": 220, "minConfidence": 0.85, "threads": 4, "maxPages": 250,
}
MAX_PIXELS = 16_000_000


class OcrError(Exception):
    pass


def emit(row):
    print(json.dumps(row, ensure_ascii=True, allow_nan=False), flush=True)


def read_config():
    config = {**DEFAULTS, **json.loads(os.getenv("KNOWLEDGE_OCR_CONFIG", "{}"))}
    if config["mode"] not in ("paddle", "gemini") or config["fallback"] not in ("gemini", "none"):
        raise OcrError("DK_INVALID_OCR_CONFIG")
    return config


def needs_ocr(page, text):
    """A scan with a selectable header is still a scan. Ignore small logos."""
    if len(text.strip()) < 60:
        return True
    area = max(1, page.rect.width * page.rect.height)
    for image in page.get_image_info():
        import fitz
        box = fitz.Rect(image["bbox"]) & page.rect
        if box.width * box.height / area > 0.35:
            return True
    return "\ufffd" in text


def render_page(page, dpi):
    scale = dpi / 72
    expected = page.rect.width * page.rect.height * scale * scale
    if expected > MAX_PIXELS:
        scale *= math.sqrt(MAX_PIXELS / expected)
    import fitz
    return page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)


def read_prediction(result):
    data = result.json
    if isinstance(data, str):
        data = json.loads(data)
    return data.get("res", data)


def paddle_lines(data):
    texts, scores = data.get("rec_texts", []), data.get("rec_scores", [])
    boxes = data.get("rec_boxes", [])
    if len(texts) != len(scores) or len(texts) > 2000:
        raise OcrError("DK_PADDLE_INVALID_RESULT")
    lines = []
    for index, (text, score) in enumerate(zip(texts, scores)):
        score = float(score)
        if not math.isfinite(score) or not 0 <= score <= 1:
            raise OcrError("DK_PADDLE_INVALID_RESULT")
        text = unicodedata.normalize("NFC", str(text)).strip()
        if not text:
            continue
        box = [round(float(v), 2) for v in boxes[index]] if index < len(boxes) else None
        if box is not None and (len(box) != 4 or not all(math.isfinite(v) for v in box)):
            raise OcrError("DK_PADDLE_INVALID_RESULT")
        lines.append({"text": text, "confidence": round(score, 5), "box": box})
    return lines


def assemble_text(lines):
    # Preserve row order and cell gaps; not a reconstruction of merged table cells.
    if not lines or any(line["box"] is None for line in lines):
        return "\n".join(line["text"] for line in lines)
    rows = []
    for line in sorted(lines, key=lambda line: (line["box"][1], line["box"][0])):
        box = line["box"]
        center, height = (box[1] + box[3]) / 2, max(1, box[3] - box[1])
        if rows and abs(center - rows[-1]["center"]) < min(height, rows[-1]["height"]) * 0.5:
            rows[-1]["lines"].append(line)
        else:
            rows.append({"center": center, "height": height, "lines": [line]})
    return "\n".join("\t".join(line["text"] for line in sorted(row["lines"], key=lambda line: line["box"][0])) for row in rows)


def quality(lines, threshold):
    if not lines:
        return {"mean_confidence": None, "low_confidence_lines": 0, "warnings": ["DK_OCR_NO_TEXT"]}
    avg = sum(line["confidence"] for line in lines) / len(lines)
    low = sum(line["confidence"] < threshold for line in lines)
    warnings = ["DK_OCR_LOW_CONFIDENCE"] if avg < threshold or low / len(lines) > 0.15 else []
    return {"mean_confidence": round(avg, 5), "low_confidence_lines": low, "warnings": warnings}


class PaddleEngine:
    def __init__(self, config):
        self.config, self.engine = config, None

    def load(self):
        if self.engine is not None:
            return
        try:
            os.environ.setdefault("PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT", "0")
            with redirect_stdout(sys.stderr):
                if self.config["profile"] == "vl":
                    from paddleocr import PaddleOCRVL
                    self.engine = PaddleOCRVL(
                        pipeline_version=self.config["vlVersion"], device=self.config["device"],
                        use_doc_orientation_classify=False, use_doc_unwarping=False,
                        enable_mkldnn=False, cpu_threads=self.config["threads"],
                    )
                    return
                from paddleocr import PaddleOCR
                self.engine = PaddleOCR(
                    device=self.config["device"],
                    text_detection_model_name=self.config["detector"],
                    text_recognition_model_name=self.config["recognizer"],
                    use_doc_orientation_classify=False, use_doc_unwarping=False,
                    use_textline_orientation=False, enable_mkldnn=False,
                    cpu_threads=self.config["threads"], text_rec_score_thresh=0.0,
                )
        except Exception as error:
            raise OcrError("DK_PADDLE_UNAVAILABLE") from error

    def predict(self, image):
        self.load()
        with redirect_stdout(sys.stderr):
            if self.config["profile"] == "vl":
                return [line for result in self.engine.predict(image) for line in vl_lines(read_prediction(result))]
            return [line for result in self.engine.predict(image) for line in paddle_lines(read_prediction(result))]


def vl_lines(data):
    blocks = data.get("parsing_res_list")
    if not isinstance(blocks, list) or len(blocks) > 2000:
        raise OcrError("DK_PADDLE_INVALID_RESULT")
    lines = []
    for block in blocks:
        text = block.get("block_content")
        if not isinstance(text, str):
            raise OcrError("DK_PADDLE_INVALID_RESULT")
        if text.strip():
            box = block.get('block_bbox')
            if not isinstance(box, (list, tuple)) or len(box) != 4 or not all(isinstance(v, (int, float)) and math.isfinite(v) for v in box):
                raise OcrError('DK_PADDLE_INVALID_RESULT')
            lines.append({"text": unicodedata.normalize("NFC", text.strip()), "confidence": None,
                          "box": [round(float(v), 2) for v in box], "label": block.get("block_label", "text")})
    return lines


def image_row(image, page_number, config, engine):
    started = time.monotonic()
    meta = {"primary_engine": config["mode"], "warnings": [], "width": image.width, "height": image.height}
    if all(low >= 250 for low, high in image.getextrema()):
        return {"page": page_number, "text": "", "method": "native", "ocr_meta": {**meta, "blank": True}}
    if config["mode"] == "gemini":
        return {"page": page_number, "method": "gemini", "image": png_base64(image), "ocr_meta": meta}
    engine.load()  # Missing dependencies/models fail instead of silently using cloud for all pages.
    try:
        import numpy as np
        lines = engine.predict(np.asarray(image)[:, :, ::-1])
        is_vl = config["profile"] == "vl"
        text = "\n\n".join(line["text"] for line in lines) if is_vl else assemble_text(lines)
        if len(text) > 60000:
            raise OcrError("DK_PAGE_TEXT_LIMIT")
        if is_vl:
            # VL has no calibrated line confidence. Never manufacture a score.
            meta.update({"mean_confidence": None, "warnings": [] if text.strip() else ["DK_OCR_NO_TEXT"],
                         "model": "PaddleOCR-VL-1.6-0.9B", "layout": "PP-DocLayoutV3"})
        else:
            meta.update(quality(lines, config["minConfidence"]))
            meta.update({"detector": config["detector"], "recognizer": config["recognizer"]})
            # Shipped Latin dictionaries omit Vietnamese tone marks, even with a high score.
            # This profile is for non-Vietnamese/numeric material, never silently trust it for vi.
            if any(char.isalpha() for char in text):
                meta["warnings"].append("DK_OCR_CHARSET_REVIEW")
        meta["lines"] = lines
    except OcrError:
        raise
    except Exception:
        text = ""
        meta["warnings"] = ["DK_PADDLE_PAGE_FAILED"]
    meta["elapsed_ms"] = round((time.monotonic() - started) * 1000)
    row = {"page": page_number, "method": "paddle", "text": text, "ocr_meta": meta}
    if meta["warnings"] and config["fallback"] == "gemini":
        row.update({"fallback_requested": True, "image": png_base64(image)})
    return row


def png_base64(image):
    from io import BytesIO
    data = BytesIO()
    image.save(data, format="PNG")
    return base64.b64encode(data.getvalue()).decode("ascii")


def extract(path, config, skip):
    from PIL import Image, ImageOps
    import fitz
    engine = PaddleEngine(config)
    if path.suffix.lower() != ".pdf":
        if path.suffix.lower() not in (".png", ".jpg", ".jpeg", ".webp"):
            raise OcrError("DK_UNSUPPORTED_FORMAT")
        if 1 in skip:
            emit({"page": 1, "cached": True})
            return
        with Image.open(path) as source:
            if source.width * source.height > 80_000_000:
                raise OcrError("DK_PAGE_IMAGE_LIMIT")
            image = ImageOps.exif_transpose(source).convert("RGB")
            image.thumbnail((4000, 4000))
            emit(image_row(image, 1, config, engine))
        return
    with fitz.open(path) as doc:
        if not 1 <= len(doc) <= config["maxPages"]:
            raise OcrError("DK_PAGE_LIMIT")
        for index, page in enumerate(doc):
            number = index + 1
            if number in skip:
                emit({"page": number, "cached": True})
                continue
            text = page.get_text(sort=True).strip()
            if not needs_ocr(page, text):
                emit({"page": number, "text": text, "method": "native", "ocr_meta": {"warnings": []}})
                continue
            pix = render_page(page, config["dpi"])
            image = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
            emit(image_row(image, number, config, engine))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("path", nargs="?")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    config = read_config()
    if args.check:
        if config['mode'] == 'gemini':
            emit({'ok': True, 'mode': 'gemini', 'versions': {name: importlib.metadata.version(name) for name in ('PyMuPDF','Pillow')}})
            return
        engine = PaddleEngine(config)
        engine.load()
        packages = ("paddleocr", "paddlex", "PyMuPDF")
        versions = {name: importlib.metadata.version(name) for name in packages}
        for name in ("paddlepaddle", "paddlepaddle-gpu"):
            try:
                versions[name] = importlib.metadata.version(name)
            except importlib.metadata.PackageNotFoundError:
                pass
        emit({"ok": True, "profile": config["profile"], "detector": config["detector"] if config["profile"] == "classic" else "PP-DocLayoutV3",
              "recognizer": config["recognizer"] if config["profile"] == "classic" else "PaddleOCR-VL-1.6-0.9B", "device": config["device"], "versions": versions})
        return
    if not args.path:
        raise OcrError("DK_INVALID_PATH")
    skip = set(json.loads(os.getenv("KNOWLEDGE_OCR_SKIP_PAGES", "[]")))
    extract(Path(args.path), config, skip)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        code = str(error) if isinstance(error, OcrError) else "DK_PDF_EXTRACT_FAILED"
        emit({"error": code})
        sys.exit(1)
