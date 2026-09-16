#!/usr/bin/env python3
"""
Facebook post images for the site's menu sections and the trend post.

    python3 tools/make-facebook-posts.py           # full graphic cards
    python3 tools/make-facebook-posts.py --photo   # overlays for the site's photos

Writes 1080 x 1350 PNGs (Facebook's 4:5 feed size) to marketing/facebook/posts/.
Text comes from the site's own pages (see marketing/facebook/PAGE-CONTENT.md
§12–13); the trend figures carry their source on the image.

Needs Pillow with libraqm, plus Fraunces, Inter and Material Symbols fonts.
Set FONT_DIR to a folder holding the @expo-google-fonts packages
(default: mobile/node_modules/@expo-google-fonts).
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT_DIR = os.environ.get("FONT_DIR", os.path.join(ROOT, "mobile/node_modules/@expo-google-fonts"))
OUT = os.path.join(ROOT, "marketing/facebook/posts")

S = 2                      # draw at 2x, then downsample for clean edges
W, H = 1080 * S, 1350 * S
PAD = 84 * S

INK = (14, 31, 38)
INK_2 = (22, 48, 58)
PAPER = (250, 247, 242)
ON_DARK = (233, 241, 241)
MUTED = (169, 191, 197)
CELESTE_200 = (183, 223, 231)
CELESTE_300 = (133, 200, 213)
CELESTE_600 = (31, 113, 129)
OCHRE_200 = (245, 223, 180)
OCHRE_300 = (236, 197, 132)
OCHRE_BG = (58, 44, 22)

RAQM = ImageFont.Layout.RAQM


def font(family, weight, size):
    paths = {
        ("fraunces", 600): "fraunces/600SemiBold/Fraunces_600SemiBold.ttf",
        ("inter", 400): "inter/400Regular/Inter_400Regular.ttf",
        ("inter", 500): "inter/500Medium/Inter_500Medium.ttf",
        ("inter", 700): "inter/700Bold/Inter_700Bold.ttf",
        ("inter", 800): "inter/800ExtraBold/Inter_800ExtraBold.ttf",
        ("icons", 300): "material-symbols/300Light/MaterialSymbols_300Light.ttf",
        ("icons", 500): "material-symbols/500Medium/MaterialSymbols_500Medium.ttf",
    }
    return ImageFont.truetype(os.path.join(FONT_DIR, paths[(family, weight)]), size * S, layout_engine=RAQM)


def wrap(draw, text, fnt, width):
    lines, line = [], ""
    for word in text.split():
        test = (line + " " + word).strip()
        if draw.textlength(test, font=fnt) <= width:
            line = test
        else:
            if line:
                lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


def spaced(draw, xy, text, fnt, fill, tracking):
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += draw.textlength(ch, font=fnt) + tracking
    return x


PHOTO_H = 520 * S          # photo band height in overlay mode


def overlay_background():
    """Ink panel with a transparent band on top where the site photo goes."""
    im = Image.new("RGBA", (W, H), INK + (255,))
    alpha = Image.new("L", (W, H), 255)
    a = ImageDraw.Draw(alpha)
    fade_top, fade_end = PHOTO_H - 220 * S, PHOTO_H + 40 * S
    for y in range(0, fade_end):
        if y < fade_top:
            v = 0
        else:
            t = (y - fade_top) / (fade_end - fade_top)
            v = int(255 * (t ** 1.6))
        a.line((0, y, W, y), fill=v)
    # a light shade at the very top so the logo reads on any photo
    shade = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shade)
    for y in range(0, 260 * S):
        sd.line((0, y, W, y), fill=INK + (int(150 * (1 - y / (260 * S))),))
    im.putalpha(alpha)
    return Image.alpha_composite(im, shade)


def background(icon):
    if PHOTO:
        return overlay_background()
    im = Image.new("RGB", (W, H), INK)
    # soft light from the top right, like the cover
    glow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(glow).ellipse((W * 0.45, -H * 0.25, W * 1.35, H * 0.45), fill=110)
    glow = glow.filter(ImageFilter.GaussianBlur(160 * S))
    im = Image.composite(Image.new("RGB", (W, H), CELESTE_600), im, glow)
    # the section's icon, large and faint, bottom right
    mark = Image.new("L", (W, H), 0)
    f = font("icons", 300, 620)
    ImageDraw.Draw(mark).text((W - 560 * S, H - 700 * S), icon, font=f, fill=34)
    im = Image.composite(Image.new("RGB", (W, H), CELESTE_300), im, mark)
    return im


def header(d):
    m = 64 * S
    d.rounded_rectangle((PAD, PAD, PAD + m, PAD + m), radius=int(m * 9 / 30), fill=PAPER)
    rl = font("inter", 800, 23)
    w = d.textlength("RL", font=rl) + 1 * S
    l, t, r, b = d.textbbox((0, 0), "RL", font=rl)
    spaced(d, (PAD + (m - w) / 2, PAD + (m - (b - t)) / 2 - t), "RL", rl, INK, 1 * S)
    wm = font("fraunces", 600, 40)
    l, t, r, b = d.textbbox((0, 0), "RentLeaks", font=wm)
    d.text((PAD + m + 20 * S, PAD + (m - (b - t)) / 2 - t), "RentLeaks", font=wm, fill=PAPER)


FOOTER_TOP = H - PAD - 96 * S


def footer(d, url, left):
    y = FOOTER_TOP
    d.line((PAD, y, W - PAD, y), fill=(255, 255, 255, 40), width=2 * S)
    fu = font("inter", 700, 32)
    d.text((PAD, y + 26 * S), url, font=fu, fill=CELESTE_200)
    f = font("inter", 500, 23)
    d.text((W - PAD - d.textlength(left, font=f), y + 34 * S), left, font=f, fill=MUTED)


def place(im, layer, height, top=None):
    """Centre the content layer between the header (or photo) and the footer."""
    if top is None:
        top = (PHOTO_H - 40 * S) if PHOTO else 200 * S
    room = FOOTER_TOP - 40 * S - top
    y = top + max(0, (room - height) // 2)
    if im.mode == "RGBA":
        im.alpha_composite(layer.crop((0, 0, W, H - int(y))), dest=(0, int(y)))
    else:
        im.paste(layer, (0, int(y)), layer)


def kicker(d, y, icon, text):
    c = 76 * S
    d.ellipse((PAD, y, PAD + c, y + c), fill=CELESTE_600)
    fi = font("icons", 500, 46)
    l, t, r, b = d.textbbox((0, 0), icon, font=fi)
    d.text((PAD + (c - (r - l)) / 2 - l, y + (c - (b - t)) / 2 - t), icon, font=fi, fill=PAPER)
    fk = font("inter", 800, 24)
    l, t, r, b = d.textbbox((0, 0), text, font=fk)
    spaced(d, (PAD + c + 22 * S, y + (c - (b - t)) / 2 - t), text.upper(), fk, CELESTE_300, 3 * S)
    return y + c


def section_card(slug, icon, kick, title, sub, bullets, url, trend=None):
    im = background(icon)
    header(ImageDraw.Draw(im, "RGBA"))
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer, "RGBA")
    width = W - 2 * PAD

    y = kicker(d, 0, icon, kick) + (30 if PHOTO else 44) * S

    ft = font("fraunces", 600, 78 if PHOTO else 92)
    for line in wrap(d, title, ft, width):
        d.text((PAD, y), line, font=ft, fill=PAPER)
        y += (86 if PHOTO else 100) * S
    y += (22 if PHOTO else 34) * S

    if not PHOTO:
        fs = font("inter", 400, 34)
        for line in wrap(d, sub, fs, width - 40 * S):
            d.text((PAD, y), line, font=fs, fill=ON_DARK)
            y += 48 * S
        y += 34 * S

    fb = font("inter", 500, 32)
    fc = font("icons", 500, 38)
    for b in bullets:
        lines = wrap(d, b, fb, width - 64 * S)
        d.text((PAD, y - 2 * S), "check_circle", font=fc, fill=CELESTE_300)
        for line in lines:
            d.text((PAD + 60 * S, y), line, font=fb, fill=PAPER)
            y += 44 * S
        y += 14 * S
    y -= 14 * S

    if trend:
        stat, source = trend
        y += 22 * S
        fstat = font("inter", 700, 30)
        fsrc = font("inter", 500, 22)
        lines = wrap(d, stat, fstat, width - 150 * S)
        h = len(lines) * 42 * S + 78 * S
        d.rounded_rectangle((PAD, y, W - PAD, y + h), radius=22 * S, fill=OCHRE_BG + (235,))
        d.text((PAD + 32 * S, y + 30 * S), "trending_up", font=font("icons", 500, 52), fill=OCHRE_300)
        ty = y + 28 * S
        for line in lines:
            d.text((PAD + 110 * S, ty), line, font=fstat, fill=OCHRE_200)
            ty += 42 * S
        d.text((PAD + 110 * S, ty + 6 * S), "Source: " + source, font=fsrc, fill=OCHRE_300)
        y += h

    place(im, layer, y)
    footer(ImageDraw.Draw(im, "RGBA"), url, "All-in prices · Never pay before you view")
    save(im, slug)


def trend_card():
    im = background("trending_up")
    header(ImageDraw.Draw(im, "RGBA"))
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer, "RGBA")
    width = W - 2 * PAD
    y = kicker(d, 0, "location_city", "The new way to live in big cities") + 40 * S
    ft = font("fraunces", 600, 70 if PHOTO else 80)
    for line in wrap(d, "Big-city living is changing." if PHOTO else "Big-city living is changing. Fast.", ft, width):
        d.text((PAD, y), line, font=ft, fill=PAPER)
        y += (78 if PHOTO else 88) * S
    y += (22 if PHOTO else 30) * S

    tiles = [
        ("13 of 30", "top U.S. roommate markets hit record room rents in 2025", "SpareRoom", CELESTE_200),
        ("$1,484", "average monthly rent for a room in New York, Q4 2025", "SpareRoom", OCHRE_300),
        ("+136%", "U.S. stays of 28+ nights since 2019 — now 19% of demand", "Furnished Finder × AirDNA", CELESTE_200),
        ("9,000", "co-living homes open in the UK, 5,500 more being built", "Savills, 2025", CELESTE_200),
    ]
    gap = 20 * S
    tw = (width - gap) // 2
    th = (190 if PHOTO else 262) * S
    fn = font("fraunces", 600, 50 if PHOTO else 66)
    fl = font("inter", 500, 26)
    fsrc = font("inter", 500, 21)
    for i, (num, label, src, color) in enumerate(tiles):
        x0 = PAD + (i % 2) * (tw + gap)
        y0 = y + (i // 2) * (th + gap)
        d.rounded_rectangle((x0, y0, x0 + tw, y0 + th), radius=26 * S, fill=(8, 20, 25, 150), outline=(255, 255, 255, 40), width=2 * S)
        d.text((x0 + 30 * S, y0 + 20 * S), num, font=fn, fill=color)
        ly = y0 + (80 if PHOTO else 108) * S
        for line in wrap(d, label, fl, tw - 64 * S):
            d.text((x0 + 30 * S, ly), line, font=fl, fill=PAPER)
            ly += 36 * S
        d.text((x0 + 30 * S, y0 + th - (36 if PHOTO else 42) * S), src, font=fsrc, fill=MUTED)
    y += 2 * th + gap

    place(im, layer, y, top=(PHOTO_H - 60 * S) if PHOTO else None)
    footer(ImageDraw.Draw(im, "RGBA"), "rentleaks.com", "Rooms · Co-living · Furnished · 1-month+")
    save(im, "00-trend")


def save(im, slug):
    folder = os.path.join(OUT, "overlay") if PHOTO else OUT
    os.makedirs(folder, exist_ok=True)
    out = im.resize((W // S, H // S), Image.LANCZOS)
    path = os.path.join(folder, f"{slug}.png")
    out.save(path, optimize=True)
    print("wrote", os.path.relpath(path, ROOT))


SECTIONS = [
    ("01-rooms", "bed", "Rooms · from 30 days", "Your own door, split rent.",
     "A private bedroom in a shared home. Housemate profiles, private-bath filter, and vibe tags before you tour.",
     ["Housemates and house vibe, before you tour",
      "Filters: private bath, by owner, step-free, vouchers accepted",
      "All-in monthly rent — no teaser price"],
     "rentleaks.com/rooms",
     ("Room rents hit record highs in 13 of the top 30 U.S. roommate markets in 2025.", "SpareRoom, 2025")),
    ("02-coliving", "apartment", "Co-living · from 30 days", "Co-living, without the mystery.",
     "Designed buildings with community, cleaning, and flexible terms — not a mystery house share.",
     ["Availability shown room by room",
      "Cleaning, coworking and events listed up front",
      "One all-in monthly price"],
     "rentleaks.com/coliving",
     ("UK co-living: 9,000 homes open, 5,500 being built, planning applications +87% in a year.", "Savills, 2025")),
    ("03-furnished", "chair", "Furnished · from 30 days", "Move in with a suitcase.",
     "Furniture, kitchen, and workspace included. Furniture inventory on every listing.",
     ["Bed, desk and kitchen tools — listed",
      "Utilities and wifi inside the rent",
      "Relocations, contracts and trial moves"],
     "rentleaks.com/furnished",
     ("Monthly furnished rentals in large U.S. cities grew about 16% a year, 2023–2025.", "Furnished Finder × AirDNA")),
    ("04-one-month-plus", "calendar_month", "1-month+ · 30-day minimum", "Homes, not hotel nights.",
     "Mid-term apartments. Stay length is a first-class filter. Built for relos, contracts, and pilots.",
     ["Search by move-in and move-out dates",
      "Real apartments, never weekend stays",
      "Utilities and wifi in the all-in rent"],
     "rentleaks.com/short-term",
     ("U.S. stays of 28+ nights grew 136% since 2019 and are now 19% of rental demand.", "Furnished Finder × AirDNA, 2026")),
    ("05-aparthotel", "room_service", "Aparthotel · by the month", "Hotel service, monthly rent.",
     "Serviced apartments from hotel operators — housekeeping in, nightly rates out.",
     ["Housekeeping, linen and a front desk",
      "One monthly rate with utilities inside",
      "30-day minimum. No nightly bookings"],
     "rentleaks.com/aparthotel", None),
    ("06-lease-break", "key", "Lease-break · lease takeovers", "Leaving early? Someone wants your lease.",
     "Take over a remaining lease. See days left, assignment vs sublet.",
     ["Months left, on a Lease Clock",
      "Assignment or sublet, stated up front",
      "Posting a lease-break is free"],
     "rentleaks.com/lease-break", None),
    ("07-cities", "public", "Cities · U.S., Canada, Europe", "79 cities. Same rules everywhere.",
     "The U.S., Canada, the UK, Ireland, France, Spain, the Netherlands, Switzerland, Germany and Italy.",
     ["Each city split into rooms, co-living, furnished, 1-month+ and lease-breaks",
      "Prices in the local currency, all-in",
      "30-day minimum in every market"],
     "rentleaks.com/cities", None),
    ("08-operators", "storefront", "Operators · storefronts", "Know who you're renting from.",
     "Every operator has a boutique: their whole portfolio, response time and verification.",
     ["Co-living brands, portfolios and landlords",
      "Response time and verification shown",
      "Search by name, brand or city"],
     "rentleaks.com/operators", None),
]

# The site's own photos (Unsplash, as used on rentleaks.com) behind each post
# in --photo mode. The overlay PNGs leave the top band transparent; the photo
# is composited underneath (see marketing/facebook/posts/photos.json).
PHOTOS = {
    "00-trend": "photo-1449824913935-59a10b8d2000",
    "01-rooms": "photo-1522771739844-6a9f6d5f14af",
    "02-coliving": "photo-1536376072261-38c75010e6c9",
    "03-furnished": "photo-1540518614846-7eded433c457",
    "04-one-month-plus": "photo-1560185127-6ed189bf02f4",
    "05-aparthotel": "photo-1505693416388-ac5ce068fe85",
    "06-lease-break": "photo-1560448204-e02f11c3d0e2",
    "07-cities": "photo-1486406146926-c627a92ad1ab",
    "08-operators": "photo-1574362848149-11496d93a7c7",
}

PHOTO = "--photo" in sys.argv

if __name__ == "__main__":
    if PHOTO:
        import json
        with open(os.path.join(OUT, "photos.json"), "w") as fh:
            json.dump({"photoHeight": PHOTO_H // S, "width": W // S, "height": H // S,
                       "photos": {k: f"https://images.unsplash.com/{v}" for k, v in PHOTOS.items()}}, fh, indent=1)
    trend_card()
    for args in SECTIONS:
        section_card(*args)
