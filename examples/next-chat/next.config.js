const withPreact = require('next-plugin-preact')

module.exports = withPreact({
  typescript: {
    ignoreDevErrors: true,
  },
})
