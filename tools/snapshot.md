> the more the better

Average from 14 times

|               (index)               | [redux] | [steroid] | [effector] |
|-------------------------------------|---------|-----------|------------|
|             createStore             | '100%'  |  '37%'   |   '38%'    |
| dispatch without subscribers (init) | '100%'  |  '32%'   |   '12%'    |
|    dispatch without subscribers     | '100%'  |  '47%'   |   '35%'    |
|              subscribe              |  '62%'  |  '100%'  |   '66%'    |
|  dispatch with many subscriptions   | '100%'  |  '50%'   |   '35%'    |
| dispatch with little subscriptions  |  '44%'  |  '40%'   |   '100%'   |
|      dispatch untracked action      |  '14%'  |  '100%'  |   '77%'    |
|             unsubscribe             |  '99%'  |  '82%'   |   '100%'   |
