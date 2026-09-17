#!/usr/bin/env python3
"""
Builds the two RentLeaks broker-network lead magnets into web/public/guides/:

  rentleaks-renter-broker-playbook.pdf
  rentleaks-referral-partner-kit.pdf

They live with the app, not the website, so the only way to a copy is the
private link the app emails after someone fills in the form (app.rentleaks.com
tells crawlers to stay out, so the files never turn up in search). Run this
again whenever the terms, the fee rules or the brand change:

    python3 tools/build-guides.py           (needs reportlab)

Everything here is plain text and vector drawing — no images, so the files
stay small enough to email. Figures in the renter playbook are worked
examples, not promises; the partner kit's referral percentage is the default
in the desk (Broker network -> Terms), so re-run this if you change it.
"""
import os
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
    KeepTogether,
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
OUT = os.path.join(ROOT, "web", "public", "guides")
SITE = "rentleaks.com/hire-a-broker/"
VERSION = "2026.09"

INK = colors.HexColor("#0E1F26")
INK2 = colors.HexColor("#3D555E")
MUTED = colors.HexColor("#5C747D")
BRAND = colors.HexColor("#1F7181")
BRAND_DEEP = colors.HexColor("#0D2229")
BRAND_SOFT = colors.HexColor("#E6F3F5")
VALUE = colors.HexColor("#7E5518")
VALUE_SOFT = colors.HexColor("#FBF0DA")
PAPER = colors.HexColor("#FAF7F2")
LINE = colors.HexColor("#DCD6CC")
GOOD = colors.HexColor("#2E6E58")

MARGIN = 0.78 * inch
PAGE_W, PAGE_H = LETTER

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
    """A hairline the width of the frame."""

    def __init__(self, color=LINE, thickness=0.7, space=6):
        Flowable.__init__(self)
        self.color, self.thickness, self.space = color, thickness, space
        self.width = 0
        self.height = space

    def wrap(self, w, h):
        self.width = w
        return w, self.height

    def draw(self):
        self.canv.setStrokeColor(self.color)
        self.canv.setLineWidth(self.thickness)
        self.canv.line(0, self.height / 2, self.width, self.height / 2)


def box(flowables, fill=BRAND_SOFT, border=None, pad=9):
    """A tinted callout box."""
    t = Table([[flowables]], colWidths=[PAGE_W - 2 * MARGIN])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), fill),
                ("BOX", (0, 0), (-1, -1), 0.7, border or fill),
                ("LEFTPADDING", (0, 0), (-1, -1), pad),
                ("RIGHTPADDING", (0, 0), (-1, -1), pad),
                ("TOPPADDING", (0, 0), (-1, -1), pad),
                ("BOTTOMPADDING", (0, 0), (-1, -1), pad),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    return t


def bullets(items, color=BRAND):
    return ListFlowable(
        [ListItem(Paragraph(i, S["body"]), leftIndent=14, value="square") for i in items],
        bulletType="bullet",
        start="square",
        bulletFontSize=5,
        bulletColor=color,
        leftIndent=12,
        spaceAfter=6,
    )


def table(rows, widths, header=True, zebra=True):
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
    """Numbered step cards, two columns."""
    cells = []
    for n, (title, text) in enumerate(items, start=1):
        inner = [
            Paragraph(f'<font color="#1F7181" size="14"><b>{n}</b></font>', S["body"]),
            Paragraph(f"<b>{title}</b>", S["note"]),
            Paragraph(text, S["small"]),
        ]
        cells.append(inner)
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


def checklist(items):
    """A worksheet: a tick box per line."""
    rows = [[CheckBox(), Paragraph(i, S["cell"])] for i in items]
    t = Table(rows, colWidths=[0.28 * inch, PAGE_W - 2 * MARGIN - 0.28 * inch], hAlign="LEFT")
    style = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, -2), 0.5, LINE),
        ("BOX", (0, 0), (-1, -1), 0.7, LINE),
    ]
    t.setStyle(TableStyle(style))
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
        # A quiet arc motif, bottom right.
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


