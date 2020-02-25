const pluginTester = require('babel-plugin-tester')
const path = require('path')

const plugin = require('../')

pluginTester({
  plugin,
  fixtures: path.join(__dirname, 'fixtures'),
  endOfLine: 'auto',
})
