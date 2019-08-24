Do not follow this tests (it may be biased), it is only for library author

> the more the better

### v4

Average from 24 times

```js
var a = {
  "createStore": {
    "[redux]": "100%",
    "[reatom]": "39%",
    "[effector]": "40%"
  },
  "dispatch without subscribers (init)": {
    "[redux]": "100%",
    "[reatom]": "38%",
    "[effector]": "11%"
  },
  "dispatch without subscribers": {
    "[redux]": "100%",
    "[reatom]": "42%",
    "[effector]": "24%"
  },
  "subscribe": {
    "[redux]": "64%",
    "[reatom]": "100%",
    "[effector]": "17%" 
  },
  "dispatch with many subscriptions": {
    "[redux]": "100%",
    "[reatom]": "84%",
    "[effector]": "42%"
  },
  "dispatch with little subscriptions": {
    "[redux]": "36%",
    "[reatom]": "48%",
    "[effector]": "100%"
  },
  "dispatch untracked action": {
    "[redux]": "11%",
    "[reatom]": "100%",
    "[effector]": "82%"
  },
  "unsubscribe": {
    "[redux]": "96%",
    "[reatom]": "92%",
    "[effector]": "100%"
  }
};

```

### v3

Average from 82 times

|               (index)               | [redux] | [reatom] | [effector] |
|-------------------------------------|---------|----------|------------|
|             createStore             | '100%'  |  '12%'   |   '20%'    |
| dispatch without subscribers (init) | '100%'  |  '25%'   |   '18%'    |
|    dispatch without subscribers     | '100%'  |  '32%'   |   '21%'    |
|              subscribe              |  '64%'  |  '100%'  |    '8%'    |
|  dispatch with many subscriptions   | '100%'  |  '93%'   |   '38%'    |
| dispatch with little subscriptions  |  '31%'  |  '53%'   |   '100%'   |
|      dispatch untracked action      |  '8%'   |  '91%'   |   '100%'   |
|             unsubscribe             |  '98%'  |  '100%'  |   '79%'    |