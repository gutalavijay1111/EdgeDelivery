#!/usr/bin/env python3
"""
Netflix-style poster generator v3 — emotion-aware typography + fixed layout.

For every input image, produces:
  1. <name>_thumbnail.jpg   600×900   (2:3)  — browse card
  2. <name>_background.jpg  1280×720  (16:9) — hero banner

KEY UPGRADES OVER v2
────────────────────
• Gemini classifies the image's EMOTION (horror / action / romance / scifi /
  fantasy / drama / mystery / comedy / western / thriller) and the script
  picks a matching font pairing + decorative motif for that mood.
• Accent color is extracted directly from the image's own pixels (k-means
  quantization), not guessed by the LLM — guaranteed to match the photo.
• ALL layout coordinates are HARDCODED constants (LAYOUT_THUMB / LAYOUT_BG)
  so every generated poster has pixel-identical placement — title, tagline,
  meta row, native subtitle, badge, and decorative motif always land in the
  same spot regardless of input image.
• A semi-opaque "legibility panel" sits behind every text block so text is
  ALWAYS readable, even on busy / bright source images.
• Title size auto-shrinks (within a defined range) to fit the fixed width
  without ever overflowing — but position never moves.

Usage:
    python netflix_poster_v3.py <image_path> [output_dir]

Requirements:
    pip install google-genai pillow
    export GOOGLE_API_KEY=your_key_here   (free: https://aistudio.google.com/apikey)

Fonts:
    Auto-downloaded on first run into ./fonts/ (from Google Fonts via
    raw.githubusercontent.com). If offline, falls back to system fonts.
"""

import sys, os, json, math, random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageEnhance, ImageFilter

# ════════════════════════════════════════════════════════════════════════════
#  CANVAS SIZES
# ════════════════════════════════════════════════════════════════════════════
THUMB_W, THUMB_H = 600, 900     # 2:3
BG_W,    BG_H    = 1280, 720    # 16:9

# ════════════════════════════════════════════════════════════════════════════
#  HARDCODED LAYOUT — every coordinate lives here. Change once, applies to
#  every poster ever generated. (x, y) = top-left anchor unless noted.
# ════════════════════════════════════════════════════════════════════════════

LAYOUT_THUMB = {
    "panel_top_y":      520,            # legibility panel starts here (→ bottom)
    "netflix_n":        (32, 24),
    "original_label":   (None, 32),     # x computed (right-aligned)
    "subtitle_native":  (36, 552),
    "title":            (34, 588),      # title block top-left
    "title_max_w":      530,            # px — auto-shrink title to fit
    "title_size_range": (54, 96),       # (min, max) px font size
    "divider":          (36, "after_title+14", 60),  # x, y(rel), width
    "tagline":          (36, "after_divider+14"),
    "tagline_size":     21,
    "tagline_max_w":    528,
    "meta":             (36, "after_tagline+14"),
    "meta_size":        13,
    "motif_zone":       (480, 40, 560, 200),  # x,y,w,h — top-right decoration
}

LAYOUT_BG = {
    "panel_rect":       (0, 0, 760, BG_H),   # left legibility panel
    "netflix_n":        (64, 40),
    "subtitle_native":  (66, 168),
    "title":            (64, 200),
    "title_max_w":      620,
    "title_size_range": (64, 116),
    "divider":          (66, "after_title+18", 70),
    "tagline":          (66, "after_divider+18"),
    "tagline_size":     24,
    "tagline_max_w":    580,
    "meta":             (66, "after_tagline+18"),
    "meta_size":        14,
    "badge":            (66, 600, 168, 46),  # x,y,w,h
    "motif_zone":       (820, 40, 420, 280), # decoration zone, right side
}

# ════════════════════════════════════════════════════════════════════════════
#  EMOTION → TYPOGRAPHY + MOTIF MAPPING
# ════════════════════════════════════════════════════════════════════════════
# Each emotion maps to:
#   title_font / tagline_font : font filenames (downloaded into ./fonts/)
#   title_tracking            : extra letter-spacing for title (px @ base size)
#   motif                     : decorative element drawn in motif_zone
#   panel_alpha                : darkness of legibility panel (0-255)

