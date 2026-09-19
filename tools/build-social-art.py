#!/usr/bin/env python3
"""
Builds the RentLeaks social artwork for LinkedIn, Instagram and TikTok into
marketing/social/<platform>/ — logos, covers, post art, story and video covers,
all at each platform's own pixel size, all drawn from the brand tokens below.

    python3 tools/build-social-art.py            (needs Pillow)
    python3 tools/build-social-art.py linkedin   (one platform)

Nothing here is a stock photo: every image is drawn, so a change to a colour or
a line of copy is one edit and one re-run. Copy lives in SPECS at the bottom;
keep it short — these are read at thumbnail size.
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "marketing", "social")

# --- brand -----------------------------------------------------------------
NIGHT = (13, 34, 41)
NIGHT_2 = (27, 74, 87)
TEAL = (31, 113, 129)
CELESTE = (143, 211, 223)
PAPER = (250, 247, 242)
INK = (14, 31, 38)
INK_2 = (61, 85, 94)
OCHRE = (196, 137, 42)
WHITE = (255, 255, 255)
GOOD = (46, 110, 88)

FONTS = "/usr/share/fonts/truetype/google-fonts"
DEJAVU = "/usr/share/fonts/truetype/dejavu"


def font(kind: str, size: int):
    """Display = Lora (serif, close to Fraunces); UI = Poppins (close to Plus Jakarta Sans)."""
    paths = {
        "display": [f"{FONTS}/Lora-Variable.ttf", f"{DEJAVU}/DejaVuSerif-Bold.ttf"],
        "displayitalic": [f"{FONTS}/Lora-Italic-Variable.ttf", f"{DEJAVU}/DejaVuSerif-Italic.ttf"],
        "bold": [f"{FONTS}/Poppins-Bold.ttf", f"{DEJAVU}/DejaVuSans-Bold.ttf"],
        "semi": [f"{FONTS}/Poppins-SemiBold.ttf", f"{FONTS}/Poppins-Medium.ttf", f"{DEJAVU}/DejaVuSans-Bold.ttf"],
        "body": [f"{FONTS}/Poppins-Regular.ttf", f"{DEJAVU}/DejaVuSans.ttf"],
    }
    for p in paths[kind]:
        if os.path.exists(p):
            f = ImageFont.truetype(p, size)
            if kind.startswith("display"):
                try:
                    f.set_variation_by_name("SemiBold")
                except Exception:
                    pass
            return f
    raise SystemExit("No usable font found")


def text_w(d, s, f):
    return d.textbbox((0, 0), s, font=f)[2]


def wrap(d, s, f, width):
    words, lines, line = s.split(), [], ""
    for w in words:
        trial = f"{line} {w}".strip()
        if text_w(d, trial, f) <= width or not line:
            line = trial
        else:
            lines.append(line)
            line = w
    if line:
        lines.append(line)
    return lines


def draw_text(d, xy, s, f, fill, width=None, leading=1.24, align="left", box_w=None):
    x, y = xy
    lines = wrap(d, s, f, width) if width else [s]
    step = int(f.size * leading)
    for ln in lines:
        lx = x
        if align == "center" and box_w:
            lx = x + (box_w - text_w(d, ln, f)) // 2
        d.text((lx, y), ln, font=f, fill=fill)
        y += step
    return y


def arcs(d, cx, cy, radii, color, width=2):
    for i, r in enumerate(radii):
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=color, width=width if i % 2 else max(1, width - 1))


def night_bg(size, glow=True):
    img = Image.new("RGB", size, NIGHT)
    d = ImageDraw.Draw(img)
    if glow:
        w, h = size
        arcs(d, int(w * 0.92), int(h * 1.05), [int(w * 0.22), int(w * 0.34), int(w * 0.46), int(w * 0.6)], NIGHT_2, 3)
    return img, d


def paper_bg(size):
    img = Image.new("RGB", size, PAPER)
    return img, ImageDraw.Draw(img)


def mark(d, x, y, size, bg=CELESTE, fg=NIGHT, radius=None):
    """The RL tile."""
    r = radius if radius is not None else int(size * 0.26)
    d.rounded_rectangle([x, y, x + size, y + size], radius=r, fill=bg)
    f = font("bold", int(size * 0.42))
    w = text_w(d, "RL", f)
    d.text((x + (size - w) / 2, y + size * 0.27), "RL", font=f, fill=fg)


def rule(d, x, y, w, color=CELESTE, h=3):
    d.rounded_rectangle([x, y, x + w, y + h], radius=h // 2, fill=color)


def pill(d, x, y, label, f, fg=NIGHT, bg=CELESTE, pad=(18, 10)):
    w = text_w(d, label, f) + pad[0] * 2
    h = int(f.size * 1.5) + pad[1]
    d.rounded_rectangle([x, y, x + w, y + h], radius=h // 2, fill=bg)
    d.text((x + pad[0], y + pad[1] * 0.55), label, font=f, fill=fg)
    return w, h


# --- the pieces ------------------------------------------------------------

def logo(size, bg=NIGHT, tile=CELESTE, ring=True):
    img = Image.new("RGB", (size, size), bg)
    d = ImageDraw.Draw(img)
    if ring:
        arcs(d, int(size * 0.5), int(size * 1.15), [int(size * 0.5), int(size * 0.68)], NIGHT_2, max(2, size // 150))
    m = int(size * 0.46)
    mark(d, (size - m) // 2, int(size * 0.20), m, bg=tile, fg=NIGHT)
    f = font("bold", int(size * 0.115))
    w = text_w(d, "RENTLEAKS", f)
    d.text(((size - w) / 2, size * 0.71), "RENTLEAKS", font=f, fill=WHITE)
    return img


def cover_linkedin(size, kicker, headline, points):
    """LinkedIn drops the page logo over the banner's left edge, so the copy
    starts clear of it and the right side stays quiet for the mobile crop."""
    img, d = night_bg(size)
    w, h = size
    x = int(w * 0.19)
    fk = font("bold", max(9, int(h * 0.082)))
    d.text((x, int(h * 0.22)), kicker.upper(), font=fk, fill=CELESTE)
    fh = font("display", int(h * 0.21))
    d.text((x, int(h * 0.36)), headline, font=fh, fill=WHITE)
    fp = font("body", max(9, int(h * 0.082)))
    d.text((x, int(h * 0.72)), "  ·  ".join(points), font=fp, fill=(200, 219, 223))
    rule(d, x, int(h * 0.17), int(w * 0.03), CELESTE, max(2, int(h * 0.016)))
    return img


def photo_bg(size, path):
    """A photograph, cropped to fill, darkened enough to carry type.

    The scrim is a vertical gradient rather than a flat wash: the picture stays
    a picture at the top, and the bottom — where the headline, the sub and the
    chips sit — goes dark enough for white text to clear WCAG AA at these
    sizes. Returns None when the file isn't there, so a missing photo falls
    back to the painted card instead of breaking the build.
    """
    if not path or not os.path.exists(path):
        return None
    w, h = size
    src = Image.open(path).convert("RGB")
    scale = max(w / src.width, h / src.height)
    src = src.resize((max(w, int(src.width * scale)), max(h, int(src.height * scale))), Image.LANCZOS)
    img = src.crop(((src.width - w) // 2, (src.height - h) // 2, (src.width - w) // 2 + w, (src.height - h) // 2 + h))

    scrim = Image.new("L", (1, h))
    for y in range(h):
        t = y / max(1, h - 1)
        # Barely there at the top so the room still reads as a room, and dark
        # enough by the lower third that white type clears AA over any of it.
        scrim.putpixel((0, y), int(255 * min(0.90, 0.12 + 0.80 * (t ** 1.8))))
    img = Image.composite(Image.new("RGB", (w, h), NIGHT), img, scrim.resize((w, h)))
    return img, ImageDraw.Draw(img)


def post_card(size, kicker, headline, sub, chips, theme="night", footer="rentleaks.com/hire-a-broker", photo=None):
    """One card, any aspect: type shrinks until the whole block fits the frame."""
    shot = photo_bg(size, photo)
    if shot:
        img, d = shot
        theme = "night"  # white type over a photograph, whatever the spec said
    else:
        img, d = (night_bg(size) if theme == "night" else paper_bg(size))
    w, h = size
    on_night = theme == "night"
    base = min(w, int(h * 1.5))
    pad = int(base * 0.072)
    head_c = WHITE if on_night else INK
    sub_c = (205, 222, 226) if on_night else INK_2
    kick_c = CELESTE if on_night else TEAL
    tile = int(base * 0.085)
    mark(d, pad, pad, tile, bg=CELESTE if on_night else NIGHT, fg=NIGHT if on_night else CELESTE)

    inner = w - pad * 2
    top = pad + tile + int(base * 0.05)
    floor = h - pad - int(base * 0.085)  # the footer's line sits below this

    def layout(scale):
        fk = font("bold", max(11, int(base * 0.027 * scale)))
        fh = font("display", max(16, int(base * 0.085 * scale)))
        fs = font("body", max(11, int(base * 0.035 * scale)))
        fc = font("semi", max(10, int(base * 0.027 * scale)))
        hl = wrap(d, headline, fh, inner)
        sl = wrap(d, sub, fs, inner)
        rows = 0
        if chips:
            cx, rows = 0, 1
            for c in chips:
                cw = text_w(d, c, fc) + int(base * 0.075)
                if cx + cw > inner and cx:
                    rows += 1
                    cx = 0
                cx += cw + int(base * 0.02)
        height = (
            int(fk.size * 1.9)
            + len(hl) * int(fh.size * 1.16)
            + int(base * 0.028)
            + len(sl) * int(fs.size * 1.42)
            + (int(base * 0.03) + rows * int(fc.size * 2.3) if chips else 0)
        )
        return fk, fh, fs, fc, hl, sl, height

    scale = 1.0
    fk, fh, fs, fc, hl, sl, height = layout(scale)
    while height > floor - top and scale > 0.42:
        scale -= 0.04
        fk, fh, fs, fc, hl, sl, height = layout(scale)

    # A short block in a tall frame sits optically centred rather than top-heavy.
    y = top
    slack = (floor - top) - height
    if slack > 0:
        y += int(slack * (0.94 if shot else (0.42 if h > w else 0.18)))
    # Over a photograph the top of the block can land on a light part of the
    # room, so the kicker and headline carry a soft shadow. On a painted card
    # there is nothing to separate them from, and a shadow would just be grubby.
    def line(xy, txt, f, fill):
        if shot:
            off = max(1, int(f.size * 0.055))
            d.text((xy[0] + off, xy[1] + off), txt, font=f, fill=(6, 18, 22))
        d.text(xy, txt, font=f, fill=fill)

    line((pad, y), kicker.upper(), fk, kick_c)
    y += int(fk.size * 1.9)
    for ln in hl:
        line((pad, y), ln, fh, head_c)
        y += int(fh.size * 1.16)
    y += int(base * 0.028)
    for ln in sl:
        d.text((pad, y), ln, font=fs, fill=sub_c)
        y += int(fs.size * 1.42)
    if chips:
        y += int(base * 0.03)
        cx, gap = pad, int(base * 0.02)
        cpad = (int(base * 0.037), int(base * 0.018))
        row_h = 0
        for c in chips:
            # Measure first: a chip that starts inside the frame can still run
            # off the right edge, so the wrap has to happen before it is drawn.
            need = text_w(d, c, fc) + cpad[0] * 2
            if cx > pad and cx + need > w - pad:
                cx = pad
                y += row_h + gap
            cw, ch = pill(d, cx, y, c, fc, fg=NIGHT if on_night else WHITE, bg=CELESTE if on_night else TEAL, pad=cpad)
            row_h = ch
            cx += cw + gap
    ff = font("semi", max(11, int(base * 0.028)))
    rule(d, pad, h - pad - int(base * 0.05), int(base * 0.085), CELESTE if on_night else TEAL)
    d.text((pad, h - pad - int(base * 0.032)), footer, font=ff, fill=sub_c)
    return img


def story_card(size, kicker, headline, lines, cta, theme="night"):
    img, d = (night_bg(size) if theme == "night" else paper_bg(size))
    w, h = size
    on_night = theme == "night"
    pad = int(w * 0.09)
    head_c = WHITE if on_night else INK
    body_c = (205, 222, 226) if on_night else INK_2
    mark(d, pad, int(h * 0.12), int(w * 0.13), bg=CELESTE if on_night else NIGHT, fg=NIGHT if on_night else CELESTE)
    y = int(h * 0.26)
    d.text((pad, y), kicker.upper(), font=font("bold", int(w * 0.033)), fill=CELESTE if on_night else TEAL)
    y += int(w * 0.075)
    y = draw_text(d, (pad, y), headline, font("display", int(w * 0.105)), head_c, width=w - pad * 2, leading=1.15)
    y += int(h * 0.02)
    fb = font("body", int(w * 0.042))
    for ln in lines:
        d.ellipse([pad, y + int(w * 0.022), pad + int(w * 0.018), y + int(w * 0.04)], fill=CELESTE if on_night else TEAL)
        y = draw_text(d, (pad + int(w * 0.042), y), ln, fb, body_c, width=w - pad * 2 - int(w * 0.042), leading=1.35)
        y += int(h * 0.012)
    fcta = font("semi", int(w * 0.045))
    bw = text_w(d, cta, fcta) + int(w * 0.11)
    bh = int(w * 0.135)
    by = int(h * 0.80)
    d.rounded_rectangle([pad, by, pad + bw, by + bh], radius=bh // 2, fill=CELESTE if on_night else TEAL)
    d.text((pad + int(w * 0.055), by + bh * 0.3), cta, font=fcta, fill=NIGHT if on_night else WHITE)
    d.text((pad, int(h * 0.90)), "rentleaks.com/hire-a-broker", font=font("body", int(w * 0.034)), fill=body_c)
    return img


def highlight(size, label, icon="dot"):
    img = Image.new("RGB", (size, size), NIGHT)
    d = ImageDraw.Draw(img)
    arcs(d, size // 2, size // 2, [int(size * 0.34)], NIGHT_2, 6)
    f = font("bold", int(size * 0.13))
    lines = wrap(d, label.upper(), f, int(size * 0.66))
    y = (size - len(lines) * int(f.size * 1.2)) // 2
    for ln in lines:
        d.text(((size - text_w(d, ln, f)) / 2, y), ln, font=f, fill=CELESTE)
        y += int(f.size * 1.2)
    return img


# --- what gets built -------------------------------------------------------

GUIDE_POINTS = ["Verified licensed brokers", "You set the fee cap", "Signed in the app"]

SPECS = {
    "linkedin": [
        ("logo-300.png", lambda: logo(300)),
        ("logo-400-light.png", lambda: logo(400, bg=PAPER, tile=NIGHT)),
        (
            "cover-1128x191.png",
            lambda: cover_linkedin(
                (1128, 191),
                "RentLeaks · broker network",
                "Hire a broker for a fee you set",
                ["Licences verified", "Up to 3 proposals", "Signed in the app"],
            ),
        ),
        (
            "post-renters-1200x627.png",
            lambda: post_card(
                (1200, 627),
                "Free guide · renters",
                "Who pays the broker fee now?",
                "The FARE Act in plain English, what a fair agreement says, and the 12 questions to ask before you hire anyone.",
                ["5 pages", "PDF", "$0"],
            ),
        ),
        (
            "post-agents-1200x627.png",
            lambda: post_card(
                (1200, 627),
                "For licensed agents",
                "Leads that already want a broker",
                "Area, budget, dates and the fee they'll pay — before you spend a minute. No sign-up fee; a referral fee only after a lease.",
                ["Broker-to-broker", "24h to answer", "Merit, not pay-to-play"],
                footer="rentleaks.com/hire-a-broker/agents.html",
            ),
        ),
        (
            "post-square-1200x1200.png",
            lambda: post_card(
                (1200, 1200),
                "1 · 2 · 3",
                "Tell us. Pick. Sign.",
                "Tell us what you need, compare up to three verified brokers under your own fee cap, and sign one clear agreement in the app.",
                ["No lease, no fee"],
                theme="paper",
            ),
        ),
    ],
    "instagram": [
        ("profile-320.png", lambda: logo(320)),
        (
            "post-fare-1080x1350.png",
            lambda: post_card(
                (1080, 1350),
                "Know your rights",
                "You don't owe a fee on a landlord's listing",
                "Since June 2025 the party who hires the broker pays the broker. The one time a renter pays is when they hire their own — in writing, first.",
                ["FARE Act", "NYC"],
            ),
        ),
        (
            "post-cap-1080x1350.png",
            lambda: post_card(
                (1080, 1350),
                "Set your cap",
                "One month? 12%? Or $0?",
                "You decide the most you'll pay before any broker sees your brief. Proposals above your cap can't reach you.",
                ["Your number", "Their pitch"],
                theme="paper",
            ),
        ),
        (
            "post-agents-1080x1350.png",
            lambda: post_card(
                (1080, 1350),
                "Licensed agents",
                "Ten spots. Real faces.",
                "Verified partners get renters who already decided to hire someone. Add your headshot and take a spot on the page.",
                ["No sign-up fee", "Broker-to-broker"],
                footer="rentleaks.com/hire-a-broker/agents.html",
            ),
        ),
        (
            "story-guide-1080x1920.png",
            lambda: story_card(
                (1080, 1920),
                "Free · 5 pages",
                "The renter's broker playbook",
                ["What a fee should cost", "What your agreement must say", "12 questions to ask"],
                "Get the guide",
            ),
        ),
        (
            "story-agents-1080x1920.png",
            lambda: story_card(
                (1080, 1920),
                "For agents",
                "Leads with a fee already on them",
                ["Area, budget, dates", "You propose your fee", "Referral only after a lease"],
                "Apply in 2 min",
                theme="paper",
            ),
        ),
        ("highlight-guides-1080.png", lambda: highlight(1080, "Guides")),
        ("highlight-howitworks-1080.png", lambda: highlight(1080, "How it works")),
        ("highlight-agents-1080.png", lambda: highlight(1080, "For agents")),
        ("highlight-fees-1080.png", lambda: highlight(1080, "Fees")),
        ("highlight-cities-1080.png", lambda: highlight(1080, "Cities")),
        # Instagram shows the avatar small but stores what you upload; give it
        # a real one so the profile stays sharp everywhere it is shown large.
        ("profile-1080.png", lambda: logo(1080)),
    ],
    "tiktok": [
        ("profile-200.png", lambda: logo(200)),
        (
            "cover-fare-1080x1920.png",
            lambda: story_card(
                (1080, 1920),
                "60 seconds",
                "Stop paying broker fees you don't owe",
                ["Landlord's agent = landlord pays", "Your own broker = agreed first", "Everything in writing"],
                "Watch",
            ),
        ),
        (
            "cover-cap-1080x1920.png",
            lambda: story_card(
                (1080, 1920),
                "Renters",
                "Name your number first",
                ["Set a cap before you look", "Brokers pitch under it", "No lease, no fee"],
                "How it works",
                theme="paper",
            ),
        ),
        (
            "cover-agents-1080x1920.png",
            lambda: story_card(
                (1080, 1920),
                "Agents",
                "A lead that already wants you",
                ["Brief, budget, dates", "You set your fee", "Paid after the lease"],
                "Join free",
            ),
        ),
    ],
}


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    made = []
    for platform, items in SPECS.items():
        if only and platform != only:
            continue
        folder = os.path.join(OUT, platform)
        os.makedirs(folder, exist_ok=True)
        for name, build in items:
            img = build()
            path = os.path.join(folder, name)
            img.save(path, "PNG", optimize=True)
            made.append(f"{platform}/{name} ({img.size[0]}×{img.size[1]}, {os.path.getsize(path) // 1024} KB)")
    print("Wrote:\n  " + "\n  ".join(made))


if __name__ == "__main__":
    main()
