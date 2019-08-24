const config = {
  presets: ['@babel/typescript'],
  plugins: ['@babel/plugin-proposal-class-properties'],
}

if (process.env.NODE_ENV === 'test') {
  config.presets.push(
    ['@babel/env', { targets: { node: '10' } }],
    '@babel/react',
  )
  config.plugins.push('@babel/proposal-object-rest-spread')
}

module.exports = config