def cover(kicker, title, lede, facts, stamp):
    out = [
        Spacer(1, 1.5 * inch),
        Paragraph(kicker, S["cover_k"]),
        Paragraph(title, S["cover_h"]),
        Paragraph(lede, S["cover_p"]),
        Spacer(1, 0.35 * inch),
    ]
    rows = [[Paragraph(f'<font color="#8FD3DF"><b>{a}</b></font>', S["cover_s"]), Paragraph(f'<font color="#D7E6E9">{b}</font>', S["cover_s"])] for a, b in facts]
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
    out += [t, Spacer(1, 0.5 * inch), Paragraph(stamp, S["cover_s"]), NextPageTemplate("body"), PageBreak()]
    return out


# ---------------------------------------------------------------- renter guide

def renter_story():
    s = []
    s += cover(
        "RENTLEAKS · BROKER NETWORK",
        "The New York renter&rsquo;s<br/>broker playbook",
        "Who pays a broker fee now, what your agreement has to say, and how to hire an agent "
        "for a fee you set — in three steps.",
        [
            ("What&rsquo;s inside", "The FARE Act in plain English · 12 questions to ask · a fee-cap worksheet · what a fair agreement looks like"),
            ("Who it&rsquo;s for", "Anyone renting in New York who wants someone on their side of the table"),
            ("From", "RentLeaks — all-in prices, honest fees, 30-day-plus homes"),
        ],
        f"Version {VERSION} · {date.today().strftime('%B %Y')} · {SITE}",
    )

    s.append(Paragraph("Start here", S["kicker"]))
    s.append(Paragraph("Since June 2025, the fee is the hirer&rsquo;s to pay", S["h1"]))
    s.append(
        Paragraph(
            "New York City&rsquo;s FARE Act took effect on <b>11 June 2025</b>. The rule is simple: the person who hires the broker "
            "pays the broker. If a landlord hires an agent to list and show an apartment, that agent&rsquo;s fee is the landlord&rsquo;s — "
            "it can&rsquo;t be passed to you. And every fee a renter does have to pay has to be spelled out, clearly, in the listing "
            "and in an itemised written disclosure you sign before the lease.",
            S["lede"],
        )
    )
    s.append(
        Paragraph(
            "What the law did not do is ban hiring your own broker. That was always allowed, and it&rsquo;s still the one situation "
            "where a renter pays a fee: you chose an agent to work for you, and you agreed the fee in writing first. This guide is "
            "about doing that well — what it should cost, what the agreement must say, and how to tell a good broker from an "
            "expensive one.",
            S["body"],
        )
    )
    s.append(
        box(
            [
                Paragraph("<b>The one-line version</b>", S["note"]),
                Paragraph(
                    "You never owe a fee for an apartment a landlord&rsquo;s agent is listing. You may owe a fee to a broker "
                    "<i>you</i> hired, if you sign a lease for a home they found or showed you — and only at the number you agreed "
                    "in writing before the search started.",
                    S["body"],
                ),
            ]
        )
    )

    s.append(Paragraph("Who pays what, at a glance", S["h2"]))
    s.append(
        table(
            [
                ["The situation", "Who pays the broker", "What you should see"],
                [
                    "You answer a listing posted by the landlord&rsquo;s agent",
                    "<b>The landlord.</b> No fee to you for that agent&rsquo;s work.",
                    "The listing states the fees you&rsquo;d pay (application, move-in, any others) clearly and up front.",
                ],
                [
                    "You rent directly from an owner, no agent involved",
                    "<b>Nobody.</b> There is no broker fee.",
                    "An itemised written fee disclosure before you sign the lease.",
                ],
                [
                    "You hire your own broker to search for you",
                    "<b>You</b> — at the fee you agreed in writing first.",
                    "A signed representation and fee agreement, before any viewing you&rsquo;re charged for.",
                ],
                [
                    "Your broker shows you a home their own brokerage lists for the landlord",
                    "<b>The landlord.</b> Your broker can&rsquo;t charge you for it.",
                    "Written notice of the dual role before you see the home.",
                ],
            ],
            [2.05 * inch, 1.75 * inch, 3.2 * inch],
        )
    )
    s.append(Spacer(1, 4))
    s.append(
        Paragraph(
            "Penalties for charging a renter an unlawful fee start at $1,000 for a first violation and rise from there, and renters can "
            "bring a case themselves. If an agent asks you for a fee on their own landlord listing, that is not a negotiation — it is "
            "a violation.",
            S["small"],
        )
    )

    s.append(PageBreak())
    s.append(Paragraph("The money", S["kicker"]))
    s.append(Paragraph("What hiring a broker actually costs", S["h2"]))
    s.append(
        Paragraph(
            "Rental broker fees in New York are quoted three ways: as <b>months of rent</b> (one month is the common shorthand), as a "
            "<b>percentage of the first year&rsquo;s rent</b> (12–15% was the old standard; one month works out to about 8.33%), or as a "
            "<b>flat fee</b>. They are all the same thing in different clothes. Convert before you compare.",
            S["body"],
        )
    )
    s.append(
        table(
            [
                ["Monthly rent", "One month", "12% of a year", "15% of a year", "Flat $2,500"],
                ["$2,400", "$2,400", "$3,456", "$4,320", "$2,500"],
                ["$3,000", "$3,000", "$4,320", "$5,400", "$2,500"],
                ["$3,600", "$3,600", "$5,184", "$6,480", "$2,500"],
                ["$4,500", "$4,500", "$6,480", "$8,100", "$2,500"],
                ["$6,000", "$6,000", "$8,640", "$10,800", "$2,500"],
            ],
            [1.35 * inch, 1.35 * inch, 1.35 * inch, 1.35 * inch, 1.6 * inch],
        )
    )
    s.append(Spacer(1, 6))
    s.append(
        box(
            [
                Paragraph("<b>Set your cap before you talk to anyone</b>", S["note"]),
                Paragraph(
                    "A cap is one number you decide in advance — &ldquo;no more than one month&rsquo;s rent&rdquo;, &ldquo;no more than 10% of "
                    "the year&rdquo;, &ldquo;no more than $2,500&rdquo;. Brokers then propose <i>at or under</i> it, which turns an "
                    "awkward negotiation into a simple comparison. On RentLeaks you set the cap in the brief, and a proposal above it "
                    "can&rsquo;t even be sent to you.",
                    S["body"],
                ),
            ],
            fill=VALUE_SOFT,
            border=colors.HexColor("#E7D4AE"),
        )
    )

    s.append(Paragraph("Worked example", S["h3"]))
    s.append(
        Paragraph(
            "A $3,600 one-bedroom in Williamsburg. A broker proposes 0.75 months: <b>$2,700</b>, due only when you sign the lease. "
            "Against 15% of the year ($6,480) that is $3,780 saved; against &ldquo;one month&rdquo; it is $900. Two viewings arranged for "
            "a Saturday, an application filed the same evening and a lease signed on the Tuesday is what the money is for. If none of "
            "it happens, nothing is owed — no lease, no fee.",
            S["body"],
        )
    )

    s.append(Paragraph("Your fee-cap worksheet", S["h2"]))
    s.append(
        table(
            [
                ["Fill this in", "Yours"],
                ["Top monthly rent I&rsquo;ll pay", "$__________"],
                ["Move-in date (and how flexible)", "____________________"],
                ["Neighbourhoods, in order", "____________________"],
                ["Cash I have for move-in (first month + deposit + any fee)", "$__________"],
                ["My broker-fee cap (months / % / flat)", "____________________"],
                ["That cap in dollars, at my top rent", "$__________"],
            ],
            [4.4 * inch, 2.6 * inch],
        )
    )

    s.append(PageBreak())
    s.append(Paragraph("Before you sign", S["kicker"]))
    s.append(Paragraph("What a fair agreement says", S["h2"]))
    s.append(
        Paragraph(
            "A tenant representation and fee agreement should be short enough to read in one sitting. Ours runs to ten numbered "
            "sections; whoever you hire, look for these eight things.",
            S["body"],
        )
    )
    s.append(
        bullets(
            [
                "<b>Who&rsquo;s who.</b> Your name, the agent&rsquo;s name and licence number, their brokerage, and their supervising broker if they&rsquo;re a salesperson.",
                "<b>What they&rsquo;ll do.</b> The area, the kind of home, the budget and the dates — and that they&rsquo;re working for you, not the landlord.",
                "<b>How long it lasts and how to end it.</b> A fixed term (90 days is reasonable) and the right to end it by email, either side.",
                "<b>The fee, in one sentence.</b> The exact number or formula, earned only if you sign a lease for a home they found or showed you.",
                "<b>No lease, no fee.</b> Nothing due for viewings, advice, applications or time spent.",
                "<b>The landlord-listing carve-out.</b> No fee to you for homes their brokerage represents for the landlord, and written notice of any dual role before the viewing.",
                "<b>A tail, but a short one.</b> If the agreement ends, a fee can still be owed for a home they already showed you — 30 days is fair, six months is not.",
                "<b>Where your money goes.</b> Rent and deposits go to the landlord or its managing agent, against a signed lease — never to the broker&rsquo;s personal account, never before you&rsquo;ve seen the home.",
            ]
        )
    )
    s.append(
        box(
            [
                Paragraph("<b>Walk away if…</b>", S["note"]),
                Paragraph(
                    "…the fee is &ldquo;standard, we&rsquo;ll sort it later&rdquo;; the agreement is exclusive for six months with no way out; "
                    "you&rsquo;re asked for a deposit, a holding fee or a &ldquo;key fee&rdquo; before you&rsquo;ve seen the apartment or have a lease to "
                    "sign; or a particular apartment is only available to you <i>if</i> you sign with them. That last one is prohibited.",
                    S["body"],
                ),
            ],
            fill=colors.HexColor("#F7E7E1"),
            border=colors.HexColor("#E3C3B6"),
        )
    )

    s.append(Paragraph("12 questions to ask a broker", S["h2"]))
    s.append(
        table(
            [
                ["About the work", "About the money"],
                ["1. Which buildings in this neighbourhood do you actually work with?", "7. What&rsquo;s your fee, in dollars, at my top rent?"],
                ["2. How many renters like me did you place in the last three months?", "8. When is it due, and what happens if I don&rsquo;t sign a lease?"],
                ["3. How fast can you get me into a viewing this week?", "9. Do you also list homes for landlords in this area?"],
                ["4. Will you show me homes where you don&rsquo;t earn a fee?", "10. What other costs should I budget for — application, move-in, deposit?"],
                ["5. What does my application need to be competitive here?", "11. Is anything owed after the agreement ends, and for how long?"],
                ["6. Who else at your brokerage will I be dealing with?", "12. Can I have the agreement in writing before we start?"],
            ],
            [3.5 * inch, 3.5 * inch],
        )
    )

    s.append(PageBreak())
    s.append(Paragraph("How RentLeaks does it", S["kicker"]))
    s.append(Paragraph("Hire a broker in three steps", S["h1"]))
    s.append(
        steps(
            [
                ("Tell us what you need", "Where, when, your budget and the kind of home — about two minutes. You set the most you&rsquo;ll pay a broker."),
                ("Pick your broker", "Up to three verified, licensed agents who work your area send a short pitch and a fee at or under your cap. You choose — or none of them."),
                ("Sign &amp; search", "One clear agreement, signed in the app with a time-stamped record. Your broker takes it from there: viewings, applications, the lease."),
                ("Nothing owed to us", "RentLeaks is paid by the partner&rsquo;s brokerage out of its fee after a lease. It never increases what you pay, and we never collect rent, deposits or fees."),
            ]
        )
    )
    s.append(Spacer(1, 10))
    s.append(
        bullets(
            [
                "<b>Your details stay yours.</b> Brokers see the home you want — area, budget, dates — not your name, email or phone, until you pick one.",
                "<b>Licence checked first.</b> Every partner&rsquo;s licence is verified with the state, and salespersons work under their supervising broker.",
                "<b>Fair housing, throughout.</b> Briefs describe the home, never the people. No steering, no preferences, no exceptions.",
                "<b>Signed electronically, properly.</b> Consent first, a copy for everyone, and a fingerprint of the document so nobody can change a word after the fact.",
            ]
        )
    )
    s.append(Spacer(1, 8))
    s.append(
        box(
            [
                Paragraph("<b>Start your search</b>", S["note"]),
                Paragraph(
                    f"Two minutes at <b>{SITE}</b> puts your brief in front of verified brokers in your area. Or reply to the email this "
                    "guide came with and a person will help you set the brief.",
                    S["body"],
                ),
                Paragraph(
                    "Questions we get a lot are answered at rentleaks.com/hire-a-broker/#faq.",
                    S["small"],
                ),
            ]
        )
    )
    s.append(Spacer(1, 10))
    s.append(Rule())
    s.append(
        Paragraph(
            "This playbook is general information about how rental broker fees work in New York City, not legal advice, and rules differ "
            "outside the city. Figures are worked examples, not offers. RentLeaks is a listing platform and a licensed referring "
            "brokerage; the broker you hire represents you under their own licence.",
            S["small"],
        )
    )
    return s


