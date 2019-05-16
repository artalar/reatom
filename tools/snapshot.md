> the more the better

Average from 60 times

|               (index)               | [redux] | [steroid] | [effector] |
|-------------------------------------|---------|-----------|------------|
|             createStore             | '100%'  |   '34%'   |   '35%'    |
| dispatch without subscribers (init) | '100%'  |   '44%'   |   '12%'    |
|    dispatch without subscribers     | '100%'  |   '62%'   |   '39%'    |
|              subscribe              |  '57%'  |  '100%'   |   '59%'    |
|  dispatch with many subscriptions   | '100%'  |   '57%'   |   '36%'    |
| dispatch with little subscriptions  |  '51%'  |   '50%'   |   '100%'   |
|      dispatch untracked action      |  '9%'   |  '100%'   |   '42%'    |
|             unsubscribe             |  '83%'  |  '100%'   |   '78%'    |
