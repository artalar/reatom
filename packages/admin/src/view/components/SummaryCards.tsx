import type { Admin } from '../../index'
import { formatRelativeCount } from '../format'
import {
  badge,
  cardRaised,
  colors,
  flex,
  flexWrap,
  gap,
  hideInCompactShell,
  p,
  rounded,
} from '../styles'

export interface SummaryCardsProps {
  admin: Admin
}

interface SummaryItem {
  label: string
  value: string
  tone: 'default' | 'accent' | 'success' | 'warning' | 'error'
}

function getToneColors(tone: SummaryItem['tone']): {
  background: string
  borderColor: string
  textColor: string
} {
  switch (tone) {
    case 'accent':
      return {
        background: colors.accentSoft,
        borderColor: colors.accent,
        textColor: colors.accent,
      }
    case 'success':
      return {
        background: colors.successSoft,
        borderColor: colors.success,
        textColor: colors.success,
      }
    case 'warning':
      return {
        background: colors.warningSoft,
        borderColor: colors.warning,
        textColor: colors.warning,
      }
    case 'error':
      return {
        background: colors.errorSoft,
        borderColor: colors.error,
        textColor: colors.error,
      }
    default:
      return {
        background: colors.surface,
        borderColor: colors.borderStrong,
        textColor: colors.text,
      }
  }
}

export const SummaryCards = ({ admin }: SummaryCardsProps) => {
  const summary = () => admin.view.summary()

  const items = (): Array<SummaryItem> => [
    {
      label: 'Captured',
      value: formatRelativeCount(summary().totalFrames, 'frame'),
      tone: 'accent',
    },
    {
      label: 'Visible',
      value: formatRelativeCount(summary().visibleFrames, 'frame'),
      tone: 'success',
    },
    {
      label: 'Hidden',
      value: formatRelativeCount(summary().hiddenFrames, 'frame'),
      tone: 'warning',
    },
    {
      label: 'Errors',
      value: formatRelativeCount(summary().errorFrames, 'error'),
      tone: summary().errorFrames > 0 ? 'error' : 'default',
    },
    {
      label: 'Atoms',
      value: formatRelativeCount(summary().uniqueAtoms, 'atom'),
      tone: 'default',
    },
  ]

  return (
    <div
      css={`
        display: flex;
        gap: 0.65rem;
        overflow-x: auto;
        overscroll-behavior-x: contain;
        padding-bottom: 0.15rem;
        scrollbar-width: thin;

        @container admin-shell (min-width: 681px) {
          ${flex}
          ${gap(2)}
          ${flexWrap}
          overflow-x: visible;
          padding-bottom: 0;
        }
      `}
    >
      {() =>
        items().map((item) => {
          const toneColors = getToneColors(item.tone)
          return (
            <section
              css={`
                ${cardRaised}
                ${p(2)}
                min-width: 9rem;
                flex: 1 1 10rem;

                @container admin-shell (max-width: 680px) {
                  min-width: 5.75rem;
                  flex: 0 0 auto;
                  padding: 0.55rem 0.65rem;
                }
              `}
            >
              <div
                css={`
                  ${badge}
                  width: fit-content;
                  background: ${toneColors.background};
                  border-color: ${toneColors.borderColor};
                  color: ${toneColors.textColor};

                  @container admin-shell (max-width: 680px) {
                    font-size: 0.62rem;
                    padding-inline: 0.35rem;
                    padding-block: 0.25rem;
                  }
                `}
              >
                {item.label}
              </div>
              <div
                css={`
                  margin-top: 0.75rem;
                  font-size: 1.2rem;
                  font-weight: 700;
                  color: ${colors.text};

                  @container admin-shell (max-width: 680px) {
                    margin-top: 0.35rem;
                    font-size: 0.95rem;
                  }
                `}
              >
                {item.value}
              </div>
              <div
                css={`
                  ${hideInCompactShell}
                  margin-top: 0.4rem;
                  ${rounded}
                  color: ${colors.textSubtle};
                  font-size: 0.72rem;
                `}
              >
                {item.label === 'Visible'
                  ? 'after all current filters'
                  : item.label === 'Hidden'
                    ? 'filtered from the main activity feed'
                    : item.label === 'Captured'
                      ? 'current session data source'
                      : item.label === 'Errors'
                        ? 'frames with a captured error'
                        : 'distinct atoms in the workspace'}
              </div>
            </section>
          )
        })
      }
    </div>
  )
}
