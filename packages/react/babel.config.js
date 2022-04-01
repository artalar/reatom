const config = {
  presets: [
    '@babel/preset-react',
    '@babel/preset-typescript',
    '@babel/preset-env',
  ],
  // plugins: [
  //   '@babel/plugin-syntax-jsx',
  //   '@babel/plugin-transform-flow-strip-types',
  //   '@babel/plugin-transform-react-jsx',
  // ],
}

if (process.env.NODE_ENV === 'test') {
  config.presets.pop()
  config.presets.push(['@babel/preset-env', { targets: { node: '16' } }])
}

module.exports = config
