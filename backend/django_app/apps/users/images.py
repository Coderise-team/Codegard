"""Avatar image processing: turn an uploaded image into the two files we store.

Replaces sorl-thumbnail. We need exactly one master copy and one square
thumbnail, both WEBP, produced in a single pass while the image is still in
memory — no round-trip to storage to re-read the source just to crop it.
"""

import io
from pathlib import Path

from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image, ImageOps

# Sizes live here and nowhere else — tests import these constants, so there is
# never a second "192" or "1024" in the codebase to drift out of sync.
MASTER_MAX_DIM_PX = 1024  # longest side of the stored master copy
THUMB_SIZE_PX = 192  # the square thumbnail served everywhere (96px design @2x)

OUTPUT_FORMAT = "WEBP"
OUTPUT_EXT = ".webp"
OUTPUT_CONTENT_TYPE = "image/webp"
OUTPUT_QUALITY = 85


def process_avatar(source):
    """Produce ``(master, thumbnail)`` from an already-validated upload.

    Both come back as in-memory WEBP uploads ready to assign to ImageFields:

      * ``master``    — EXIF-rotated, mode-normalised, shrunk to fit within
        ``MASTER_MAX_DIM_PX`` on its longest side;
      * ``thumbnail`` — a ``THUMB_SIZE_PX`` square cropped from the centre of
        the master.

    The caller is expected to have already validated the file (size, type,
    ``Image.verify()``) and rewound it (``seek(0)``).
    """
    image = Image.open(source)
    image = ImageOps.exif_transpose(image)
    if image.mode in {"P", "LA"}:
        image = image.convert("RGBA")
    elif image.mode not in {"RGB", "RGBA"}:
        image = image.convert("RGB")

    # Master: shrink in place to fit the box. thumbnail() mutates `image`.
    image.thumbnail((MASTER_MAX_DIM_PX, MASTER_MAX_DIM_PX), Image.Resampling.LANCZOS)

    # Thumbnail: crop a centred square FROM THE MASTER (already <=1024px, more
    # than enough for 192px). fit() scales and centre-crops — the exact thing
    # sorl's crop="center" did.
    thumb = ImageOps.fit(
        image,
        (THUMB_SIZE_PX, THUMB_SIZE_PX),
        Image.Resampling.LANCZOS,
        centering=(0.5, 0.5),
    )

    stem = Path(getattr(source, "name", "") or "avatar").stem or "avatar"
    master_file = _encode(image, f"{stem}{OUTPUT_EXT}")
    thumb_file = _encode(thumb, f"{stem}-thumb{OUTPUT_EXT}")
    return master_file, thumb_file


def _encode(image, name: str) -> SimpleUploadedFile:
    buffer = io.BytesIO()
    image.save(buffer, format=OUTPUT_FORMAT, quality=OUTPUT_QUALITY)
    buffer.seek(0)
    return SimpleUploadedFile(
        name=name, content=buffer.read(), content_type=OUTPUT_CONTENT_TYPE
    )
