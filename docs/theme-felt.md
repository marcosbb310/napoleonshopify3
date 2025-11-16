# Felt Theme Rollout

- **Overview:** Deep navy felt-inspired visual system with stitched accents and stop-motion hover beats. Textures are defined purely with CSS so the change stays easy to version and revert.
- **Primary variables:** `src/app/globals.css` hosts the new `--felt-*` tokens. Programmatic equivalents for scripts/tests live in `src/shared/lib/theme/tokens.ts`.
- **Global surface updates:** Applied in `src/app/(app)/layout.tsx`, `AppNavbar.tsx`, `AppSidebar.tsx`, `UserMenu.tsx`, and `ConnectionStatusBanner.tsx`. Cards, buttons, badges, and sidebar primitives pick up the theme through `[data-slot]` selectors.
- **Texture asset:** `src/shared/assets/textures/felt-grain.svg` offers a reusable felt grain if designers ever need an image-based overlay instead of the generated gradients.

## Reverting Quickly

1. Replace the `--felt-*` section in `globals.css` with the previous neutral palette (see git history for the block removed in this change).
2. Remove the felt-specific overrides in `globals.css` (`[data-slot="button"]`, `[data-slot="badge"]`, `.felt-*` utilities) if you want the original shadcn/ui styling.
3. Delete `src/shared/lib/theme/` and `src/shared/assets/textures/felt-grain.svg` if they are no longer required.
4. Reset App shell components (`AppNavbar`, `AppSidebar`, `UserMenu`, `ConnectionStatusBanner`, and `src/app/(app)/layout.tsx`) to their prior backgrounds/shadows by reverting this commit.

Because everything is isolated to CSS variables and a handful of shared components, reverting is a one-commit rollback or a copy/paste of the old palette block.

## Accessibility Notes

- Core text contrast: `#f3f1ea` on the `#0f1b2e` base background yields ~10.5:1 (AA/AAA compliant) using WebAIM’s contrast checker.
- Button text: `#f3f1ea` on `#223651` is ~6.9:1, also passing AA/AAA for normal text.
- Badges and outline buttons retain dashed borders and cream text at ≥4.5:1 thanks to the neutral accent surfaces.
- Hover animations use step easing with ≤2px translation to avoid motion sickness while still suggesting stop-motion.

## Icon Treatment

- `.felt-icon` utility adds a soft overlay without distorting glyph clarity. Apply it selectively where icons sit on felt surfaces.

## Stop-Motion Hover

- `[data-slot="button"]` and `[data-slot="badge"]` use `steps(3, end)` transitions to emulate frame skips.
- Link variants bypass the stitched styling via `data-variant="link"` to keep their minimalist appearance.



