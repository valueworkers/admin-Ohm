from PIL import Image, ImageDraw
import os

src_msme = r"C:\Users\pawan\.cursor\projects\d-proj-seniorcare-admin-pannel\assets\c__Users_pawan_AppData_Roaming_Cursor_User_workspaceStorage_5c6da299b016c73f5a4f400c509b3b29_images_image-4f297ce4-5bff-4d8a-a4e3-4edacdf15da5.png"
src_duns = r"C:\Users\pawan\.cursor\projects\d-proj-seniorcare-admin-pannel\assets\c__Users_pawan_AppData_Roaming_Cursor_User_workspaceStorage_5c6da299b016c73f5a4f400c509b3b29_images_image-3b0ed56d-6c07-4756-8cc7-31b7ae2306b2.png"
out_dir = r"d:\proj\seniorcare-admin-pannel\public\badges"


def flood_clear_background(img, seed_colors_max_diff=42):
    """Flood-fill from edges: clear near-white / light-gray background to transparent."""
    img = img.convert("RGBA")
    w, h = img.size
    px = img.load()

    def is_bg(r, g, b, a):
        if a < 8:
            return True
        mx, mn = max(r, g, b), min(r, g, b)
        # white / gray (low chroma) — catch soft edges around seals
        if mn >= 150 and mx - mn <= 22:
            return True
        if mn >= 235:
            return True
        return False

    visited = [[False] * w for _ in range(h)]
    stack = []
    for x in range(w):
        stack.append((x, 0))
        stack.append((x, h - 1))
    for y in range(h):
        stack.append((0, y))
        stack.append((w - 1, y))

    while stack:
        x, y = stack.pop()
        if x < 0 or y < 0 or x >= w or y >= h or visited[y][x]:
            continue
        visited[y][x] = True
        r, g, b, a = px[x, y]
        if not is_bg(r, g, b, a):
            continue
        px[x, y] = (0, 0, 0, 0)
        stack.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))

    # Soften remaining near-white fringe outside logo blues
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a and min(r, g, b) >= 245 and max(r, g, b) - min(r, g, b) <= 10:
                px[x, y] = (0, 0, 0, 0)
    return img


def process_msme(img):
    img = img.convert("RGBA")
    # First clear checkerboard via flood from edges
    img = flood_clear_background(img)
    px = img.load()
    w, h = img.size
    cx, cy = w / 2, h / 2
    radius = min(w, h) * 0.495
    for y in range(h):
        for x in range(w):
            dx, dy = x - cx + 0.5, y - cy + 0.5
            if (dx * dx + dy * dy) ** 0.5 > radius:
                px[x, y] = (0, 0, 0, 0)
    # Circular soft mask
    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)
    pad = 1
    draw.ellipse((pad, pad, w - 1 - pad, h - 1 - pad), fill=255)
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    bbox = out.getbbox()
    return out.crop(bbox) if bbox else out


def process_duns(img):
    img = flood_clear_background(img.convert("RGBA"))
    bbox = img.getbbox()
    return img.crop(bbox) if bbox else img


os.makedirs(out_dir, exist_ok=True)

msme = process_msme(Image.open(src_msme))
msme_path = os.path.join(out_dir, "msme.png")
msme.save(msme_path, "PNG")
print("saved", msme_path, msme.size, "alpha0%", round(sum(1 for p in msme.getdata() if p[3] == 0) / (msme.size[0] * msme.size[1]) * 100, 1))

duns = process_duns(Image.open(src_duns))
duns_path = os.path.join(out_dir, "duns.png")
duns.save(duns_path, "PNG")
print("saved", duns_path, duns.size, "alpha0%", round(sum(1 for p in duns.getdata() if p[3] == 0) / (duns.size[0] * duns.size[1]) * 100, 1))
print("corners", duns.getpixel((0, 0)), msme.getpixel((0, 0)))