EMOTION_STYLES = {
    "horror": {
        "title_font": "Creepster-Regular.ttf",
        "tagline_font": "SpecialElite-Regular.ttf",
        "title_tracking": 2,
        "motif": "cracks",
        "panel_alpha": 248,
        "grain": True,
    },
    "thriller": {
        "title_font": "Staatliches-Regular.ttf",
        "tagline_font": "Oswald-Bold.ttf",
        "title_tracking": 4,
        "motif": "slash",
        "panel_alpha": 240,
        "grain": True,
    },
    "action": {
        "title_font": "Anton-Regular.ttf",
        "tagline_font": "Oswald-Bold.ttf",
        "title_tracking": 3,
        "motif": "slash",
        "panel_alpha": 230,
        "grain": False,
    },
    "scifi": {
        "title_font": "Orbitron-Bold.ttf",
        "tagline_font": "Oswald-Bold.ttf",
        "title_tracking": 6,
        "motif": "grid",
        "panel_alpha": 230,
        "grain": False,
    },
    "fantasy": {
        "title_font": "CinzelDecorative-Bold.ttf",
        "tagline_font": "PlayfairDisplay-Italic.ttf",
        "title_tracking": 3,
        "motif": "ornate",
        "panel_alpha": 220,
        "grain": False,
    },
    "romance": {
        "title_font": "DancingScript-Bold.ttf",
        "tagline_font": "EBGaramond-Italic.ttf",
        "title_tracking": 0,
        "motif": "glow",
        "panel_alpha": 210,
        "grain": False,
    },
    "drama": {
        "title_font": "PlayfairDisplay-Bold.ttf",
        "tagline_font": "EBGaramond-Italic.ttf",
        "title_tracking": 1,
        "motif": "line",
        "panel_alpha": 220,
        "grain": False,
    },
    "mystery": {
        "title_font": "PlayfairDisplay-Bold.ttf",
        "tagline_font": "SpecialElite-Regular.ttf",
        "title_tracking": 2,
        "motif": "fog",
        "panel_alpha": 235,
        "grain": True,
    },
    "comedy": {
        "title_font": "Bangers-Regular.ttf",
        "tagline_font": "Righteous-Regular.ttf",
        "title_tracking": 2,
        "motif": "pop",
        "panel_alpha": 210,
        "grain": False,
    },
    "western": {
        "title_font": "Rye-Regular.ttf",
        "tagline_font": "SpecialElite-Regular.ttf",
        "title_tracking": 1,
        "motif": "dust",
        "panel_alpha": 225,
        "grain": True,
    },
}
DEFAULT_EMOTION = "drama"

FONT_BASE_URL = "https://raw.githubusercontent.com/google/fonts/main"
FONT_SOURCES = {
    "Creepster-Regular.ttf":      f"{FONT_BASE_URL}/ofl/creepster/Creepster-Regular.ttf",
    "SpecialElite-Regular.ttf":   f"{FONT_BASE_URL}/apache/specialelite/SpecialElite-Regular.ttf",
    "Staatliches-Regular.ttf":    f"{FONT_BASE_URL}/ofl/staatliches/Staatliches-Regular.ttf",
    "Oswald-Bold.ttf":            f"{FONT_BASE_URL}/ofl/oswald/Oswald%5Bwght%5D.ttf",
    "Anton-Regular.ttf":          f"{FONT_BASE_URL}/ofl/anton/Anton-Regular.ttf",
    "Orbitron-Bold.ttf":          f"{FONT_BASE_URL}/ofl/orbitron/Orbitron%5Bwght%5D.ttf",
    "CinzelDecorative-Bold.ttf":  f"{FONT_BASE_URL}/ofl/cinzeldecorative/CinzelDecorative-Bold.ttf",
    "PlayfairDisplay-Italic.ttf": f"{FONT_BASE_URL}/ofl/playfairdisplay/PlayfairDisplay-Italic%5Bwght%5D.ttf",
    "PlayfairDisplay-Bold.ttf":   f"{FONT_BASE_URL}/ofl/playfairdisplay/PlayfairDisplay%5Bwght%5D.ttf",
    "DancingScript-Bold.ttf":     f"{FONT_BASE_URL}/ofl/dancingscript/DancingScript%5Bwght%5D.ttf",
    "EBGaramond-Italic.ttf":      f"{FONT_BASE_URL}/ofl/ebgaramond/EBGaramond-Italic%5Bwght%5D.ttf",
    "Bangers-Regular.ttf":        f"{FONT_BASE_URL}/ofl/bangers/Bangers-Regular.ttf",
    "Righteous-Regular.ttf":      f"{FONT_BASE_URL}/ofl/righteous/Righteous-Regular.ttf",
    "Rye-Regular.ttf":            f"{FONT_BASE_URL}/ofl/rye/Rye-Regular.ttf",
    "CJK":                        None,  # use system Noto Serif CJK
}

