"""Offline OCR contract tests; real PDF rendering, fake inference, no downloads/API."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import fitz
from PIL import Image, ImageDraw

spec = importlib.util.spec_from_file_location("knowledge_ocr", Path(__file__).with_name("knowledge-extract.py"))
ocr = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ocr)


class Engine:
    calls = 0

    def __init__(self, config):
        pass

    def load(self):
        pass

    def predict(self, image):
        Engine.calls += 1
        return [{"text": "Nghiệm thu 1.000.000 đồng", "confidence": 0.99, "box": [1, 1, 200, 30]}]


class OcrContractTests(unittest.TestCase):
    def setUp(self):
        self.config = dict(ocr.DEFAULTS)
        self.config['mode'] = 'paddle'
        self.config['profile'] = 'classic'

    def test_vietnamese_and_money_preserved(self):
        rows = ocr.paddle_lines({"rec_texts": ["Nghiê\u0323m thu", "1.000.000"], "rec_scores": [0.99, 0.98], "rec_boxes": [[0, 0, 50, 20], [100, 0, 180, 20]]})
        self.assertEqual(ocr.assemble_text(rows), "Nghiệm thu\t1.000.000")

    def test_low_confidence_keeps_every_line(self):
        lines = ocr.paddle_lines({"rec_texts": ["1000", "2000"], "rec_scores": [0.99, 0.2]})
        self.assertEqual(len(lines), 2)
        self.assertEqual(ocr.quality(lines, 0.85)["warnings"], ["DK_OCR_LOW_CONFIDENCE"])

    def test_invalid_scores_fail(self):
        for value in (float("nan"), float("inf"), -1, 2):
            with self.assertRaises(ocr.OcrError):
                ocr.paddle_lines({"rec_texts": ["1000"], "rec_scores": [value]})

    def test_layout_row_order(self):
        lines = [{"text": "B", "box": [100, 0, 120, 20]}, {"text": "C", "box": [0, 40, 20, 60]}, {"text": "A", "box": [0, 0, 20, 20]}]
        self.assertEqual(ocr.assemble_text(lines), "A\tB\nC")

    def test_good_paddle_never_requests_cloud(self):
        image = Image.new("RGB", (200, 100), "white")
        ImageDraw.Draw(image).text((10, 10), "1000", fill="black")
        engine=Engine(self.config)
        engine.predict=lambda image:[{'text':'1.000.000','confidence':0.99,'box':None}]
        row = ocr.image_row(image, 1, self.config, engine)
        self.assertEqual(row["method"], "paddle")
        self.assertNotIn("image", row)
        self.assertEqual(row["ocr_meta"]["recognizer"], "latin_PP-OCRv5_mobile_rec")

    def test_classic_high_score_does_not_prove_vietnamese_charset(self):
        row=ocr.image_row(Image.new('RGB',(30,30),'black'),1,self.config,Engine(self.config))
        self.assertIn('DK_OCR_CHARSET_REVIEW',row['ocr_meta']['warnings'])
        self.assertTrue(row['fallback_requested'])

    def test_vl_preserves_blocks_without_inventing_confidence(self):
        self.config['profile']='vl'
        lines=ocr.vl_lines({'parsing_res_list':[{'block_content':'Nguyễn Doãn Huy','block_bbox':[0,0,200,30],'block_label':'text'}]})
        self.assertIsNone(lines[0]['confidence'])
        engine=Engine(self.config);engine.predict=lambda image:lines
        row=ocr.image_row(Image.new('RGB',(30,30),'black'),1,self.config,engine)
        self.assertEqual(row['text'],'Nguyễn Doãn Huy')
        self.assertIsNone(row['ocr_meta']['mean_confidence'])
        self.assertNotIn('image',row)

    def test_low_quality_requests_configured_fallback(self):
        image = Image.new("RGB", (30, 30), "black")
        engine = Engine(self.config)
        engine.predict = lambda image: [{"text": "1000", "confidence": 0.4, "box": None}]
        row = ocr.image_row(image, 2, self.config, engine)
        self.assertTrue(row["fallback_requested"])
        self.assertIn("image", row)
        self.assertEqual(row["text"], "1000")
        self.config["fallback"] = "none"
        row = ocr.image_row(image, 2, self.config, engine)
        self.assertNotIn("image", row)
        self.assertEqual(row["ocr_meta"]["warnings"], ["DK_OCR_LOW_CONFIDENCE"])

    def test_blank_page_does_not_load_models(self):
        engine = Engine(self.config)
        engine.load = lambda: self.fail("Blank page must not load models")
        row = ocr.image_row(Image.new("RGB", (100, 100), "white"), 1, self.config, engine)
        self.assertEqual(row["text"], "")
        self.assertTrue(row["ocr_meta"]["blank"])

    def test_missing_engine_does_not_silently_use_gemini(self):
        engine = Engine(self.config)
        def fail():
            raise ocr.OcrError("DK_PADDLE_UNAVAILABLE")
        engine.load = fail
        with self.assertRaisesRegex(ocr.OcrError, "DK_PADDLE_UNAVAILABLE"):
            ocr.image_row(Image.new("RGB", (20, 20), "black"), 1, self.config, engine)

    def test_pdf_native_scan_with_header_and_checkpoint(self):
        with tempfile.TemporaryDirectory(prefix="tcw-ocr-test-") as temp:
            source = fitz.open()
            page = source.new_page()
            page.insert_text((40, 80), "Synthetic scan contract amount 1.000.000 VND", fontsize=14)
            scan = page.get_pixmap()
            doc = fitz.open()
            native = doc.new_page()
            native.insert_text((30, 50), "Selectable full text contract. " * 5)
            mixed = doc.new_page()
            mixed.insert_text((30, 30), "Selectable header long enough to fool old 60-character scan detection. " * 2)
            mixed.insert_image(fitz.Rect(0, 80, mixed.rect.width, mixed.rect.height), pixmap=scan)
            doc.new_page()  # True blank page.
            path = Path(temp) / "mixed.pdf"
            doc.save(path)
            rows = []
            Engine.calls = 0
            with patch.object(ocr, "PaddleEngine", Engine), patch.object(ocr, "emit", rows.append):
                ocr.extract(path, self.config, set())
            self.assertEqual([row["method"] for row in rows], ["native", "paddle", "native"])
            self.assertEqual(Engine.calls, 1)
            rows.clear()
            with patch.object(ocr, "PaddleEngine", Engine), patch.object(ocr, "emit", rows.append):
                ocr.extract(path, self.config, {2})
            self.assertEqual(Engine.calls, 1, "Checkpoint avoids repeated Paddle inference")
            self.assertTrue(rows[1]["cached"])

    def test_large_page_render_is_bounded(self):
        doc = fitz.open()
        page = doc.new_page(width=3000, height=4000)
        pix = ocr.render_page(page, 300)
        self.assertLessEqual(pix.width * pix.height, ocr.MAX_PIXELS + 10000)

    def test_image_uses_same_paddle_path(self):
        with tempfile.TemporaryDirectory(prefix="tcw-ocr-image-") as temp:
            path = Path(temp) / "scan.png"
            Image.new("RGB", (40, 40), "black").save(path)
            rows = []
            with patch.object(ocr, "PaddleEngine", Engine), patch.object(ocr, "emit", rows.append):
                ocr.extract(path, self.config, set())
            self.assertEqual(rows[0]["method"], "paddle")


if __name__ == "__main__":
    unittest.main()
