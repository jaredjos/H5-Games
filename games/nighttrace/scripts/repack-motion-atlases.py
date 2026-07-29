"""Repack pose atlases so wide poses cannot bleed into adjacent cells.

The source atlases were authored without gutters. Several windup frames
therefore sampled pieces of the neighboring release pose (detached wings,
limbs, and spell fragments). This script assigns each connected alpha island
to the nearest pose centre, then writes isolated 384 px cells with transparent
gutters while preserving each row's relative pose scale.
"""

from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "public" / "assets"
ATLAS_PATHS = (
    ASSETS / "boss-animations" / "boss-motion-atlas-a.webp",
    ASSETS / "boss-animations" / "boss-motion-atlas-b.webp",
    ASSETS / "enemy-animations" / "enemy-motion-atlas-a.webp",
    ASSETS / "enemy-animations" / "enemy-motion-atlas-b.webp",
)
OUTPUT_CELL = 384
OUTPUT_GUTTER = 12
COLUMNS = 5
ROWS = 3


def nearest_pose(
    x: float,
    y: float,
    width: int,
    height: int,
) -> int:
    column = min(
        range(COLUMNS),
        key=lambda candidate: abs(
            x - (candidate + 0.5) * width / COLUMNS
        ),
    )
    row = min(
        range(ROWS),
        key=lambda candidate: abs(
            y - (candidate + 0.5) * height / ROWS
        ),
    )
    return row * COLUMNS + column


def alpha_island_owners(image: Image.Image) -> bytearray:
    width, height = image.size
    alpha = image.getchannel("A").tobytes()
    visited = bytearray(width * height)
    owners = bytearray(width * height)

    for start in range(width * height):
        if visited[start] or alpha[start] == 0:
            continue
        visited[start] = 1
        queue = deque([start])
        island: list[int] = []
        x_total = 0
        y_total = 0

        while queue:
            index = queue.popleft()
            island.append(index)
            x = index % width
            y = index // width
            x_total += x
            y_total += y
            for ny in range(max(0, y - 1), min(height, y + 2)):
                row_start = ny * width
                for nx in range(max(0, x - 1), min(width, x + 2)):
                    neighbor = row_start + nx
                    if visited[neighbor] or alpha[neighbor] == 0:
                        continue
                    visited[neighbor] = 1
                    queue.append(neighbor)

        # Single-pixel WebP alpha noise is not authored animation detail.
        if len(island) < 3:
            continue
        pose = nearest_pose(
            x_total / len(island),
            y_total / len(island),
            width,
            height,
        )
        owner = pose + 1
        for index in island:
            owners[index] = owner

    return owners


def repack(path: Path) -> None:
    source = Image.open(path).convert("RGBA")
    if source.size == (OUTPUT_CELL * COLUMNS, OUTPUT_CELL * ROWS):
        print(f"already isolated {path.relative_to(ROOT)}")
        return
    width, height = source.size
    owners = alpha_island_owners(source)
    centres = [
        (
            (column + 0.5) * width / COLUMNS,
            (row + 0.5) * height / ROWS,
        )
        for row in range(ROWS)
        for column in range(COLUMNS)
    ]

    row_extents: list[tuple[float, float]] = []
    for row in range(ROWS):
        max_x = width / COLUMNS / 2
        max_y = height / ROWS / 2
        for index, owner in enumerate(owners):
            if owner == 0 or (owner - 1) // COLUMNS != row:
                continue
            pose = owner - 1
            centre_x, centre_y = centres[pose]
            x = index % width
            y = index // width
            max_x = max(max_x, abs(x - centre_x))
            max_y = max(max_y, abs(y - centre_y))
        row_extents.append((max_x + 2, max_y + 2))

    result = Image.new(
        "RGBA",
        (OUTPUT_CELL * COLUMNS, OUTPUT_CELL * ROWS),
    )
    base_scale_x = OUTPUT_CELL / (width / COLUMNS)
    base_scale_y = OUTPUT_CELL / (height / ROWS)
    safe_half = OUTPUT_CELL / 2 - OUTPUT_GUTTER

    for pose, (centre_x, centre_y) in enumerate(centres):
        row = pose // COLUMNS
        column = pose % COLUMNS
        extent_x, extent_y = row_extents[row]
        fit = min(
            1,
            safe_half / (extent_x * base_scale_x),
            safe_half / (extent_y * base_scale_y),
        )
        left = round(centre_x - extent_x)
        top = round(centre_y - extent_y)
        right = round(centre_x + extent_x)
        bottom = round(centre_y + extent_y)
        isolated = Image.new("RGBA", source.size)
        mask = Image.frombytes(
            "L",
            source.size,
            bytes(255 if owner == pose + 1 else 0 for owner in owners),
        )
        isolated.paste(source, (0, 0), mask)
        crop = isolated.crop((left, top, right, bottom))
        target_width = max(1, round(crop.width * base_scale_x * fit))
        target_height = max(1, round(crop.height * base_scale_y * fit))
        crop = crop.resize(
            (target_width, target_height),
            Image.Resampling.LANCZOS,
        )
        result.alpha_composite(
            crop,
            (
                column * OUTPUT_CELL + (OUTPUT_CELL - target_width) // 2,
                row * OUTPUT_CELL + (OUTPUT_CELL - target_height) // 2,
            ),
        )

    result.save(
        path,
        "WEBP",
        lossless=True,
        method=6,
        exact=True,
    )
    print(f"repacked {path.relative_to(ROOT)} -> {result.size}")


if __name__ == "__main__":
    for atlas_path in ATLAS_PATHS:
        repack(atlas_path)
