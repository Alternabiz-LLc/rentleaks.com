#!/usr/bin/env python3
"""
The lead-magnet generator.

Every guide is a JSON spec in tools/guides/. This script renders each one into
web/public/guides/<file>.pdf and regenerates the catalogue the app reads
(the guides:start/end region in web/src/lib/network/core.ts), so the website's
forms, the capture API, the emails and the desk all learn about a new magnet at
once.

    python3 tools/build-guides.py                 build every spec
    python3 tools/build-guides.py partner-kit     build one
    python3 tools/build-guides.py --check         fail if a spec is malformed

To add a magnet:

    python3 tools/new-lead-magnet.py --id fee-negotiation --audience tenant \
        --title "How to negotiate a broker fee"
    (edit tools/guides/fee-negotiation.json — it comes with the skeleton)
    python3 tools/build-guides.py

The PDFs live with the app, not the website, so the private link the app emails
is the only way to a copy (app.rentleaks.com tells crawlers to stay out).

A spec may set "order" (a number) to place itself among its audience; renters'
guides always come before agents'.

Blocks a spec can use: kicker, h1, h2, h3, lede, body, small, bullets, table,
steps, checklist, box, rule, spacer, pagebreak. {{referral_pct}} is replaced
with the referral percentage below, so the money pages stay true after a change
in the desk (Broker network → Terms).
"""
import argparse
import glob
import json
import os
import re
import sys
from datetime import date

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate,
    Flowable,
    Frame,
    ListFlowable,
    ListItem,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPECS = os.path.join(ROOT, "tools", "guides")
OUT = os.path.join(ROOT, "web", "public", "guides")
CORE = os.path.join(ROOT, "web", "src", "lib", "network", "core.ts")
SITE = "rentleaks.com/hire-a-broker/"
VERSION = "2026.09"
REFERRAL_PCT = "25%"  # keep in step with the desk default (net.referralPct)

INK = colors.HexColor("#0E1F26")
INK2 = colors.HexColor("#3D555E")
MUTED = colors.HexColor("#5C747D")
BRAND = colors.HexColor("#1F7181")
BRAND_DEEP = colors.HexColor("#0D2229")
BRAND_SOFT = colors.HexColor("#E6F3F5")
VALUE_SOFT = colors.HexColor("#FBF0DA")
VALUE_LINE = colors.HexColor("#E7D4AE")
BAD_SOFT = colors.HexColor("#F7E7E1")
BAD_LINE = colors.HexColor("#E3C3B6")
PAPER = colors.HexColor("#FAF7F2")
LINE = colors.HexColor("#DCD6CC")

MARGIN = 0.78 * inch
PAGE_W, PAGE_H = LETTER
TONES = {"brand": (BRAND_SOFT, BRAND_SOFT), "value": (VALUE_SOFT, VALUE_LINE), "bad": (BAD_SOFT, BAD_LINE)}

S = {
    "h1": ParagraphStyle("h1", fontName="Times-Bold", fontSize=26, leading=29, textColor=INK, spaceAfter=10),
    "h2": ParagraphStyle("h2", fontName="Times-Bold", fontSize=16, leading=19, textColor=INK, spaceBefore=16, spaceAfter=6),
    "h3": ParagraphStyle("h3", fontName="Helvetica-Bold", fontSize=10.5, leading=13, textColor=BRAND, spaceBefore=10, spaceAfter=3),
    "body": ParagraphStyle("body", fontName="Helvetica", fontSize=9.8, leading=14.2, textColor=INK2, alignment=TA_LEFT, spaceAfter=7),
    "lede": ParagraphStyle("lede", fontName="Helvetica", fontSize=11.4, leading=16.4, textColor=INK, spaceAfter=10),
    "small": ParagraphStyle("small", fontName="Helvetica", fontSize=8.4, leading=11.6, textColor=MUTED, spaceAfter=5),
    "kicker": ParagraphStyle("kicker", fontName="Helvetica-Bold", fontSize=8, leading=10, textColor=BRAND, spaceAfter=4),
    "cover_k": ParagraphStyle("cover_k", fontName="Helvetica-Bold", fontSize=9, leading=12, textColor=colors.HexColor("#8FD3DF"), spaceAfter=10),
    "cover_h": ParagraphStyle("cover_h", fontName="Times-Bold", fontSize=34, leading=37, textColor=colors.white, spaceAfter=12),
    "cover_p": ParagraphStyle("cover_p", fontName="Helvetica", fontSize=12, leading=17.5, textColor=colors.HexColor("#D7E6E9"), spaceAfter=8),
    "cover_s": ParagraphStyle("cover_s", fontName="Helvetica", fontSize=9, leading=13, textColor=colors.HexColor("#9FBBC1")),
    "cell": ParagraphStyle("cell", fontName="Helvetica", fontSize=9, leading=12.4, textColor=INK2),
    "cellb": ParagraphStyle("cellb", fontName="Helvetica-Bold", fontSize=9, leading=12.4, textColor=INK),
    "note": ParagraphStyle("note", fontName="Helvetica", fontSize=9.2, leading=13.4, textColor=INK, spaceAfter=4),
}