SYSTEM_FALLBACKS = {
    "sans":     ["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                  "/Library/Fonts/Arial.ttf", "C:/Windows/Fonts/arial.ttf"],
    "sansbold": ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
                  "/Library/Fonts/Arial Bold.ttf", "C:/Windows/Fonts/arialbd.ttf"],
    "serif":    ["/usr/share/fonts/truetype/google-fonts/Lora-Variable.ttf",
                  "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"],
    "cjk":      ["/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc",
                  "/System/Library/Fonts/PingFang.ttc"],
}

FONT_DIR = Path(os.environ.get("FONT_CACHE_DIR", "/tmp/edgedelivery_fonts"))
LOGO_PATH = Path(__file__).parent.parent / "assets" / "logo.png"


# ════════════════════════════════════════════════════════════════════════════
#  LOGO HELPER
# ════════════════════════════════════════════════════════════════════════════

def paste_logo(canvas, xy, max_height):
    """Paste assets/logo.png onto canvas at xy, scaled to max_height."""
    try:
        logo = Image.open(LOGO_PATH).convert("RGBA")
        scale = max_height / logo.height
        logo = logo.resize((int(logo.width * scale), max_height), Image.LANCZOS)
        canvas.paste(logo, xy, logo)
    except Exception:
        pass


# ════════════════════════════════════════════════════════════════════════════
#  FONT LOADING (auto-download + cache)
# ════════════════════════════════════════════════════════════════════════════

def ensure_font(filename: str) -> str | None:
    """Return a local path to `filename`.

    Resolution order:
      1. Local cache (FONT_DIR / filename) — avoids re-downloading on warm containers.
      2. S3 assets/fonts/ — fast private fetch when AWS_S3_BUCKET is set.
      3. Google Fonts CDN — fallback for local dev or if S3 is missing the file.
         On success the font is also uploaded to S3 so future containers skip step 3.
    """
    if filename == "CJK":
        for p in SYSTEM_FALLBACKS["cjk"]:
            if Path(p).exists():
                return p
        return None

    FONT_DIR.mkdir(parents=True, exist_ok=True)
    local = FONT_DIR / filename
    if local.exists() and local.stat().st_size > 1000:
        return str(local)

    s3_bucket = os.environ.get("AWS_S3_BUCKET")
    s3_key = f"assets/fonts/{filename}"
    s3_client = None

    if s3_bucket:
        try:
            import boto3
            s3_client = boto3.client("s3", region_name=os.environ.get("AWS_REGION", "ap-south-1"))
            s3_client.download_file(s3_bucket, s3_key, str(local))
            if local.exists() and local.stat().st_size > 1000:
                return str(local)
        except Exception:
            pass

    url = FONT_SOURCES.get(filename)
    if not url:
        return None

    try:
        import urllib.request
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        data = urllib.request.urlopen(req, timeout=15).read()
        if len(data) > 1000:
            local.write_bytes(data)
            if s3_client and s3_bucket:
                try:
                    s3_client.upload_file(str(local), s3_bucket, s3_key)
                except Exception:
                    pass
            return str(local)
    except Exception:
        pass
    return None


def load_font(filename_or_role: str, size: int) -> ImageFont.FreeTypeFont:
    """Load by emotion-font filename, or by generic role (sans/sansbold/serif/cjk)."""
    path = None
    if filename_or_role in FONT_SOURCES:
        path = ensure_font(filename_or_role)
    if not path and filename_or_role in SYSTEM_FALLBACKS:
        for p in SYSTEM_FALLBACKS[filename_or_role]:
            if Path(p).exists():
                path = p
                break
    if not path:
        # last-ditch generic fallback
        for p in SYSTEM_FALLBACKS["serif"]:
            if Path(p).exists():
                path = p
                break

    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()


# ════════════════════════════════════════════════════════════════════════════
#  GEOMETRY / TEXT HELPERS
# ════════════════════════════════════════════════════════════════════════════

def text_w(font, text, tracking=0):
    if not text:
        return 0
    bb = font.getbbox(text)
    base = bb[2] - bb[0]
    return base + tracking * max(0, len(text) - 1)


def text_h(font, text):
    bb = font.getbbox(text or "Ag")
    return bb[3] - bb[1]


def draw_tracked(draw, xy, text, font, fill, tracking=0, shadow=None):
    """Draw text letter-by-letter to support custom tracking + optional shadow."""
    x, y = xy
    for ch in text:
        if shadow:
            draw.text((x + shadow[0], y + shadow[1]), ch, font=font, fill=shadow[2])
        draw.text((x, y), ch, font=font, fill=fill)
        cw = font.getbbox(ch)[2] - font.getbbox(ch)[0]
        x += cw + tracking


