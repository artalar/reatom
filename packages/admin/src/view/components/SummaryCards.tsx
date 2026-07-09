import type { Admin } from '../../index'
import { formatRelativeCount } from '../format'
import { colors, flex, flexWrap, gap, statChip } from '../styles'

export interface SummaryCardsProps {
  admin: Admin
}

interface SummaryItem {
  label: string
  value: string
  tone: 'default' | 'error'
}

export const SummaryCards = ({ admin }: SummaryCardsProps) => {
  const summary = () => admin.view.summary()

  const items = (): Array<SummaryItem> => [
    {
      label: 'Captured',
      value: formatRelativeCount(summary().totalFrames, 'frame'),
      tone: 'default',
    },
    {
      label: 'Visible',
      value: formatRelativeCount(summary().visibleFrames, 'frame'),
      tone: 'default',
    },
    {
      label: 'Hidden',
      value: formatRelativeCount(summary().hiddenFrames, 'frame'),
      tone: 'default',
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
      data-testid="summary-metrics"
      css={`
        ${flex}
        ${gap(1)}
        ${flexWrap}
        align-items: center;
        min-width: 0;
      `}
    >
      {() =>
        items().map((item) => {
          const isError = item.tone === 'error'
          return (
            <span
              css={`
                ${statChip}
                border-color: ${isError ? colors.error : colors.border};
                background: ${isError ? colors.errorSoft : colors.bg};
                color: ${isError ? colors.error : colors.textMuted};
              `}
            >
              <span
                css={`
                  text-transform: uppercase;
                  letter-spacing: 0.02em;
                  font-size: 0.62rem;
                  color: ${isError ? colors.error : colors.textSubtle};
                `}
              >
                {item.label}
              </span>
              <strong
                css={`
                  font-size: 0.74rem;
                  font-weight: 650;
                  color: ${isError ? colors.error : colors.text};
                  font-variant-numeric: tabular-nums;
                `}
              >
                {item.value}
              </strong>
            </span>
          )
        })
      }
    </div>
  )
}
