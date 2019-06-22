> the more the better

Average from 82 times

|               (index)               | [redux] | [flaxom] | [effector] |
|-------------------------------------|---------|----------|------------|
|             createStore             | '100%'  |  '12%'   |   '20%'    |
| dispatch without subscribers (init) | '100%'  |  '25%'   |   '18%'    |
|    dispatch without subscribers     | '100%'  |  '32%'   |   '21%'    |
|              subscribe              |  '64%'  |  '100%'  |    '8%'    |
|  dispatch with many subscriptions   | '100%'  |  '93%'   |   '38%'    |
| dispatch with little subscriptions  |  '31%'  |  '53%'   |   '100%'   |
|      dispatch untracked action      |  '8%'   |  '91%'   |   '100%'   |
|             unsubscribe             |  '98%'  |  '100%'  |   '79%'    |