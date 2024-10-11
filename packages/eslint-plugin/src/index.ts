import { ESLint } from 'eslint'
import { asyncRule } from './rules/async-rule'
import { unitNamingRule } from './rules/unit-naming-rule'
import { wrapScheduleInsteadOfCtxScheduleRule } from './rules/wrap-schedule-instead-of-ctx-schedule-rule'

const rules = {
  'unit-naming-rule': unitNamingRule,
  'async-rule': asyncRule,
  'wrap-schedule-instead-of-ctx-schedule-rule': wrapScheduleInsteadOfCtxScheduleRule,
}

export default {
  rules,
  configs: {
    recommended: {
      rules: Object.fromEntries(
        Object.keys(rules).map((ruleName) => {
          return [`@reatom/${ruleName}`, 'error']
        }),
      ),
    },
  },
} satisfies ESLint.Plugin
