const config = {
  presets: ['@babel/typescript', '@babel/preset-react'],
  plugins: ['@babel/plugin-proposal-class-properties'],
}

if (process.env.NODE_ENV === 'test') {
  config.presets.push(['@babel/env', { targets: { node: '10' } }])
  config.plugins.push('@babel/proposal-object-rest-spread')
}

module.exports = config