# --------------------------------------------------------------- partner guide

def partner_story(referral_pct="25%"):
    s = []
    s += cover(
        "RENTLEAKS · REFERRAL PARTNER PROGRAM",
        "Tenant leads that<br/>already want a broker",
        "How the referral program works, what a lead looks like, what it pays, and what you sign — "
        "for licensed salespersons, associate brokers and brokerages.",
        [
            ("What&rsquo;s inside", "The lead flow · the fee math with worked numbers · a compliance checklist · what the agreement says"),
            ("Who it&rsquo;s for", "Licensed agents and brokerages who answer fast and work a defined patch"),
            ("Cost to join", "Nothing. A broker-to-broker referral fee only after a lease is signed"),
        ],
        f"Version {VERSION} · {date.today().strftime('%B %Y')} · {SITE}agents.html",
    )

    s.append(Paragraph("The offer", S["kicker"]))
    s.append(Paragraph("A renter who has already decided to hire a broker", S["h1"]))
    s.append(
        Paragraph(
            "Most rental &ldquo;leads&rdquo; are a name and a phone number attached to an apartment enquiry, sold to four agents at once. "
            "A RentLeaks lead is different: a renter filled in a brief asking to <i>hire</i> a broker, and set the most they&rsquo;re willing "
            "to pay one. You see the area, the budget, the dates and that fee cap before you spend a minute on it.",
            S["lede"],
        )
    )
    s.append(
        steps(
            [
                ("Join &amp; get verified", "Apply with your licence and sign the referral agreement in the app. We check the licence with the state and countersign."),
                ("Accept a lead", "Leads in your markets arrive by email and in your portal. Accept with your fee and a short pitch, or pass in one click."),
                ("Get chosen &amp; sign", "The renter compares up to three brokers and picks. The tenant agreement — with your fee — is signed in the app before you start."),
                ("Close &amp; report", "Work the search, report the signed lease in your portal, and we invoice your brokerage the referral fee."),
            ]
        )
    )

    s.append(Paragraph("What a lead looks like", S["h2"]))
    s.append(
        table(
            [
                ["Field", "Example"],
                ["Where", "Brooklyn, NY — Williamsburg, Greenpoint"],
                ["Home", "Apartment · 1 bedroom · new development"],
                ["Budget", "$3,000–$3,600 a month"],
                ["When", "Move in within a month · long term"],
                ["Fee cap", "Up to one month&rsquo;s rent (about $3,600)"],
                ["Why you", "Covers Williamsburg · new-development specialist · replies in under an hour"],
                ["Not included until you&rsquo;re chosen", "The renter&rsquo;s name, email and phone"],
            ],
            [2.1 * inch, 4.9 * inch],
        )
    )
    s.append(Spacer(1, 6))
    s.append(
        Paragraph(
            "You have a set window to answer — 24 hours by default. Accept with a fee at or under the cap and two lines on why you&rsquo;re "
            "the right agent; that pitch is the first thing the renter reads. Pass, and the lead moves to the next broker straight away.",
            S["body"],
        )
    )

    s.append(PageBreak())
    s.append(Paragraph("The math", S["kicker"]))
    s.append(Paragraph("What it pays, with real numbers", S["h2"]))
    s.append(
        Paragraph(
            f"There is no sign-up fee, no monthly fee and no charge per lead. When a referred renter signs a lease and your brokerage "
            f"collects its fee, the brokerage pays RentLeaks a referral fee of <b>{referral_pct}</b> of that gross fee — the middle of the "
            "20–35% band that is standard for broker-to-broker referrals. You keep the rest.",
            S["body"],
        )
    )
    s.append(
        table(
            [
                ["Monthly rent", "Your fee", "Gross to your brokerage", f"Referral at {referral_pct}", "Your brokerage keeps"],
                ["$2,800", "1 month", "$2,800", "$700", "$2,100"],
                ["$3,600", "0.75 months", "$2,700", "$675", "$2,025"],
                ["$3,600", "1 month", "$3,600", "$900", "$2,700"],
                ["$4,500", "12% of the year", "$6,480", "$1,620", "$4,860"],
                ["$6,000", "1 month", "$6,000", "$1,500", "$4,500"],
            ],
            [1.25 * inch, 1.3 * inch, 1.65 * inch, 1.4 * inch, 1.4 * inch],
        )
    )
    s.append(Spacer(1, 6))
    s.append(
        box(
            [
                Paragraph("<b>A year, roughly</b>", S["note"]),
                Paragraph(
                    f"Accept two leads a week, get chosen on a third of them, close half of those, at an average $2,700 fee: about 17 "
                    f"leases, roughly $46,000 gross, about ${int(46000 * 0.75):,} to your brokerage after the {referral_pct} referral. "
                    "Your own numbers will differ — the point is that the cost only ever appears after money arrives.",
                    S["body"],
                ),
            ],
            fill=VALUE_SOFT,
            border=colors.HexColor("#E7D4AE"),
        )
    )

    s.append(Paragraph("How leads are shared out", S["h3"]))
    s.append(
        Paragraph(
            "Matching is mechanical, not political. A lead goes to active partners licensed in that state whose markets cover the area, "
            "ranked on: how well the markets and specialties fit, median reply time, acceptance rate, leases closed, renter ratings and "
            "how recently you were last offered one — with open capacity respected, so nobody gets buried. There is no way to pay for "
            "position.",
            S["body"],
        )
    )

    s.append(Paragraph("What you sign", S["h2"]))
    s.append(
        table(
            [
                ["Section", "What it says"],
                ["Referrals", "Briefs without contact details; accept within the window at or under the cap, or pass."],
                ["Referral fee", f"{referral_pct} of the gross fee your brokerage receives, for a lease that renter signs within 12 months."],
                ["Paid broker to broker", "Invoiced to the brokerage after you report the lease, due within 10 days of your brokerage being paid. Never to an individual salesperson."],
                ["Licences", "Kept active and verifiable; tell us within five business days of any change."],
                ["Serving the renter", "Signed tenant agreement before any fee; no fee for homes your brokerage lists for the landlord; every disclosure and fair-housing rule followed."],
                ["Records", "Agreements and fee records kept at least three years."],
                ["Ending it", "30 days&rsquo; email notice either way. Fees for renters introduced earlier stay payable."],
            ],
            [1.9 * inch, 5.1 * inch],
        )
    )
    s.append(Spacer(1, 4))
    s.append(
        Paragraph(
            "New York Real Property Law &sect; 442 is the reason the money moves brokerage to brokerage: a salesperson or associate broker "
            "can&rsquo;t take or pay a referral fee directly, so your supervising broker signs alongside you and the invoice goes to the firm.",
            S["small"],
        )
    )

    s.append(PageBreak())
    s.append(Paragraph("Before your first lead", S["kicker"]))
    s.append(Paragraph("Compliance checklist", S["h2"]))
    s.append(
        Paragraph(
            "Print this, tick it once, keep it with your files. It is the short version of what the agreement asks of you — and what "
            "regulators look for after the fact.",
            S["body"],
        )
    )
    s.append(
        checklist(
            [
                "My licence is active, and the name on it matches the name on my RentLeaks profile.",
                "My supervising broker knows about the program and has signed the referral agreement.",
                "I have the signed tenant representation &amp; fee agreement before charging a renter anything.",
                "I never charge a referred renter for a home my brokerage lists for the landlord (FARE Act).",
                "I never make a specific home conditional on being hired.",
                "Every ad, conversation and screening standard follows fair-housing law — the home, never the people.",
                "Agency and fee disclosures are given when the law requires them, in writing (in NY, DOS-1735-f).",
                "I don&rsquo;t ask a renter for money before a viewing and a lease to sign.",
                "I update the client&rsquo;s stage in the portal at least every two weeks.",
                "I report a signed lease within five business days, with the fee my brokerage actually collected.",
                "Agreements and fee records are kept for at least three years.",
            ]
        )
    )
    s.append(Spacer(1, 10))

    s.append(Paragraph("Getting more out of it", S["h3"]))
    s.append(
        bullets(
            [
                "<b>Answer fast.</b> Reply time is the single biggest input into who gets the next lead — and renters pick the first good pitch they read.",
                "<b>Write the pitch for one renter.</b> Name the buildings you know, the day you can show, the thing you&rsquo;d warn them about. Two specific lines beat a paragraph of adjectives.",
                "<b>Price for the search, not the rent.</b> A 0.75-month fee that gets chosen beats a one-month fee that doesn&rsquo;t.",
                "<b>Keep your markets honest.</b> List the neighbourhoods you actually work; mismatched leads cost you both time and standing.",
                "<b>Add your headshot.</b> Verified partners with a photo and a line of bio are the ones renters recognise on the page — and the ones we feature.",
            ]
        )
    )
    s.append(Spacer(1, 8))
    s.append(
        box(
            [
                Paragraph("<b>Apply in two minutes</b>", S["note"]),
                Paragraph(
                    f"<b>{SITE}agents.html</b> — licence, markets, specialties. You&rsquo;ll sign the referral agreement in the app; we verify "
                    "the licence with the state and countersign, then your portal opens and leads start arriving.",
                    S["body"],
                ),
            ]
        )
    )
    s.append(Spacer(1, 10))
    s.append(Rule())
    s.append(
        Paragraph(
            "This kit describes the RentLeaks referral partner program and is general information, not legal advice. Licensing and fee "
            "rules vary by state; the signed agreement governs. The referral percentage is the current default and is fixed for you by "
            "your signed agreement.",
            S["small"],
        )
    )
    return s


def build(path, title, subject, footer, story):
    Doc(path, title, subject, footer).build(story)
    return os.path.getsize(path)


def main():
    os.makedirs(OUT, exist_ok=True)
    made = []
    for name, title, subject, footer, story in (
        (
            "rentleaks-renter-broker-playbook.pdf",
            "The New York renter's broker playbook — RentLeaks",
            "How broker fees work after the FARE Act, and how to hire your own broker for a fee you set.",
            "The New York renter's broker playbook · RentLeaks",
            renter_story(),
        ),
        (
            "rentleaks-referral-partner-kit.pdf",
            "RentLeaks referral partner kit — tenant leads for licensed agents",
            "How the RentLeaks broker referral program works, what it pays, and what partners sign.",
            "RentLeaks referral partner kit · rentleaks.com/hire-a-broker/agents.html",
            partner_story(),
        ),
    ):
        p = os.path.join(OUT, name)
        size = build(p, title, subject, footer, story)
        made.append(f"{name} ({size // 1024} KB)")
    print("Wrote " + ", ".join(made) + f"\n  -> {OUT}")


if __name__ == "__main__":
    main()
