"""Pull readable text out of a PDF, without adding a parser dependency.

reportlab compresses its content streams, so searching the raw PDF bytes for a
string finds nothing — a test written that way passes or fails by accident
rather than by whether the text is on the page. This inflates every
FlateDecode stream and collects the parenthesised literals that the text-
showing operators draw, which is enough to assert on what a reader would see.

Lives in its own module because it is test scaffolding, not a test.
"""
import base64
import re
import zlib

# A PDF string literal: parentheses, with backslash escapes allowed inside.
_LITERAL = re.compile(rb"\((?:[^()\\]|\\.)*\)", re.S)
_STREAM = re.compile(rb"stream\r?\n(.*?)endstream", re.S)


def _decode(blob: bytes) -> bytes:
    """Undo reportlab's default filter chain: ASCII85Decode then FlateDecode.

    Applied in that order and each step tolerated separately, because a stream
    may carry either filter, both, or neither.
    """
    stripped = blob.strip()
    if stripped.endswith(b"~>"):
        try:
            blob = base64.a85decode(stripped, adobe=True)
        except ValueError:
            return blob
    try:
        return zlib.decompress(blob)
    except zlib.error:
        return blob


def pdf_text(pdf: bytes) -> str:
    chunks = []
    for match in _STREAM.finditer(pdf):
        for literal in _LITERAL.findall(_decode(match.group(1))):
            chunks.append(literal[1:-1])

    text = b" ".join(chunks).decode("latin-1")
    # Undo the escapes that would otherwise break a plain substring match.
    return text.replace(r"\(", "(").replace(r"\)", ")").replace("\\\\", "\\")