class Rule(Flowable):
    def __init__(self, color=LINE, thickness=0.7, space=6):
        Flowable.__init__(self)
        self.color, self.thickness, self.space = color, thickness, space
        self.width, self.height = 0, space

    def wrap(self, w, h):
        self.width = w
        return w, self.height

    def draw(self):
        self.canv.setStrokeColor(self.color)
        self.canv.setLineWidth(self.thickness)
        self.canv.line(0, self.height / 2, self.width, self.height / 2)


class CheckBox(Flowable):
    """An empty tick box to fill in by hand."""

    def __init__(self, size=9):
        Flowable.__init__(self)
        self.width = self.height = size

    def wrap(self, w, h):
        return self.width, self.height

    def draw(self):
        self.canv.setStrokeColor(BRAND)
        self.canv.setLineWidth(0.9)
        self.canv.roundRect(0, 0, self.width, self.height, 1.6, stroke=1, fill=0)


def box(flowables, tone="brand", pad=9):
    fill, border = TONES.get(tone, TONES["brand"])
    t = Table([[flowables]], colWidths=[PAGE_W - 2 * MARGIN])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), fill),
                ("BOX", (0, 0), (-1, -1), 0.7, border),
                ("LEFTPADDING", (0, 0), (-1, -1), pad),
                ("RIGHTPADDING", (0, 0), (-1, -1), pad),
                ("TOPPADDING", (0, 0), (-1, -1), pad),
                ("BOTTOMPADDING", (0, 0), (-1, -1), pad),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    return t


def bullets(items):
    return ListFlowable(
        [ListItem(Paragraph(i, S["body"]), leftIndent=14, value="square") for i in items],
        bulletType="bullet",
        start="square",
        bulletFontSize=5,
        bulletColor=BRAND,
        leftIndent=12,
        spaceAfter=6,
    )


def table(rows, widths=None, header=True, zebra=True):
    if widths:
        widths = [w * inch for w in widths]
    else:
        cols = max(len(r) for r in rows)
        widths = [(PAGE_W - 2 * MARGIN) / cols] * cols
    data = [[Paragraph(c, S["cellb"] if (header and r == 0) else S["cell"]) for c in row] for r, row in enumerate(rows)]
    t = Table(data, colWidths=widths, repeatRows=1 if header else 0, hAlign="LEFT")
    style = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, -2), 0.5, LINE),
        ("BOX", (0, 0), (-1, -1), 0.7, LINE),
    ]
    if header:
        style += [("BACKGROUND", (0, 0), (-1, 0), PAPER), ("LINEBELOW", (0, 0), (-1, 0), 0.9, LINE)]
    if zebra:
        for r in range(1 if header else 0, len(data)):
            if r % 2 == (1 if header else 0):
                style.append(("BACKGROUND", (0, r), (-1, r), colors.HexColor("#FCFBF8")))
    t.setStyle(TableStyle(style))
    return t


def steps(items):
    cells = []
    for n, (title, text) in enumerate(items, start=1):
        cells.append(
            [
                Paragraph(f'<font color="#1F7181" size="14"><b>{n}</b></font>', S["body"]),
                Paragraph(f"<b>{title}</b>", S["note"]),
                Paragraph(text, S["small"]),
            ]
        )
    rows = [cells[i : i + 2] for i in range(0, len(cells), 2)]
    if len(rows[-1]) == 1:
        rows[-1].append([])
    w = (PAGE_W - 2 * MARGIN - 10) / 2
    t = Table(rows, colWidths=[w, w], hAlign="LEFT")
    t.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BACKGROUND", (0, 0), (-1, -1), PAPER),
                ("BOX", (0, 0), (-1, -1), 0.7, LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.7, LINE),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
            ]
        )
    )
    return t


def checklist(items):
    rows = [[CheckBox(), Paragraph(i, S["cell"])] for i in items]
    t = Table(rows, colWidths=[0.28 * inch, PAGE_W - 2 * MARGIN - 0.28 * inch], hAlign="LEFT")
    t.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LINEBELOW", (0, 0), (-1, -2), 0.5, LINE),
                ("BOX", (0, 0), (-1, -1), 0.7, LINE),
            ]
        )
    )
    return t


