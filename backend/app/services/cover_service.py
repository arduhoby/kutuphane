import os
import httpx
from app.config import settings


ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


def get_cover_path(filename: str) -> str:
    return os.path.join(settings.COVERS_DIR, filename)


async def save_cover_from_url(book_id: int, url: str) -> str | None:
    if not url or not url.startswith("http"):
        return None

    os.makedirs(settings.COVERS_DIR, exist_ok=True)

    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                return None
            content = resp.content
            if len(content) < 100:
                return None
    except Exception:
        return None

    ext = ".jpg"
    ct = resp.headers.get("content-type", "")
    if "png" in ct:
        ext = ".png"
    elif "webp" in ct:
        ext = ".webp"
    elif "gif" in ct:
        ext = ".gif"

    filename = f"book_{book_id}{ext}"
    filepath = get_cover_path(filename)

    with open(filepath, "wb") as f:
        f.write(content)

    return f"/covers/{filename}"
