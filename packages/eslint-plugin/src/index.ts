import { actionRule } from './rules/action-rule'
import { atomPostfixRule } from './rules/atom-postifx-rule'
import { atomRule } from './rules/atom-rule'
import { reatomPrefixRule } from './rules/reatom-prefix-rule'
import { asyncRule } from './rules/async-rule'

export const rules = {
  'atom-rule': atomRule,
  'action-rule': actionRule,
  'reatom-prefix-rule': reatomPrefixRule,
  'atom-postfix-rule': atomPostfixRule,
  'async-rule': asyncRule,
}

export const configs = {
  recommended: {
    rules: {
      '@reatom/atom-rule': 'error',
      '@reatom/action-rule': 'error',
      '@reatom/reatom-prefix-rule': 'error',
      '@reatom/atom-postfix-rule': 'error',
      '@reatom/async-rule': 'error',
    },
  },
}