class Doc(BaseDocTemplate):
    def __init__(self, path, title, subject, footer):
        BaseDocTemplate.__init__(
            self,
            path,
            pagesize=LETTER,
            leftMargin=MARGIN,
            rightMargin=MARGIN,
            topMargin=MARGIN,
            bottomMargin=MARGIN,
            title=title,
            author="RentLeaks",
            subject=subject,
            creator="RentLeaks",
        )
        self.footer = footer
        frame = Frame(MARGIN, MARGIN, PAGE_W - 2 * MARGIN, PAGE_H - 2 * MARGIN - 6, id="body")
        cover = Frame(MARGIN, MARGIN, PAGE_W - 2 * MARGIN, PAGE_H - 2 * MARGIN, id="cover")
        self.addPageTemplates(
            [
                PageTemplate(id="cover", frames=[cover], onPage=self.paint_cover),
                PageTemplate(id="body", frames=[frame], onPage=self.paint_body),
            ]
        )

    def paint_cover(self, canv, doc):
        canv.saveState()
        canv.setFillColor(BRAND_DEEP)
        canv.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
        canv.setStrokeColor(colors.HexColor("#1B4A57"))
        for i, r in enumerate((90, 150, 210, 270)):
            canv.setLineWidth(1.2 if i % 2 else 0.6)
            canv.circle(PAGE_W - 40, -30, r, stroke=1, fill=0)
        canv.restoreState()

    def paint_body(self, canv, doc):
        canv.saveState()
        canv.setFillColor(colors.white)
        canv.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
        canv.setFillColor(BRAND)
        canv.rect(0, PAGE_H - 4, PAGE_W, 4, stroke=0, fill=1)
        canv.setStrokeColor(LINE)
        canv.setLineWidth(0.6)
        canv.line(MARGIN, MARGIN - 14, PAGE_W - MARGIN, MARGIN - 14)
        canv.setFont("Helvetica", 7.6)
        canv.setFillColor(MUTED)
        canv.drawString(MARGIN, MARGIN - 26, self.footer)
        canv.drawRightString(PAGE_W - MARGIN, MARGIN - 26, f"Page {canv.getPageNumber() - 1}")
        canv.restoreState()


def cover_story(cover, stamp):
    out = [
        Spacer(1, 1.5 * inch),
        Paragraph(cover["kicker"], S["cover_k"]),
        Paragraph(cover["headline"], S["cover_h"]),
        Paragraph(cover["lede"], S["cover_p"]),
        Spacer(1, 0.35 * inch),
    ]
    rows = [
        [Paragraph(f'<font color="#8FD3DF"><b>{a}</b></font>', S["cover_s"]), Paragraph(f'<font color="#D7E6E9">{b}</font>', S["cover_s"])]
        for a, b in cover["facts"]
    ]
    t = Table(rows, colWidths=[1.5 * inch, PAGE_W - 2 * MARGIN - 1.5 * inch], hAlign="LEFT")
    t.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LINEBELOW", (0, 0), (-1, -2), 0.5, colors.HexColor("#1B4A57")),
                ("LINEABOVE", (0, 0), (-1, 0), 0.5, colors.HexColor("#1B4A57")),
            ]
        )
    )
    return out + [t, Spacer(1, 0.5 * inch), Paragraph(stamp, S["cover_s"]), NextPageTemplate("body"), PageBreak()]


def render(block):
    """One spec block → reportlab flowables."""
    kind = block["type"]
    if kind in ("kicker", "h1", "h2", "h3", "lede", "body", "small"):
        return [Paragraph(block["text"], S[kind if kind != "kicker" else "kicker"])]
    if kind == "bullets":
        return [bullets(block["items"])]
    if kind == "table":
        return [table(block["rows"], block.get("widths")), Spacer(1, 4)]
    if kind == "steps":
        return [steps([tuple(i) for i in block["items"]])]
    if kind == "checklist":
        return [checklist(block["items"])]
    if kind == "box":
        inner = []
        if block.get("title"):
            inner.append(Paragraph(f"<b>{block['title']}</b>", S["note"]))
        inner.append(Paragraph(block["text"], S["body"]))
        if block.get("small"):
            inner.append(Paragraph(block["small"], S["small"]))
        return [box(inner, block.get("tone", "brand")), Spacer(1, 6)]
    if kind == "rule":
        return [Spacer(1, 8), Rule()]
    if kind == "spacer":
        return [Spacer(1, block.get("height", 10))]
    if kind == "pagebreak":
        return [PageBreak()]
    raise SystemExit(f"Unknown block type '{kind}' — see the list at the top of build-guides.py")


REQUIRED = ("id", "audience", "title", "tagline", "file", "cta", "inside", "cover", "blocks")


