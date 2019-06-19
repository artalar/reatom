> the more the better

Average from 63 times

|               (index)               | [redux] | [flaxom] | [effector] |
|-------------------------------------|---------|----------|------------|
|             createStore             | '100%'  |  '13%'   |   '31%'    |
| dispatch without subscribers (init) | '100%'  |  '19%'   |   '14%'    |
|    dispatch without subscribers     | '100%'  |  '33%'   |   '32%'    |
|              subscribe              |  '57%'  |  '100%'  |   '17%'    |
|  dispatch with many subscriptions   | '100%'  |  '77%'   |   '56%'    |
| dispatch with little subscriptions  |  '40%'  |  '54%'   |   '100%'   |
|      dispatch untracked action      |  '10%'  |  '84%'   |   '100%'   |
|             unsubscribe             |  '91%'  |  '96%'   |   '100%'   |
