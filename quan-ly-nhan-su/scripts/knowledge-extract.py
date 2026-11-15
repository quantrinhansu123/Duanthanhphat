"""Page-by-page JSONL extraction. Native text first; optional PaddleOCR on CPU.

No network in this helper unless Paddle needs its initial model download. With
KNOWLEDGE_OCR=gemini, scans are rendered and transcribed by the Node worker.
"""
import argparse
import base64
import json
import os
from pathlib import Path
import sys


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("path")
    args = parser.parse_args()
    path = Path(args.path)
    import fitz  # PyMuPDF
    paddle = None
    use_paddle = os.getenv("KNOWLEDGE_OCR", "gemini") == "paddle"
    doc = fitz.open(path)
    limit = min(int(os.getenv("KNOWLEDGE_MAX_PAGES", "250")), 500)
    if len(doc) < 1 or len(doc) > limit:
        raise ValueError("DK_PAGE_LIMIT")
    for index, page in enumerate(doc):
        text = page.get_text(sort=True).strip()
        method = "native"
        # Even a single scan in a mixed PDF gets processed, not dropped.
        if len(text) < 60:
            pix = page.get_pixmap(dpi=160, alpha=False)
            if use_paddle:
                if paddle is None:
                    from paddleocr import PaddleOCR
                    paddle = PaddleOCR(
                        lang="vi", ocr_version="PP-OCRv6", device="cpu",
                        text_detection_model_name="PP-OCRv6_small_det",
                        text_recognition_model_name="PP-OCRv6_small_rec",
                        use_doc_orientation_classify=False, use_doc_unwarping=False,
                        use_textline_orientation=False,
                    )
                import numpy as np
                pixels = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
                results = paddle.predict(pixels[:, :, ::-1])
                lines = []
                for result in results:
                    data = result.json
                    if isinstance(data, str):
                        data = json.loads(data)
                    lines.extend(data.get("res", data).get("rec_texts", []))
                text = "\n".join(lines)
                method = "paddle"
            else:
                print(json.dumps({"page": index + 1, "image": base64.b64encode(pix.tobytes("png")).decode("ascii"), "method": "gemini"}), flush=True)
                continue
        print(json.dumps({"page": index + 1, "text": text, "method": method}, ensure_ascii=True), flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # Do not log document text, model output or credentials.
        print("DK_PDF_EXTRACT_FAILED:" + type(error).__name__, file=sys.stderr)
        sys.exit(1)
