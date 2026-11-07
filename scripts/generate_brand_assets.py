import os
import shutil
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

SOURCE_IMAGE_PATH = 'C:/Users/Pradeep/.gemini/antigravity/brain/4cd22bfa-1127-43f7-b062-e02166a2848c/.user_uploaded/media_1794076609836_256a621f.jpg'
BRAND_DIR = 'public/brand'
PUBLIC_DIR = 'public'
RES_DIR = 'android/app/src/main/res'

os.makedirs(BRAND_DIR, exist_ok=True)
os.makedirs('scripts', exist_ok=True)

print(f'Loading master logo: {SOURCE_IMAGE_PATH}')
master_img = Image.open(SOURCE_IMAGE_PATH).convert('RGB')
W, H = master_img.size
assert (W, H) == (1024, 1024), f'Expected 1024x1024, got {master_img.size}'

# -------------------------------------------------------------
# 1. EXTRACT CENTERED SYMBOL EMBLEM (Colorful C + Viewfinder + Star)
# -------------------------------------------------------------
# Symbol is centered at X=512, Y=419.
# Crop square of 460x460: X in [282, 742], Y in [190, 650]
# This isolates the brackets, glowing ribbon C, and sparkle star cleanly without the text.
emblem_crop = master_img.crop((282, 190, 742, 650))

