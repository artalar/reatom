export const colors = {
  bg: 'var(--admin-bg, #11131a)',
  bgElevated: 'var(--admin-bg-elevated, #161925)',
  surface: 'var(--admin-surface, #1d2130)',
  surfaceRaised: 'var(--admin-surface-raised, #242b3d)',
  surfaceInteractive: 'var(--admin-surface-interactive, #2b3550)',
  text: 'var(--admin-text, #edf2ff)',
  textMuted: 'var(--admin-text-muted, #9aa8c7)',
  textSubtle: 'var(--admin-text-subtle, #7081a7)',
  accent: 'var(--admin-accent, #8bb7ff)',
  accentSoft: 'var(--admin-accent-soft, rgba(139, 183, 255, 0.18))',
  error: 'var(--admin-error, #ff8da1)',
  errorSoft: 'var(--admin-error-soft, rgba(255, 141, 161, 0.18))',
  success: 'var(--admin-success, #8ce6b1)',
  successSoft: 'var(--admin-success-soft, rgba(140, 230, 177, 0.16))',
  warning: 'var(--admin-warning, #f7d774)',
  warningSoft: 'var(--admin-warning-soft, rgba(247, 215, 116, 0.16))',
  border: 'var(--admin-border, rgba(142, 157, 196, 0.18))',
  borderStrong: 'var(--admin-border-strong, rgba(142, 157, 196, 0.36))',
  highlight: 'var(--admin-highlight, rgba(139, 183, 255, 0.14))',
  shadow: 'var(--admin-shadow, rgba(3, 8, 24, 0.48))',
}

export const space = [0, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4] as const
export type Size = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

export const p = (n: Size) => `padding: ${space[n]}rem;`
export const px = (n: Size) => `padding-inline: ${space[n]}rem;`
export const py = (n: Size) => `padding-block: ${space[n]}rem;`
export const m = (n: Size) => `margin: ${space[n]}rem;`
export const mx = (n: Size) => `margin-inline: ${space[n]}rem;`
export const my = (n: Size) => `margin-block: ${space[n]}rem;`

export const bg = (color: string) => `background: ${color};`
export const text = (color: string) => `color: ${color};`
export const rounded = 'border-radius: 8px;'
export const roundedSm = 'border-radius: 4px;'
export const roundedLg = 'border-radius: 16px;'

export const flex = 'display: flex;'
export const flexCol = 'flex-direction: column;'
export const flexCenter = 'justify-content: center; align-items: center;'
export const flexWrap = 'flex-wrap: wrap;'
export const gap = (n: Size) => `gap: ${space[n]}rem;`

export const border = `border: 1px solid ${colors.border};`
export const borderStrong = `border: 1px solid ${colors.borderStrong};`
export const card = `${bg(colors.surface)} ${rounded} ${border};`
export const cardRaised = `${bg(colors.surfaceRaised)} ${rounded} ${borderStrong};`
export const scrollable = 'overflow-y: auto; -webkit-overflow-scrolling: touch;'
export const truncate =
  'overflow: hidden; text-overflow: ellipsis; white-space: nowrap;'
export const mono =
  'font-family: ui-monospace, SFMono-Regular, SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace;'
export const focusRing = `outline: 2px solid ${colors.accent}; outline-offset: 2px;`
export const focusVisible = `
  &:focus {
    outline: none;
  }
  &:focus-visible {
    ${focusRing}
  }
`
export const softShadow = `box-shadow: 0 8px 20px -16px ${colors.shadow};`

export const toolbar = `
  ${bg(colors.bgElevated)}
  ${rounded}
  ${border}
  ${px(2)}
  ${py(1)}
`

export const statChip = `
  display: inline-flex;
  align-items: baseline;
  ${gap(1)}
  ${px(1)}
  ${py(1)}
  ${roundedSm}
  border: 1px solid ${colors.border};
  background: ${colors.bg};
  font-size: 0.68rem;
  line-height: 1.2;
  white-space: nowrap;
`

export const inputLike = `
  ${rounded}
  ${border}
  background: ${colors.bgElevated};
  color: ${colors.text};
  box-sizing: border-box;
  min-height: 2.25rem;
  ${focusVisible}
`

export const buttonBase = `
  ${rounded}
  ${border}
  ${px(2)}
  ${py(1)}
  background: ${colors.surfaceInteractive};
  color: ${colors.text};
  cursor: pointer;
  transition:
    background 120ms ease,
    border-color 120ms ease;
  ${focusVisible}
`

export const buttonGhost = `
  ${rounded}
  ${border}
  ${px(2)}
  ${py(1)}
  background: transparent;
  color: ${colors.textMuted};
  cursor: pointer;
  ${focusVisible}
`

export const buttonDanger = `
  ${rounded}
  ${border}
  ${px(2)}
  ${py(1)}
  background: transparent;
  border-color: ${colors.error};
  color: ${colors.error};
  cursor: pointer;
  ${focusVisible}
`

export const badge = `
  display: inline-flex;
  align-items: center;
  ${gap(1)}
  ${px(1)}
  ${py(1)}
  ${roundedSm}
  font-size: 0.7rem;
  line-height: 1;
  border: 1px solid ${colors.borderStrong};
  cursor: default;
  pointer-events: none;
`

export const sectionTitle = `
  margin: 0;
  font-size: 0.9rem;
  font-weight: 700;
  color: ${colors.text};
`

export const panelTitle = `
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: ${colors.text};
`

export const adminShellContainer = `
  container-type: inline-size;
  container-name: admin-shell;
`

export const compactPanelPadding = `
  @container admin-shell (max-width: 680px) {
    padding: 0.75rem;
  }
`

export const hideInCompactShell = `
  @container admin-shell (max-width: 680px) {
    display: none;
  }
`

export const compactOnlyShell = `
  display: none;

  @container admin-shell (max-width: 680px) {
    display: inline-flex;
  }
`

export const screenRoot = `
  height: 100%;
  min-height: 0;
  ${scrollable}
`

export const shellCompactMax = '680px'
export const shellMediumMax = '760px'
export const shellWideMax = '880px'
