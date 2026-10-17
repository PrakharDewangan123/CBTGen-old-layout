"""Internal CBTGen source-document extraction library."""

from .extractor import ExtractionError, extract_docx, extract_document, extract_pdf

__all__ = ["ExtractionError", "extract_docx", "extract_document", "extract_pdf"]
from .question_segmenter import detect_question_structure

__all__.append("detect_question_structure")
from .crop_engine import CropError, crop_pdf_region

__all__.extend(["CropError", "crop_pdf_region"])