def wrap_lines(text, font, max_px, tracking=0):
    words, lines, cur = text.split(), [], ""
    for w in words:
        test = (cur + " " + w).strip()
        if text_w(font, test, tracking) <= max_px:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def fit_title_size(text, font_path_key, max_w, size_range, tracking):
    """Binary-search-ish shrink: return (font, actual_w) that fits max_w."""
    lo, hi = size_range
    best = lo
    for size in range(hi, lo - 1, -2):
        f = load_font(font_path_key, size)
        w = text_w(f, text, tracking)
        if w <= max_w:
            best = size
            break
    else:
        best = lo
    f = load_font(font_path_key, best)
    return f, text_w(f, text, tracking)


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))


def rgb_hex(rgb):
    return "#%02x%02x%02x" % tuple(rgb)


def relative_luminance(rgb):
    r, g, b = [c / 255 for c in rgb]
    return 0.2126*r + 0.7152*g + 0.0722*b


# ════════════════════════════════════════════════════════════════════════════
#  PALETTE EXTRACTION (from the image itself — no LLM guessing)
# ════════════════════════════════════════════════════════════════════════════

def extract_accent_color(img: Image.Image) -> tuple:
    """Quantize the image and pick a vivid, mid-brightness color as accent."""
    small = img.convert("RGB").resize((120, 120))
    quant = small.quantize(colors=10, method=Image.MEDIANCUT)
    palette = quant.getpalette()[:30]   # 10 colors × 3
    counts = sorted(quant.getcolors(), reverse=True)

    candidates = []
    for count, idx in counts:
        r, g, b = palette[idx*3:idx*3+3]
        lum = relative_luminance((r, g, b))
        mx, mn = max(r, g, b), min(r, g, b)
        sat = 0 if mx == 0 else (mx - mn) / mx
        if 0.18 < lum < 0.85:
            candidates.append((sat, count, (r, g, b)))

    if not candidates:
        return (212, 168, 85)  # gold fallback

    total = sum(c[1] for c in candidates)
    if total == 0:
        return candidates[0][2]

    candidates.sort(key=lambda c: (c[0] * 0.7 + (c[1] / total) * 0.3), reverse=True)
    return candidates[0][2]


def boost_color(rgb, sat_boost=1.35, min_lum=0.45, max_lum=0.75):
    """Make a color punchier for use as a text/accent color."""
    r, g, b = [c / 255 for c in rgb]
    mx, mn = max(r, g, b), min(r, g, b)
    l = (mx + mn) / 2
    if mx != mn:
        d = mx - mn
        s = d / (2 - mx - mn) if l > 0.5 else d / (mx + mn)
    else:
        s = 0
    h = 0
    if mx == r: h = ((g-b)/d) % 6 if d else 0
    elif mx == g: h = (b-r)/d + 2 if d else 0
    elif mx == b: h = (r-g)/d + 4 if d else 0
    h *= 60

    s = min(1, s * sat_boost)
    l = max(min_lum, min(max_lum, l))

    c = (1 - abs(2*l - 1)) * s
    x = c * (1 - abs((h/60) % 2 - 1))
    m = l - c/2
    if   h < 60:  rp,gp,bp = c,x,0
    elif h < 120: rp,gp,bp = x,c,0
    elif h < 180: rp,gp,bp = 0,c,x
    elif h < 240: rp,gp,bp = 0,x,c
    elif h < 300: rp,gp,bp = x,0,c
    else:         rp,gp,bp = c,0,x
    return tuple(int((v+m)*255) for v in (rp,gp,bp))


# ════════════════════════════════════════════════════════════════════════════
#  GEMINI CONCEPT + EMOTION CLASSIFICATION
# ════════════════════════════════════════════════════════════════════════════

EMOTIONS_LIST = ", ".join(EMOTION_STYLES.keys())

PROMPT = f"""You are a Netflix creative director. Analyse this image — mood,
colors, subject, lighting, atmosphere — and invent an original Netflix
movie/series concept that fits it perfectly.

Return ONLY valid JSON, no markdown, no fences:
{{
  "title_line1": "Bold first title line (1-3 words)",
  "title_line2": "Lighter second line (1-3 words, or empty string)",
  "subtitle_native": "Short non-English subtitle matching the mood (or empty string)",
  "tagline": "One punchy sentence, max 12 words",
  "genre_tags": ["Genre1", "Genre2"],
  "year": "2025",
  "episodes": "8 Episodes",
  "emotion": "ONE of: {EMOTIONS_LIST}",
  "concept_note": "One sentence story concept"
}}

The "emotion" field is critical — pick the single best match for the image's
dominant feeling, since it drives the poster's typography and design."""


