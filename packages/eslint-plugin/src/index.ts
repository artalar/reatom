import { actionRule } from "./rules/action-rule";
import { atomRule } from "./rules/atom-rule";
import { reatomPrefixRule } from "./rules/reatom-prefix-rule";

export const rules = {
    'atom-rule': atomRule,
    'action-rule': actionRule,
    'reatom-prefux-rule': reatomPrefixRule
}

export const configs = {
    'recommended': {
        rules: {
            '@reatom/atom-rule': 'error',
            '@reatom/action-rule': 'error',
            '@reatom/reatom-prefux-rule': 'error'
        }
    }
}
