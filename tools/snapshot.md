> the more the better

Average from 62 times

|               (index)               | [redux] | [steroid] | [effector] |
|-------------------------------------|---------|-----------|------------|
|             createStore             | '100%'  |   '39%'   |   '33%'    |
| dispatch without subscribers (init) | '100%'  |   '43%'   |   '14%'    |
|    dispatch without subscribers     | '100%'  |   '51%'   |   '33%'    |
|              subscribe              |  '51%'  |  '100%'   |   '51%'    |
|  dispatch with many subscriptions   | '100%'  |   '61%'   |   '37%'    |
| dispatch with little subscriptions  |  '43%'  |   '51%'   |   '100%'   |
|             unsubscribe             |  '78%'  |  '100%'   |   '77%'    |
