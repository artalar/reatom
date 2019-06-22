module.exports = {
  presets: [
    [
      '@babel/env',
      {
        targets:
          process.env.BABEL_ENV === 'commonjs'
            ? 'ie 11'
            : 'last 2 Chrome versions',
      },
    ],
    '@babel/preset-flow',
    '@babel/typescript',
  ],
  plugins: [
    '@babel/plugin-proposal-class-properties',
    '@babel/proposal-object-rest-spread',
  ],
}
