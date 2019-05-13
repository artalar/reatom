const fs = require('fs')
const path = require('path')

const logData = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'src', '__tests__', 'log.json')),
)

function median(values) {
  if (values.length === 0) return 0

  values = values.map(v => +v)

  values.sort((a, b) => a - b)

  var half = Math.floor(values.length / 2)

  if (values.length % 2) return values[half]

  return (values[half - 1] + values[half]) / 2.0
}

function average(values) {
  return (values.reduce((acc, v) => acc + +v, 0) / values.length).toFixed(3)
}

function targetsAverage(targetsValues) {
  const targetsValuesAverage = targetsValues.map(median)
  const min = Math.min(...targetsValuesAverage)
  return targetsValuesAverage.map(v => ((min / +v) * 100).toFixed(0) + '%')
}

let times = 0
const displayData = Object.entries(logData).reduce(
  (acc, [testName, testData]) => {
    const targetsNames = Object.keys(testData)
    const targetsValues = Object.values(testData)
    const targetsValuesAverage = targetsAverage(targetsValues)
    times = targetsValues[0].length

    acc[testName] = targetsNames.reduce(
      (acc, k, i) => ((acc[k] = targetsValuesAverage[i]), acc),
      {},
    )

    return acc
  },
  {},
)

console.log('\n', 'Average from', times, 'times')
console.table(displayData)