def get_concept(image_path: str) -> dict:
    import google.genai as genai
    from google.genai import types

    key = os.environ.get("GOOGLE_API_KEY")
    if not key:
        print("Error: GOOGLE_API_KEY not set.")
        print("Get a free key: https://aistudio.google.com/apikey")
        sys.exit(1)

    client = genai.Client(api_key=key)
    ext = Path(image_path).suffix.lower()
    mime = {".jpg": "image/jpeg", ".jpeg": "image/jpeg",
            ".png": "image/png", ".webp": "image/webp"}.get(ext, "image/jpeg")

    data = Path(image_path).read_bytes()
    contents = [
        types.Part.from_bytes(data=data, mime_type=mime),
        types.Part.from_text(text=PROMPT),
    ]

    MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash",
              "gemini-2.0-flash-lite", "gemini-2.0-flash"]

    for model in MODELS:
        try:
            print(f"    Trying {model}...")
            r = client.models.generate_content(model=model, contents=contents)
            print(f"    ✓ {model}")
            raw = r.text.strip()
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            concept = json.loads(raw.strip())
            if concept.get("emotion") not in EMOTION_STYLES:
                concept["emotion"] = DEFAULT_EMOTION
            return concept
        except Exception as e:
            err = str(e)
            if any(x in err for x in ["429", "RESOURCE_EXHAUSTED", "quota", "NOT_FOUND", "404"]):
                print(f"    ✗ {model}: {err[:60]}")
                continue
            raise

    print("All Gemini models unavailable. Check quota or billing.")
    sys.exit(1)


# ════════════════════════════════════════════════════════════════════════════
#  IMAGE PREP — crop / grade / vignette
# ════════════════════════════════════════════════════════════════════════════

