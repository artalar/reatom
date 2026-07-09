import type { Admin } from '../../index'
import { FilterEditor } from '../components/FilterEditor'
import { colors, screenRoot } from '../styles'

export interface FiltersScreenProps {
  admin: Admin
}

export const FiltersScreen = ({ admin }: FiltersScreenProps) => {
  return (
    <div
      data-reatom-name="FiltersScreen"
      css={`
        ${screenRoot}
        display: grid;
        gap: 1rem;
        align-content: start;
        align-items: start;
        color: ${colors.text};
        overscroll-behavior: contain;
      `}
    >
      <FilterEditor admin={admin} />
    </div>
  )
}
