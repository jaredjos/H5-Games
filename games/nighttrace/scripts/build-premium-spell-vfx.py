from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Final

import numpy as np
from PIL import Image, ImageChops


ROOT: Final = Path(__file__).resolve().parents[1]
SOURCE_ROOT: Final = ROOT / "art-source" / "spell-vfx-v3"
OUTPUT: Final = ROOT / "public" / "assets" / "spell-vfx" / "premium"

SOURCE_COLUMNS: Final = 6
SOURCE_ROWS: Final = 3
ACTIVE_ROW: Final = 1
DESKTOP_MATERIAL_CELL: Final = (256, 256)
MOBILE_MATERIAL_CELL: Final = (128, 128)
DESKTOP_PROJECTILE_CELL: Final = (256, 128)
MOBILE_PROJECTILE_CELL: Final = (128, 64)


@dataclass(frozen=True)
class SpellSource:
    weapon_id: str
    palette_id: str
    file_name: str


SPELLS: Final = (
    SpellSource(
        "helio-lance",
        "helio",
        "helio-lance-v3-source.png",
    ),
    SpellSource(
        "crescent-array",
        "crescent",
        "crescent-array-v3-source.png",
    ),
    SpellSource(
        "arc-choir",
        "arc",
        "arc-choir-v3-source.png",
    ),
    SpellSource(
        "rift-seeds",
        "rift",
        "rift-seeds-v3-source.png",
    ),
    SpellSource(
        "comet-swarm",
        "comet",
        "comet-swarm-v3-source.png",
    ),
    SpellSource(
        "ash-halo",
        "graveglass",
        "graveglass-spires-v3-source.png",
    ),
    SpellSource(
        "mirror-bow",
        "mirror",
        "mirror-bow-v3-source.png",
    ),
    SpellSource(
        "null-bell",
        "eclipse",
        "eclipse-harrow-v3-source.png",
    ),
)


def split_grid(image: Image.Image) -> list[list[Image.Image]]:
    """Split arbitrary source dimensions into the authored 6x3 grid."""
    rows: list[list[Image.Image]] = []
    for row in range(SOURCE_ROWS):
        top = round(row * image.height / SOURCE_ROWS)
        bottom = round((row + 1) * image.height / SOURCE_ROWS)
        cells: list[Image.Image] = []
        for column in range(SOURCE_COLUMNS):
            left = round(column * image.width / SOURCE_COLUMNS)
            right = round((column + 1) * image.width / SOURCE_COLUMNS)
            cells.append(image.crop((left, top, right, bottom)).convert("RGB"))
        rows.append(cells)
    return rows


def visible_bbox(cell: Image.Image) -> tuple[int, int, int, int]:
    """Find authored light against the intended black additive background."""
    difference = ImageChops.difference(
        cell.convert("RGB"),
        Image.new("RGB", cell.size, "black"),
    ).convert("L")
    mask = difference.point(lambda value: 255 if value > 2 else 0)
    return mask.getbbox() or (0, 0, cell.width, cell.height)


def isolate_cell(cell: Image.Image) -> Image.Image:
    """
    Remove neighbor spill that touches a generated grid boundary.

    Image generation occasionally lets a bright shard from the next panel
    cross a theoretical cell edge. Find a real near-black separator in the
    outer band before removing that disconnected edge content. This preserves
    smoke and wide awakened structures that legitimately approach an edge.
    """
    luminance = np.asarray(cell.convert("L"))
    visible = luminance > 2
    column_signal = visible.sum(axis=0) >= 2
    row_signal = visible.sum(axis=1) >= 2

    def false_runs(signal: np.ndarray) -> list[tuple[int, int]]:
        runs: list[tuple[int, int]] = []
        start: int | None = None
        for index, active in enumerate(signal):
            if not active and start is None:
                start = index
            elif active and start is not None:
                if index - start >= 3:
                    runs.append((start, index))
                start = None
        if start is not None and len(signal) - start >= 3:
            runs.append((start, len(signal)))
        return runs

    def isolate_axis(signal: np.ndarray) -> tuple[int, int]:
        length = len(signal)
        lower_limit = round(length * 0.32)
        upper_limit = round(length * 0.68)
        start = 0
        end = length
        runs = false_runs(signal)

        left_candidates = [
            run
            for run in runs
            if run[1] <= lower_limit
            and signal[: run[0]].any()
            and signal[run[1] : upper_limit].any()
        ]
        if left_candidates:
            start = max(left_candidates, key=lambda run: run[1])[1]

        right_candidates = [
            run
            for run in runs
            if run[0] >= upper_limit
            and signal[lower_limit : run[0]].any()
            and signal[run[1] :].any()
        ]
        if right_candidates:
            end = min(right_candidates, key=lambda run: run[0])[0]

        return start, end

    left, right = isolate_axis(column_signal)
    top, bottom = isolate_axis(row_signal)
    if right - left < cell.width * 0.45:
        left, right = 0, cell.width
    if bottom - top < cell.height * 0.45:
        top, bottom = 0, cell.height
    return cell.crop((left, top, right, bottom))