def load(path):
    spec = json.load(open(path, encoding="utf-8"))
    missing = [k for k in REQUIRED if k not in spec]
    if missing:
        raise SystemExit(f"{os.path.basename(path)} is missing: {', '.join(missing)}")
    if spec["audience"] not in ("tenant", "partner"):
        raise SystemExit(f"{spec['id']}: audience must be 'tenant' or 'partner'")
    if spec.get("extra", "city") not in ("city", "brokerage"):
        raise SystemExit(f"{spec['id']}: extra must be 'city' or 'brokerage'")
    if not spec["file"].endswith(".pdf"):
        raise SystemExit(f"{spec['id']}: file must end in .pdf")
    return json.loads(json.dumps(spec).replace("{{referral_pct}}", REFERRAL_PCT))


def build(spec):
    path = os.path.join(OUT, spec["file"])
    story = cover_story(spec["cover"], f"Version {VERSION} · {date.today().strftime('%B %Y')} · {SITE}")
    for b in spec["blocks"]:
        story += render(b)
    Doc(path, f"{spec['title']} — RentLeaks", spec.get("subject", spec["tagline"]), spec.get("footer", spec["title"])).build(story)
    from pypdf import PdfReader

    pages = max(1, len(PdfReader(path).pages) - 1)  # the cover isn't a page anyone counts
    return path, pages, os.path.getsize(path)


def ts_string(s):
    return '"' + str(s).replace("\\", "\\\\").replace('"', '\\"') + '"'


def write_catalog(specs):
    """Replaces the guides:start/end region in core.ts — one file, no imports to
    thread through Next, the tests and the page builder."""
    src = open(CORE, encoding="utf-8").read()
    start, end = "/* guides:start", "/* guides:end */"
    if start not in src or end not in src:
        sys.exit("core.ts has no guides:start / guides:end region — put it back before building.")
    lines = [
        "/* guides:start — generated from tools/guides/*.json by tools/build-guides.py.",
        "   Edit the spec and re-run it; anything typed here is overwritten. */",
        "export const GUIDES: Guide[] = [",
    ]
    for s_ in specs:
        lines += [
            "  {",
            f"    id: {ts_string(s_['id'])},",
            f"    audience: {ts_string(s_['audience'])},",
            f"    title: {ts_string(s_['title'])},",
            f"    tagline: {ts_string(s_['tagline'])},",
            f"    file: {ts_string(s_['file'])},",
            f"    pages: {s_['pages']},",
            "    inside: [",
        ]
        lines += [f"      {ts_string(i)}," for i in s_["inside"]]
        lines += [
            "    ],",
            f"    extra: {ts_string(s_.get('extra', 'city'))},",
            f"    cta: {ts_string(s_['cta'])},",
            "  },",
        ]
    lines += ["];", end]
    head = src[: src.index(start)]
    tail = src[src.index(end) + len(end) :]
    open(CORE, "w", encoding="utf-8").write(head + "\n".join(lines) + tail)


def main():
    ap = argparse.ArgumentParser(description="Build the lead-magnet PDFs and the catalogue the app reads.")
    ap.add_argument("only", nargs="?", help="one guide id")
    ap.add_argument("--check", action="store_true", help="validate the specs without writing anything")
    a = ap.parse_args()

    paths = sorted(glob.glob(os.path.join(SPECS, "*.json")))
    if not paths:
        sys.exit(f"No specs in {SPECS} — make one with tools/new-lead-magnet.py")
    specs = [load(p) for p in paths]
    # Renters first, then agents, then by id — the order the public page uses.
    specs.sort(key=lambda s_: (0 if s_["audience"] == "tenant" else 1, s_.get("order", 100), s_["id"]))
    ids = [s["id"] for s in specs]
    if len(set(ids)) != len(ids):
        sys.exit("Two specs share an id — ids must be unique.")
    if a.check:
        print(f"{len(specs)} spec(s) OK: {', '.join(ids)}")
        return
    if a.only and a.only not in ids:
        sys.exit(f"No spec with id '{a.only}'. Have: {', '.join(ids)}")

    os.makedirs(OUT, exist_ok=True)
    made = []
    for s in specs:
        if a.only and s["id"] != a.only:
            # Still needed for the catalogue, so read the page count off the existing PDF.
            p = os.path.join(OUT, s["file"])
            try:
                from pypdf import PdfReader

                s["pages"] = max(1, len(PdfReader(p).pages) - 1)
            except Exception:
                s["pages"] = s.get("pages", 1)
            continue
        path, pages, size = build(s)
        s["pages"] = pages
        made.append(f"{s['file']} ({pages} pages, {size // 1024} KB)")
    write_catalog(specs)
    print("Wrote " + (", ".join(made) if made else "nothing new") + f"\n  -> {OUT}\n  -> {os.path.relpath(CORE, ROOT)} (guides region)")


if __name__ == "__main__":
    main()
