from pathlib import Path
from PIL import Image, ImageChops, ImageEnhance, ImageFilter, ImageOps, ImageDraw, ImageFont
import json, math, random, shutil

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'source'
CARDS = ROOT / 'cards'
W, H = 1024, 1536
random.seed(1983)

def card_config(index, title):
    return {
        'title': title,
        'subtitle': 'HAWKINS PHOTO ARCHIVE',
        'technique': '闪光显影',
        'tagline': '一张照片，一段记忆。',
        'edition': f'{index:02d} / 05',
        'collection': '颠倒世界 / 个人全息典藏',
        'description': '单张照片制作的可交互 3D 全息收藏卡，包含独立 Blender 工程。',
        'font': 'C:/Windows/Fonts/msyhbd.ttc',
        'assets': {
            'model': './assets/card.glb',
            'subject': './assets/subject.png',
            'background': './assets/background.png',
            'text': './assets/text.png',
            'lineart': './assets/lineart.png',
            'effects': './assets/effects.png'
        },
        'parameters': {
            'subjectScale': 1.12,
            'subjectDepth': 0.18,
            'backgroundDepth': -0.26,
            'effectsScale': 1.04,
            'effectsDepth': 0.54,
            'foil': 0.78
        },
        'safeArea': {'scale': 1.12, 'offset': [-0.05, -0.07]}
    }

def make_alpha_mask(size):
    mask = Image.new('L', size, 0)
    cx, cy = size[0] / 2, size[1] / 2
    rx, ry = size[0] * .47, size[1] * .45
    pix = mask.load()
    for y in range(size[1]):
        ny = (y - cy) / ry
        for x in range(size[0]):
            nx = (x - cx) / rx
            d = math.sqrt(nx * nx + ny * ny)
            pix[x, y] = 0 if d >= 1 else round(255 * (1 - d) ** .34)
    return mask

def make_subject_mask(size, index):
    """Keep the photo subject on a narrow, feathered central plane."""
    mask = Image.new('L', size, 0)
    cx, cy = size[0] * 0.5, size[1] * (0.51 if index != 5 else 0.53)
    rx = size[0] * (0.30 if index in (4, 5) else 0.38)
    ry = size[1] * (0.39 if index == 4 else 0.42)
    pix = mask.load()
    for y in range(size[1]):
        ny = (y - cy) / ry
        for x in range(size[0]):
            nx = (x - cx) / rx
            d = math.sqrt(nx * nx + ny * ny)
            pix[x, y] = 0 if d >= 1 else round(255 * (1 - d) ** 0.52)
    strength = 0.42 if index in (4, 5) else 0.5
    return mask.point(lambda p: 255 if p > 245 else round(p * strength))

def _extract_reference_layers():
    vines_ref = Image.open(ROOT / 'references' / 'vines.jpg').convert('RGB')
    vines_crop = vines_ref.crop((110, 0, 850, 1460)).resize((250, 980), Image.Resampling.LANCZOS)
    vine_gray = ImageOps.grayscale(vines_crop)
    vine_alpha = vine_gray.point(lambda p: max(0, min(255, round((155 - p) * 2.45))))
    vine_alpha = ImageEnhance.Contrast(vine_alpha).enhance(1.45)
    vine_rgb = ImageEnhance.Color(vines_crop).enhance(.28)
    vine_rgb = ImageEnhance.Brightness(vine_rgb).enhance(.72)
    vines = vine_rgb.convert('RGBA')
    vines.putalpha(vine_alpha)
    red_alpha = vine_alpha.point(lambda p: round(p * .26))
    red = Image.new('RGBA', vines.size, (172, 18, 30, 0))
    red.putalpha(red_alpha)
    vines.alpha_composite(red)

    lights_ref = Image.open(ROOT / 'references' / 'lights.jpg').convert('RGB')
    lights_crop = lights_ref.crop((0, 0, lights_ref.width, min(lights_ref.height, 650))).resize((1024, 280), Image.Resampling.LANCZOS)
    lights = Image.new('RGBA', lights_crop.size, (0, 0, 0, 0))
    src = lights_crop.load()
    dst = lights.load()
    for y in range(lights_crop.height):
        for x in range(lights_crop.width):
            r, g, b = src[x, y]
            bright = max(r, g, b)
            saturation = bright - min(r, g, b)
            if (bright > 112 and saturation > 42) or (bright > 205 and saturation > 12):
                alpha = min(255, round((bright - 72) * 1.55 + saturation * .55))
                dst[x, y] = (r, g, b, alpha)
    return vines, lights

