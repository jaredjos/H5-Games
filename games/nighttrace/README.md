# NIGHTTRACE

**Draw the path. Burn the horde.**

NIGHTTRACE is an original browser horde-survival game built with React, TypeScript, Vite, and PixiJS. Auto-attacking weapons keep the controls approachable; every step paints a luminous trace, and closing a loop turns movement itself into a weapon.

**Play the current HTTPS release:** [jaredjos.github.io/H5-Games/nighttrace](https://jaredjos.github.io/H5-Games/nighttrace/)

## Release lineage

- `v1.0.0` — original desktop/browser release
- `v1.1.0` — mobile-ready release with installable offline play, safe-area-aware touch UI, responsive portrait/landscape layouts, deployment-relative hosting, lifecycle-safe audio, and substantially lighter runtime art
- `v1.1.1` — streamlined touch HUD with direct arena steering and a global 10% hostile-pressure increase across all sectors
- `v1.2.0` — landscape-first combat, a simultaneous three-card mobile draft, a 50% default music setting mixed at roughly twice the former loudness, ten sector-specific boss patterns, and timed support pickups
- `v1.3.0` — re-authored encounter pacing with a readable one-minute warmup, accelerating mid/late hordes, progression-gated specialists, steeper late upgrade costs, and build-aware sovereign durability
- `v1.3.1` — runtime-captured upgrade documentation plus stronger, species-specific horde locomotion, attack anticipation/release poses, sovereign motion profiles, responsive shadows, footfalls, hover trails, and compact attack accents
- `v1.4.0` — a complete eight-weapon visual overhaul with stage-aware silhouettes, cast gates, impact punctuation, mastery density, awakened signatures, deterministic 32-state capture evidence, and landscape-phone validation
- `v1.5.0` — public Combat Lab and Boss Trials modes, isolated ten-boss progression, configurable no-limit testing, hostile-palette horde/boss motion graphics, mode-aware HUD/results, and expanded desktop/mobile validation
- `v1.5.1` — the former area-power clarity experiment: non-concentric silhouettes, continuous rapid-fire motion, refreshed runtime proofs, and desktop/mobile validation
- `v1.5.2` — a complete ten-boss animation pass with sovereign-specific idle and locomotion signatures, normal melee wind-up/release/recovery, dynamic pivots and afterimages, plus distinct level-specific special-action VFX
- `v1.6.0` — Graveglass Spires and Eclipse Harrow replace the former area powers with remote-world targeting, four-stage branch/lane formations, one-hit overlap safety, persistent heaven-to-ground relic beacons, and an original layered dungeon/boss score

- `v1.7.0` — experimental hero and sovereign material-VFX pass
- `v1.7.1` — visual-clarity rescue: full-resolution hero and boss art, retired ghost overlays, protected actor layering, bounded maximum-load effects, curved Crescent projectiles, hostile boss atmosphere, and DPR-3 mobile validation
- `v1.7.2` — Graveglass Spires and Eclipse Harrow presentation parity: stage-scaled authored material profiles, layered hostile underglow and silhouette passes, deterministic cosmetic debris, and protected actor readability without combat changes
- `v1.8.0` — the approved Graveglass and Eclipse choreography enters live combat through authored alpha-textured structures, deterministic rise/impact/decay animation, protected actor layering, and dedicated mobile texture LODs
- `v1.9.0` — grounded hostile VFX replace diagrammatic boss rays, ring warnings, fissure spokes, and duplicate spell vectors with authored rubble/scorch materials, ash, dust,#�;��h��춻�q�^t    0.5,
          ) *
            0.42
        : 1
    const alpha =
      particleKind === 'smoke'
        ? palette.smokeOpacity *
          (0.58 + pose.impact * 0.3) *
          cycleEnvelope *
          warningGain
        : particleKind === 'cinder'
          ? palette.impactOpacity *
            (0.72 + pose.impact * 0.34) *
            twinkle *
            warningGain
          : (0.2 + palette.groundOpacity * 0.28) *
            (0.68 + cycleEnvelope * 0.32) *
            warningGain
    const tint =
      particleKind === 'smoke'
        ? treatment.smokeTint
        : particleKind === 'cinder'
          ? index % 2 === 0
            ? palette.impactTint
            : treatment.accentColor
          : treatment.debrisTint
    const glowAlpha =
      particleKind === 'cinder'
        ? clamp01(
            (0.2 + palette.emission * 0.62 + pose.impact * 0.18) *
              reducedEnergy,
          )
        : 0

    particles.push(
      Object.freeze({
        kind: particleKind,
        u,
        v,
        lift,
        size,
        stretch,
        rotation:
          (groundedVfxCosmeticUnit(seed, index, 71) - 0.5) *
          Math.PI *
          0.72,
        alpha: clamp01(alpha * reducedEnergy),
        tint,
        glowAlpha,
      }),
    )
  }

  return Object.freeze(particles)
}