# Create a 512x512 centered version on master-matching dark background
symbol_512 = Image.new('RGB', (512, 512), (9, 7, 10))
# Sample and apply subtle radial background from master corners
bg_sample = master_img.crop((256, 163, 768, 675)).resize((512, 512), Image.Resampling.LANCZOS)
symbol_512.paste(bg_sample, (0, 0))
# Center the emblem inside the 512x512
offset = ((512 - 460) // 2, (512 - 460) // 2)
symbol_512.paste(emblem_crop, offset)

# Save dark symbol
symbol_512.save(os.path.join(BRAND_DIR, 'chroma-logo-symbol.png'), 'PNG', optimize=True)
print('Saved chroma-logo-symbol.png')

# -------------------------------------------------------------
# 2. CREATE TRANSPARENT ALPHA VERSIONS (Symbol & Full Logo)
# -------------------------------------------------------------
def make_transparent(source_rgb, low_thresh=26.0, high_thresh=78.0, gamma=1.2):
    arr = np.array(source_rgb, dtype=np.float32)
    max_c = arr.max(axis=2)
    alpha = np.zeros_like(max_c)
    mask_mid = (max_c >= low_thresh) & (max_c < high_thresh)
    alpha[mask_mid] = ((max_c[mask_mid] - low_thresh) / (high_thresh - low_thresh)) ** gamma * 255.0
    alpha[max_c >= high_thresh] = 255.0
    
    # De-multiply dark background so color vibrancy stays luminous
    alpha_norm = np.clip(alpha / 255.0, 0.001, 1.0)[:, :, np.newaxis]
    unblackened = np.clip(arr / alpha_norm, 0, 255)
    
    rgba = np.dstack([unblackened.astype(np.uint8), alpha.astype(np.uint8)])
    return Image.fromarray(rgba, 'RGBA')

symbol_transparent = make_transparent(symbol_512)
symbol_transparent.save(os.path.join(BRAND_DIR, 'chroma-logo-symbol-transparent.png'), 'PNG', optimize=True)
print('Saved chroma-logo-symbol-transparent.png')

full_transparent = make_transparent(master_img, low_thresh=28.0, high_thresh=85.0, gamma=1.25)
full_transparent.save(os.path.join(BRAND_DIR, 'chroma-logo-full-transparent.png'), 'PNG', optimize=True)
print('Saved chroma-logo-full-transparent.png')

# Save 1024x1024 master full logo
master_img.save(os.path.join(BRAND_DIR, 'chroma-logo-full.png'), 'PNG', optimize=True)
print('Saved chroma-logo-full.png')

# -------------------------------------------------------------
# 3. PWA ICONS & FAVICONS
# -------------------------------------------------------------
# 192x192 PWA Icon
pwa_192 = symbol_512.resize((192, 192), Image.Resampling.LANCZOS)
pwa_192.save(os.path.join(BRAND_DIR, 'pwa-192x192.png'), 'PNG', optimize=True)
pwa_192.save(os.path.join(PUBLIC_DIR, 'pwa-192x192.png'), 'PNG', optimize=True)

# 512x512 PWA Icon
symbol_512.save(os.path.join(BRAND_DIR, 'pwa-512x512.png'), 'PNG', optimize=True)
symbol_512.save(os.path.join(PUBLIC_DIR, 'pwa-512x512.png'), 'PNG', optimize=True)

# 180x180 Apple Touch Icon
apple_icon = symbol_512.resize((180, 180), Image.Resampling.LANCZOS)
apple_icon.save(os.path.join(BRAND_DIR, 'apple-touch-icon.png'), 'PNG', optimize=True)
apple_icon.save(os.path.join(PUBLIC_DIR, 'apple-touch-icon.png'), 'PNG', optimize=True)

# Favicons (ICO and PNG)
fav_16 = symbol_512.resize((16, 16), Image.Resampling.LANCZOS)
fav_32 = symbol_512.resize((32, 32), Image.Resampling.LANCZOS)
fav_48 = symbol_512.resize((48, 48), Image.Resampling.LANCZOS)
fav_64 = symbol_512.resize((64, 64), Image.Resampling.LANCZOS)

fav_48.save(os.path.join(BRAND_DIR, 'chroma-favicon.png'), 'PNG', optimize=True)
symbol_512.save(
    os.path.join(PUBLIC_DIR, 'favicon.ico'),
    format='ICO',
    sizes=[(16, 16), (32, 32), (48, 48)]
)
print('Saved PWA icons and favicon.ico')

# -------------------------------------------------------------
# 4. ANDROID LAUNCHER ICONS (Adaptive Foreground & Legacy)
# -------------------------------------------------------------
# Adaptive Icon Safe Zone Rule:
# Canvas is 108dp. Safe zone is inner 66dp (~61.1%).
# We place the emblem symbol centered inside the canvas occupying 60% of the canvas.
# This guarantees that circular, squircle, round-rect or teardrop OEM masks NEVER clip the corners or star.

MIPMAP_CONFIG = {
    'mipmap-mdpi': {'legacy': 48, 'foreground': 108},
    'mipmap-hdpi': {'legacy': 72, 'foreground': 162},
    'mipmap-xhdpi': {'legacy': 96, 'foreground': 216},
    'mipmap-xxhdpi': {'legacy': 144, 'foreground': 324},
    'mipmap-xxxhdpi': {'legacy': 192, 'foreground': 432},
}

for folder, dims in MIPMAP_CONFIG.items():
    target_dir = os.path.join(RES_DIR, folder)
    os.makedirs(target_dir, exist_ok=True)
    
    # 4A. Adaptive Icon Foreground (Transparent, Symbol in Safe Zone)
    fg_size = dims['foreground']
    # Use 62% of fg_size for the symbol diameter
    symbol_target_size = int(fg_size * 0.62)
    resized_sym = symbol_transparent.resize((symbol_target_size, symbol_target_size), Image.Resampling.LANCZOS)
    
    fg_canvas = Image.new('RGBA', (fg_size, fg_size), (0, 0, 0, 0))
    pos = ((fg_size - symbol_target_size) // 2, (fg_size - symbol_target_size) // 2)
    fg_canvas.paste(resized_sym, pos, resized_sym)
    fg_canvas.save(os.path.join(target_dir, 'ic_launcher_foreground.png'), 'PNG', optimize=True)
    
    # 4B. Legacy Square Launcher Icon (Dark background + scaled emblem)
    legacy_size = dims['legacy']
    leg_canvas = Image.new('RGB', (legacy_size, legacy_size), (9, 7, 10))
    # Fill with ambient background crop
    bg_leg = master_img.crop((256, 163, 768, 675)).resize((legacy_size, legacy_size), Image.Resampling.LANCZOS)
    leg_canvas.paste(bg_leg, (0, 0))
    
    # Scale emblem to 76% of canvas
    sym_leg_size = int(legacy_size * 0.76)
    sym_leg = symbol_transparent.resize((sym_leg_size, sym_leg_size), Image.Resampling.LANCZOS)
    leg_pos = ((legacy_size - sym_leg_size) // 2, (legacy_size - sym_leg_size) // 2)
    leg_canvas.paste(sym_leg, leg_pos, sym_leg)
    leg_canvas.save(os.path.join(target_dir, 'ic_launcher.png'), 'PNG', optimize=True)
    
    # 4C. Legacy Round Launcher Icon (Circular mask + scaled emblem)
    round_canvas = Image.new('RGBA', (legacy_size, legacy_size), (0, 0, 0, 0))
    round_mask = Image.new('L', (legacy_size, legacy_size), 0)
    draw_round = ImageDraw.Draw(round_mask)
    draw_round.ellipse((0, 0, legacy_size - 1, legacy_size - 1), fill=255)
    
    round_canvas.paste(leg_canvas, (0, 0), round_mask)
    round_canvas.save(os.path.join(target_dir, 'ic_launcher_round.png'), 'PNG', optimize=True)
    
    print(f'Generated icons for {folder}: foreground={fg_size}x{fg_size}, legacy={legacy_size}x{legacy_size}')

# -------------------------------------------------------------
# 5. ANDROID SPLASH SCREENS (Portrait & Landscape)
# -------------------------------------------------------------
SPLASH_RESOLUTIONS = {
    'drawable': (480, 320),
    'drawable-land-mdpi': (480, 320),
    'drawable-land-hdpi': (800, 480),
    'drawable-land-xhdpi': (1280, 720),
    'drawable-land-xxhdpi': (1600, 960),
    'drawable-land-xxxhdpi': (1920, 1280),
    'drawable-port-mdpi': (320, 480),
    'drawable-port-hdpi': (480, 800),
    'drawable-port-xhdpi': (720, 1280),
    'drawable-port-xxhdpi': (960, 1600),
    'drawable-port-xxxhdpi': (1280, 1920),
}

def create_splash_screen(width, height):
    splash = Image.new('RGB', (width, height), (9, 7, 10))
    
    # Ambient corner gradient:
    # Scale master background subtly to fill the canvas with smooth lighting
    bg_aspect = width / height
    if bg_aspect >= 1.0:
        # Landscape
        bg_scale_w = int(height * 1.5)
        bg_scale_h = height
    else:
        # Portrait
        bg_scale_w = width
        bg_scale_h = int(width * 1.5)
    
    bg_resized = master_img.resize((bg_scale_w, bg_scale_h), Image.Resampling.LANCZOS)
    bg_x = (width - bg_scale_w) // 2
    bg_y = (height - bg_scale_h) // 2
    splash.paste(bg_resized, (bg_x, bg_y))
    
    # Place full branding (symbol + CHROMA STUDIO text) perfectly centered
    # Logo content is inside master_img. In portrait, logo width is ~68% of screen width.
    # In landscape, logo height is ~72% of screen height.
    if height > width:
        # Portrait
        target_logo_w = int(width * 0.70)
        target_logo_h = target_logo_w
    else:
        # Landscape
        target_logo_h = int(height * 0.72)
        target_logo_w = target_logo_h
    
    logo_resized = master_img.resize((target_logo_w, target_logo_h), Image.Resampling.LANCZOS)
    logo_x = (width - target_logo_w) // 2
    logo_y = (height - target_logo_h) // 2
    splash.paste(logo_resized, (logo_x, logo_y))
    return splash

for folder, (sw, sh) in SPLASH_RESOLUTIONS.items():
    target_dir = os.path.join(RES_DIR, folder)
    os.makedirs(target_dir, exist_ok=True)
    splash_img = create_splash_screen(sw, sh)
    splash_img.save(os.path.join(target_dir, 'splash.png'), 'PNG', optimize=True)
    print(f'Generated splash for {folder}: {sw}x{sh}')

print('ALL BRAND ASSETS GENERATED SUCCESSFULLY!')