def smart_crop(img, tw, th):
    img = img.convert("RGBA")
    iw, ih = img.size
    tr, cr = tw/th, iw/ih
    if cr > tr:
        nw = int(ih * tr)
        x = (iw - nw)//2
        img = img.crop((x, 0, x+nw, ih))
    else:
        nh = int(iw / tr)
        y = max(0, min((ih-nh)//5, ih-nh))
        img = img.crop((0, y, iw, y+nh))
    return img.resize((tw, th), Image.LANCZOS)


def grade(img, brightness=0.6, color=0.85, contrast=1.1):
    img = ImageEnhance.Brightness(img).enhance(brightness)
    img = ImageEnhance.Color(img).enhance(color)
    img = ImageEnhance.Contrast(img).enhance(contrast)
    return img


def add_grain(img, intensity=18):
    """Add subtle film-grain noise — used for horror/thriller/mystery/western."""
    import random as _r
    w, h = img.size
    noise = Image.effect_noise((w, h), intensity).convert("L")
    noise_rgba = Image.merge("RGBA", (noise, noise, noise, Image.new("L", (w,h), 35)))
    return Image.alpha_composite(img, noise_rgba)


def panel_gradient_thumb(size, panel_top_y, alpha):
    W, H = size
    layer = Image.new("RGBA", size, (0,0,0,0))
    d = ImageDraw.Draw(layer)
    fade = 90
    for y in range(H):
        if y < panel_top_y - fade:
            a = 0
        elif y < panel_top_y:
            a = int(alpha * (y-(panel_top_y-fade))/fade)
        else:
            a = 185  # semi-opaque below panel line — softer look while keeping text readable
        d.line([(0,y),(W,y)], fill=(0,0,0,min(a,255)))
    return layer


def panel_gradient_bg(size, panel_rect, alpha):
    W, H = size
    px, py, pw, ph = panel_rect
    layer = Image.new("RGBA", size, (0,0,0,0))
    d = ImageDraw.Draw(layer)
    fade = 160
    for x in range(W):
        if x < pw - fade:
            a = 185            # semi-opaque text zone — softer look while keeping text readable
        elif x < pw + fade:
            t = (x-(pw-fade))/(2*fade)
            a = int(255 * (1 - t) + alpha * 0.15 * t)
        else:
            a = int(alpha * 0.10)   # faint global tint over the image
        a = max(0, min(255, a))
        d.line([(x,0),(x,H)], fill=(0,0,0,a))
    # extra bottom fade across whole frame (helps badge legibility)
    for y in range(H):
        t = y/H
        if t > 0.72:
            a2 = int(160 * ((t-0.72)/0.28)**1.3)
            for x in range(W):
                cur = layer.getpixel((x,y))[3]
                layer.putpixel((x,y), (0,0,0, min(255, cur+a2)))
    return layer


# ════════════════════════════════════════════════════════════════════════════
#  DECORATIVE MOTIFS (emotion-driven artwork)
# ════════════════════════════════════════════════════════════════════════════

def draw_motif(draw, motif, zone, accent, scale=1.0, seed=0):
    """Draw a small decorative element inside `zone` = (x,y,w,h)."""
    x, y, w, h = zone
    rnd = random.Random(seed)
    a = (*accent, 200)
    a_soft = (*accent, 90)

    if motif == "cracks":
        # jagged lightning-bolt style crack lines
        for i in range(3):
            px, py = x + rnd.randint(0,w), y
            pts = [(px,py)]
            for _ in range(6):
                px += rnd.randint(-18,18) * scale
                py += h//6
                pts.append((px,py))
            draw.line(pts, fill=(255,255,255,70), width=max(1,int(2*scale)))

    elif motif == "slash":
        # diagonal accent stripe
        lw = max(4, int(10*scale))
        draw.line([(x, y+h), (x+w, y)], fill=a, width=lw)
        draw.line([(x+int(18*scale), y+h), (x+w+int(18*scale), y)], fill=(255,255,255,40), width=max(1,int(3*scale)))

    elif motif == "grid":
        step = max(14, int(28*scale))
        for gx in range(x, x+w, step):
            draw.line([(gx,y),(gx,y+h)], fill=(*accent,55))
        for gy in range(y, y+h, step):
            draw.line([(x,gy),(x+w,gy)], fill=(*accent,55))
        # corner bracket accents
        bl = int(28*scale)
        draw.line([(x,y),(x+bl,y)], fill=a, width=3)
        draw.line([(x,y),(x,y+bl)], fill=a, width=3)
        draw.line([(x+w,y+h),(x+w-bl,y+h)], fill=a, width=3)
        draw.line([(x+w,y+h),(x+w,y+h-bl)], fill=a, width=3)

    elif motif == "ornate":
        # corner flourish — simple nested L-frames in gold
        for off, al in [(0,210),(10,120)]:
            ln = int(70*scale)
            draw.line([(x+off,y+off+ln),(x+off,y+off),(x+off+ln,y+off)],
                      fill=(*accent, al), width=2)
            draw.line([(x+w-off,y+h-off-ln),(x+w-off,y+h-off),(x+w-off-ln,y+h-off)],
                      fill=(*accent, al), width=2)

    elif motif == "glow":
        # soft radial glow blob — clipped to canvas bounds
        img = draw._image
        cw, ch = img.size
        x2, y2 = min(x+w, cw), min(y+h, ch)
        x, y = max(0,x), max(0,y)
        bw, bh = x2-x, y2-y
        if bw <= 0 or bh <= 0:
            return
        glow = Image.new("RGBA", (bw,bh), (0,0,0,0))
        gd = ImageDraw.Draw(glow)
        cx, cy, r = bw//2, bh//2, min(bw,bh)//2
        for i in range(r,0,-2):
            al = int(70 * (1 - i/r))
            gd.ellipse([cx-i,cy-i,cx+i,cy+i], fill=(*accent, al))
        glow = glow.filter(ImageFilter.GaussianBlur(18))
        region = img.crop((x,y,x2,y2)).convert("RGBA")
        img.paste(Image.alpha_composite(region, glow), (x,y))

    elif motif == "line":
        # single elegant horizontal accent line + small diamond
        cy = y + h//2
        draw.line([(x, cy),(x+w-20, cy)], fill=a, width=2)
        d2 = 6
        draw.polygon([(x+w-20-d2,cy),(x+w-20,cy-d2),(x+w-20+d2,cy),(x+w-20,cy+d2)], fill=a)

    elif motif == "fog":
        img = draw._image
        cw, ch = img.size
        x2, y2 = min(x+w, cw), min(y+h, ch)
        x, y = max(0,x), max(0,y)
        bw, bh = x2-x, y2-y
        if bw <= 0 or bh <= 0:
            return
        fog = Image.new("RGBA",(bw,bh),(0,0,0,0))
        fd = ImageDraw.Draw(fog)
        for i in range(3):
            cx = rnd.randint(0,bw); cy = rnd.randint(0,bh); r = rnd.randint(max(1,bh//2),max(2,int(bh*1.3)))
            fd.ellipse([cx-r,cy-r,cx+r,cy+r], fill=(255,255,255,8))
        fog = fog.filter(ImageFilter.GaussianBlur(60))
        region = img.crop((x,y,x2,y2)).convert("RGBA")
        img.paste(Image.alpha_composite(region, fog), (x,y))

    elif motif == "pop":
        # comic halftone dots in corner
        step = max(10, int(16*scale))
        for gy in range(y, y+h, step):
            for gx in range(x, x+w, step):
                rr = max(1,int(3*scale))
                draw.ellipse([gx,gy,gx+rr,gy+rr], fill=(*accent,90))

    elif motif == "dust":
        for _ in range(40):
            px = rnd.randint(x,x+w); py = rnd.randint(y,y+h)
            r = rnd.randint(1,3)
            draw.ellipse([px,py,px+r,py+r], fill=(*accent,60))


# ════════════════════════════════════════════════════════════════════════════
#  CORE TEXT-BLOCK RENDERER (shared layout logic)
# ════════════════════════════════════════════════════════════════════════════

def render_text_block(draw, layout, concept, style, accent, base_w):
    """Draws title/subtitle/tagline/meta using hardcoded layout coords.
    Returns nothing — mutates `draw` in place. `base_w` used for scale."""

    scale = base_w / 1280.0  # normalize against background width baseline
    tracking_title = style["title_tracking"]

    t1 = concept.get("title_line1","UNTITLED")
    t2 = concept.get("title_line2","")
    native = concept.get("subtitle_native","")
    tagline = concept.get("tagline","")
    meta = "  ·  ".join(
        concept.get("genre_tags",["Drama"]) +
        [p for p in [concept.get("year",""), concept.get("episodes","")] if p]
    )

    accent_bright = boost_color(accent)

    # ── Native subtitle ─────────────────────────────────────────────────────
    nx, ny = layout["subtitle_native"]
    if native:
        f_cjk = load_font("CJK", int(18*scale))
        draw.text((nx, ny), native, font=f_cjk, fill=(225,225,225,170))

    # ── Title (auto-fit, tracked) ───────────────────────────────────────────
    tx, ty = layout["title"]
    max_w = layout["title_max_w"]
    lo, hi = layout["title_size_range"]

    f_title, w1 = fit_title_size(t1, style["title_font"], max_w, (lo,hi), tracking_title)
    draw_tracked(draw, (tx, ty), t1, f_title, (255,255,255,255),
                  tracking=tracking_title, shadow=(3,4,(0,0,0,150)))
    cursor_y = ty + text_h(f_title, t1)

    last_title_size = lo
    if t2:
        f2, w2 = fit_title_size(t2, style["title_font"], max_w, (max(lo-8,28),hi-6), tracking_title)
        last_title_size = f2.size
        cursor_y += int(f2.size * 0.12)
        draw_tracked(draw, (tx, cursor_y), t2, f2, accent_bright,
                      tracking=tracking_title, shadow=(2,3,(0,0,0,140)))
        cursor_y += text_h(f2, t2)
    else:
        last_title_size = f_title.size

    # ── Divider — gap scales with title size ─────────────────────────────────
    div_x, div_y_spec, div_w = layout["divider"]
    gap1 = max(20, int(last_title_size * 0.30))
    div_y = cursor_y + gap1
    draw.rectangle([(div_x,div_y),(div_x+div_w,div_y+3)], fill=(*accent_bright,235))
    cursor_y = div_y + 3

    # ── Tagline ──────────────────────────────────────────────────────────────
    f_tag = load_font(style["tagline_font"], layout["tagline_size"])
    lines = wrap_lines(tagline, f_tag, layout["tagline_max_w"])
    gap2 = max(18, int(last_title_size * 0.20))
    cursor_y += gap2
    for line in lines:
        draw.text((layout["tagline"][0], cursor_y), line, font=f_tag,
                  fill=(225,225,225,235))
        cursor_y += int(layout["tagline_size"]*1.35)

    # ── Meta row ─────────────────────────────────────────────────────────────
    f_meta = load_font("sans", layout["meta_size"])
    cursor_y += 14
    draw.text((layout["meta"][0], cursor_y), meta, font=f_meta, fill=(165,165,165,200))


# ════════════════════════════════════════════════════════════════════════════
#  THUMBNAIL RENDER (600×900)
# ════════════════════════════════════════════════════════════════════════════

def render_thumbnail(img_path, concept, accent, style, out_path):
    L = LAYOUT_THUMB
    base = smart_crop(Image.open(img_path), THUMB_W, THUMB_H)
    base = grade(base, brightness=0.72)
    if style["grain"]:
        base = add_grain(base, 14)

    panel = panel_gradient_thumb((THUMB_W,THUMB_H), L["panel_top_y"], style["panel_alpha"])
    base = Image.alpha_composite(base, panel)

    canvas = Image.new("RGBA", (THUMB_W,THUMB_H), (0,0,0,0))
    draw = ImageDraw.Draw(canvas)
    draw._image = canvas  # for motifs that need to paste blurred layers

    accent_bright = boost_color(accent)

    # Brand logo (top-left)
    paste_logo(canvas, L["netflix_n"], 44)

    # Decorative motif (top-right zone)
    draw_motif(draw, style["motif"], L["motif_zone"], accent_bright, scale=0.6, seed=hash(img_path)%1000)

    # Text block
    render_text_block(draw, L, concept, style, accent, base_w=THUMB_W*(1280/600))

    # Right edge accent bar
    bx = THUMB_W-16
    draw.rectangle([(bx,THUMB_H//3),(bx+2,THUMB_H*2//3)], fill=(*accent_bright,80))

    out = Image.alpha_composite(base, canvas).convert("RGB")
    out.save(out_path, quality=95)
    print(f"  ✓ Thumbnail  → {out_path}  ({THUMB_W}×{THUMB_H})")


# ════════════════════════════════════════════════════════════════════════════
#  BACKGROUND RENDER (1280×720)
# ════════════════════════════════════════════════════════════════════════════

def render_background(img_path, concept, accent, style, out_path):
    L = LAYOUT_BG
    base = smart_crop(Image.open(img_path), BG_W, BG_H)
    base = grade(base, brightness=0.75)
    if style["grain"]:
        base = add_grain(base, 14)

    panel = panel_gradient_bg((BG_W,BG_H), L["panel_rect"], style["panel_alpha"])
    base = Image.alpha_composite(base, panel)

    canvas = Image.new("RGBA", (BG_W,BG_H), (0,0,0,0))
    draw = ImageDraw.Draw(canvas)
    draw._image = canvas

    accent_bright = boost_color(accent)

    # Brand logo (top-left)
    paste_logo(canvas, L["netflix_n"], 54)

    # Decorative motif (right-side zone, away from text panel)
    draw_motif(draw, style["motif"], L["motif_zone"], accent_bright, scale=1.0, seed=hash(img_path)%1000)

    # Text block
    render_text_block(draw, L, concept, style, accent, base_w=BG_W)

    out = Image.alpha_composite(base, canvas).convert("RGB")
    out.save(out_path, quality=95)
    print(f"  ✓ Background → {out_path}  ({BG_W}×{BG_H})")


# ════════════════════════════════════════════════════════════════════════════
#  MAIN
# ════════════════════════════════════════════════════════════════════════════

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    image_path = sys.argv[1]
    if not Path(image_path).exists():
        print(f"Error: file not found — {image_path}")
        sys.exit(1)

    out_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(image_path).parent
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = Path(image_path).stem

    print("🎬  Analysing image with Gemini...")
    concept = get_concept(image_path)

    emotion = concept.get("emotion", DEFAULT_EMOTION)
    style = EMOTION_STYLES.get(emotion, EMOTION_STYLES[DEFAULT_EMOTION])

    src_img = Image.open(image_path)
    accent = extract_accent_color(src_img)

    print(f"\n📋  Concept:")
    print(f"    Title    : {concept['title_line1']} {concept.get('title_line2','')}")
    print(f"    Tagline  : {concept.get('tagline','')}")
    print(f"    Emotion  : {emotion}  → fonts: {style['title_font']} / {style['tagline_font']}")
    print(f"    Accent   : {rgb_hex(accent)} (from image palette)")
    print(f"    Story    : {concept.get('concept_note','')}")

    print("\n🔤  Preparing fonts...")
    ensure_font(style["title_font"])
    ensure_font(style["tagline_font"])

    print("\n🖼️   Rendering posters...")
    render_thumbnail(image_path,  concept, accent, style, str(out_dir / f"{stem}_thumbnail.jpg"))
    render_background(image_path, concept, accent, style, str(out_dir / f"{stem}_background.jpg"))

    print("\n✨  Done.")


if __name__ == "__main__":
    main()