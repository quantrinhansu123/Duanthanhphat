from .docx_reader import read_docx
from .pdf_reader import read_pdf
from .pptx_reader import read_pptx
from .xlsx_reader import read_xlsx

READERS = {
    ".docx": read_docx,
    ".xlsx": read_xlsx,
    ".xlsm": read_xlsx,
    ".pdf": read_pdf,
    ".pptx": read_pptx,
}

__all__ = ["READERS", "read_docx", "read_pdf", "read_pptx", "read_xlsx"]
