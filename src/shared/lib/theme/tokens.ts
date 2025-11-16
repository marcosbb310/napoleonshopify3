export type FeltThemeTokens = {
  colors: {
    backgroundBase: string
    backgroundElevated: string
    surface: string
    surfaceHighlight: string
    surfaceContrast: string
    shadow: string
    foreground: string
    foregroundSoft: string
    muted: string
    mutedForeground: string
    stitch: string
    stitchShadow: string
    border: string
    borderStrong: string
    ring: string
    highlight: string
  }
  charts: string[]
  sidebar: {
    background: string
    foreground: string
    primary: string
    primaryForeground: string
    accent: string
    accentForeground: string
    border: string
    ring: string
  }
  textures: {
    feltTexture: string
    feltNoise: string
    iconOverlay: string
    stopMotionEase: string
  }
}

/**
 * Felt-inspired theme tokens mirrored in `src/app/globals.css`.
 * Update both this file and the CSS variables when adjusting the theme.
 * To revert to the previous palette, restore the neutral/light token values here
 * and the corresponding CSS custom properties.
 */
export const feltThemeTokens: FeltThemeTokens = {
  colors: {
    backgroundBase: '#1f2f5a',
    backgroundElevated: '#24366a',
    surface: '#2a3f7a',
    surfaceHighlight: '#324889',
    surfaceContrast: '#395196',
    shadow: 'rgba(10, 15, 35, 0.85)',
    foreground: '#f5f6fb',
    foregroundSoft: '#dfe3f7',
    muted: 'rgba(225, 229, 255, 0.08)',
    mutedForeground: '#c8cee6',
    stitch: '#f1f0e8',
    stitchShadow: 'rgba(7, 9, 20, 0.58)',
    border: 'rgba(210, 218, 255, 0.2)',
    borderStrong: 'rgba(210, 218, 255, 0.32)',
    ring: 'rgba(240, 244, 255, 0.45)',
    highlight: 'rgba(255, 255, 255, 0.09)',
  },
  charts: ['#f6f1df', '#708bd4', '#4e6ab1', '#36519b', '#9fb3eb'],
  sidebar: {
    background: 'rgba(33, 48, 93, 0.92)',
    foreground: '#f5f6fb',
    primary: '#324889',
    primaryForeground: '#f5f6fb',
    accent: 'rgba(45, 64, 117, 0.75)',
    accentForeground: '#f5f6fb',
    border: 'rgba(210, 218, 255, 0.24)',
    ring: 'rgba(240, 244, 255, 0.45)',
  },
  textures: {
    feltTexture:
      "url('/textures/felt-seamless.png')",
    feltNoise:
      "url('data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'80\' height=\'80\'><filter id=\'n\'><feTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'3\' seed=\'17\'/><feColorMatrix type=\'matrix\' values=\'1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 9 -5\'/></filter><rect width=\'100%\' height=\'100%\' filter=\'url(%23n)\' opacity=\'0.18\'/></svg>')",
    iconOverlay:
      'linear-gradient(120deg, rgba(245, 247, 255, 0.05), rgba(18, 28, 56, 0.05))',
    stopMotionEase: 'cubic-bezier(0.18, 0.62, 0.19, 0.99)',
  },
}