def normalize_cell(
    cell: Image.Image,
    target_size: tuple[int, int],
    gutter: int,
) -> Image.Image:
    isolated = isolate_cell(cell)
    left, top, right, bottom = visible_bbox(isolated)
    source_padding = max(2, round(min(isolated.size) * 0.012))
    source = isolated.crop(
        (
            max(0, left - source_padding),
            max(0, top - source_padding),
            min(isolated.width, right + source_padding),
            min(isolated.height, bottom + source_padding),
        ),
    )
    target_width, target_height = target_size
    inner_width = max(1, target_width - gutter * 2)
    inner_height = max(1, target_height - gutter * 2)
    scale = min(
        inner_width / max(1, source.width),
        inner_height / max(1, source.height),
    )
    resized = source.resize(
        (
            max(1, round(source.width * scale)),
            max(1, round(source.height * scale)),
        ),
        Image.Resampling.LANCZOS,
    )
    normalized = Image.new("RGB", target_size, "black")
    normalized.paste(
        resized,
        (
            (target_width - resized.width) // 2,
            (target_height - resized.height) // 2,
        ),
    )
    return normalized


def normalize_grid(
    rows: list[list[Image.Image]],
    target_cell: tuple[int, int],
    gutter: int,
) -> tuple[Image.Image, list[list[Image.Image]]]:
    target_width, target_height = target_cell
    normalized_rows: list[list[Image.Image]] = []
    atlas = Image.new(
        "RGB",
        (target_width * SOURCE_COLUMNS, target_height * SOURCE_ROWS),
        "black",
    )

    for row_index, cells in enumerate(rows):
        normalized_cells = [
            normalize_cell(cell, target_cell, gutter)
            for cell in cells
        ]
        normalized_rows.append(normalized_cells)
        for column, normalized in enumerate(normalized_cells):
            atlas.paste(
                normalized,
                (column * target_width, row_index * target_height),
            )

    return atlas, normalized_rows


def normalize_active_row(
    cells: list[Image.Image],
    target_cell: tuple[int, int],
    gutter: int,
) -> list[Image.Image]:
    return [
        normalize_cell(cell, target_cell, gutter)
        for cell in cells
    ]


def save_webp(image: Image.Image, file_name: str, quality: int) -> Path:
    destination = OUTPUT / file_name
    image.save(
        destination,
        "WEBP",
        quality=quality,
        method=6,
    )
    return destination


def build_projectile_atlas(
    source_grids: list[list[list[Image.Image]]],
    target_cell: tuple[int, int],
    gutter: int,
) -> Image.Image:
    cell_width, cell_height = target_cell
    atlas = Image.new(
        "RGB",
        (cell_width * SOURCE_COLUMNS, cell_height * len(SPELLS)),
        "black",
    )
    for spell_row, grid in enumerate(source_grids):
        active_cells = normalize_active_row(
            grid[ACTIVE_ROW],
            target_cell,
            gutter,
        )
        for state_column, active_cell in enumerate(active_cells):
            atlas.paste(
                active_cell,
                (state_column * cell_width, spell_row * cell_height),
            )
    return atlas


def assert_size(
    image: Image.Image,
    expected: tuple[int, int],
    label: str,
) -> None:
    if image.size != expected:
        raise ValueError(
            f"{label} must be {expected[0]}x{expected[1]}, got "
            f"{image.width}x{image.height}",
        )


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    source_grids: list[list[list[Image.Image]]] = []
    generated: list[Path] = []

    for spell in SPELLS:
        source_path = SOURCE_ROOT / spell.file_name
        if not source_path.is_file():
            raise FileNotFoundError(f"Missing authored VFX source: {source_path}")

        with Image.open(source_path) as source_image:
            grid = split_grid(source_image.convert("RGB"))
        source_grids.append(grid)

        desktop, _ = normalize_grid(grid, DESKTOP_MATERIAL_CELL, gutter=8)
        mobile, _ = normalize_grid(grid, MOBILE_MATERIAL_CELL, gutter=4)
        assert_size(desktop, (1536, 768), f"{spell.palette_id} desktop")
        assert_size(mobile, (768, 384), f"{spell.palette_id} mobile")
        generated.append(
            save_webp(
                desktop,
                f"spell-material-{spell.palette_id}-v3-desktop.webp",
                quality=96,
            ),
        )
        generated.append(
            save_webp(
                mobile,
                f"spell-material-{spell.palette_id}-v3-mobile.webp",
                quality=92,
            ),
        )

    desktop_projectiles = build_projectile_atlas(
        source_grids,
        DESKTOP_PROJECTILE_CELL,
        gutter=8,
    )
    mobile_projectiles = build_projectile_atlas(
        source_grids,
        MOBILE_PROJECTILE_CELL,
        gutter=4,
    )
    assert_size(desktop_projectiles, (1536, 1024), "desktop projectiles")
    assert_size(mobile_projectiles, (768, 512), "mobile projectiles")
    generated.append(
        save_webp(
            desktop_projectiles,
            "spell-projectiles-v3-desktop.webp",
            quality=96,
        ),
    )
    generated.append(
        save_webp(
            mobile_projectiles,
            "spell-projectiles-v3-mobile.webp",
            quality=92,
        ),
    )

    for destination in generated:
        with Image.open(destination) as output:
            output.verify()

    print(
        f"Generated {len(generated)} premium spell VFX v3 atlases in "
        f"{OUTPUT}",
    )


if __name__ == "__main__":
    main()