REFERENCE_VINES, REFERENCE_LIGHTS = _extract_reference_layers()

def add_stranger_decor(effects, index):
    vines = REFERENCE_VINES
    lights = REFERENCE_LIGHTS
    shift = (index - 1) * 7

    left_vines = Image.new('RGBA', effects.size, (0, 0, 0, 0))
    right_vines = Image.new('RGBA', effects.size, (0, 0, 0, 0))
    left_vines.alpha_composite(vines, (-70, 280 + shift))
    right_vines.alpha_composite(ImageOps.mirror(vines), (W - vines.width + 70, 310 - shift))
    effects.alpha_composite(left_vines)
    effects.alpha_composite(right_vines)

    top_lights = Image.new('RGBA', effects.size, (0, 0, 0, 0))
    top_lights.alpha_composite(lights, (0, -24))
    effects.alpha_composite(top_lights)

    lower_lights = Image.new('RGBA', effects.size, (0, 0, 0, 0))
    lower_lights.alpha_composite(ImageOps.mirror(lights), (0, H - 270 + (index % 3) * 12))
    effects.alpha_composite(lower_lights)
for i in range(1, 6):
    project = CARDS / f'card-{i:02d}'
    assets = project / 'assets'
    assets.mkdir(parents=True, exist_ok=True)
    src = Image.open(SOURCE / f'{i:02d}.jpg').convert('RGB')

    background = ImageOps.fit(src, (W, H), method=Image.Resampling.LANCZOS, centering=(.5, .47))
    background = ImageEnhance.Color(background).enhance(.78)
    background = ImageEnhance.Contrast(background).enhance(1.14)
    background = ImageEnhance.Brightness(background).enhance(.72)
    background.save(assets / 'background.png', optimize=True)

    # Use the same graded pixels as the background so the layer disappears cleanly at rest.
    subject = background.convert('RGBA')
    subject.putalpha(make_subject_mask((W, H), i))
    subject.save(assets / 'subject.png', optimize=True)

    gray = ImageOps.grayscale(background)
    edges = gray.filter(ImageFilter.FIND_EDGES)
    edges = ImageEnhance.Contrast(edges).enhance(2.1)
    lineart = ImageOps.invert(edges).convert('RGB')
    lineart.save(assets / 'lineart.png', optimize=True)

    effects = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(effects)
    for _ in range(56):
        x = random.randint(12, W - 12)
        y = random.randint(24, H - 24)
        r = random.choice([2, 2, 3, 4, 6])
        color = random.choice([(255, 53, 64, 225), (106, 219, 237, 205), (255, 228, 154, 170), (255, 255, 255, 190)])
        draw.ellipse((x-r, y-r, x+r, y+r), fill=color)
    for _ in range(8):
        x = random.randint(0, W)
        y = random.randint(70, H - 120)
        length = random.randint(35, 145)
        draw.line((x, y, x + random.randint(-24, 24), y + length), fill=(255, 52, 64, 105), width=random.choice([1, 2]))
    add_stranger_decor(effects, i)
    effects = effects.point(lambda p: round(p * .58))
    effects = effects.filter(ImageFilter.GaussianBlur(.25))
    effects.save(assets / 'effects.png', optimize=True)

    # No typography on the card itself: only a thin holographic frame.
    text_layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    td = ImageDraw.Draw(text_layer)



    td.rectangle((38, 38, 78, 78), fill=(255, 255, 255, 240))
    td.rectangle((W - 78, H - 78, W - 38, H - 38), fill=(255, 255, 255, 240))
    text_layer.save(assets / 'text.png', optimize=True)

    (project / 'card-config.json').write_text(json.dumps(card_config(i, f'卡片 {i:02d}'), ensure_ascii=False, indent=2), encoding='utf8')
    tools = project / 'tools'
    tools.mkdir(exist_ok=True)
    shutil.copy2(ROOT / 'tools' / 'build_card.py', tools / 'build_card.py')
    shutil.copy2(ROOT / 'tools' / 'export_web.py', tools / 'export_web.py')
    print('PREPARED', project)
