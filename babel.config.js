module.exports = {
  presets: [
    [
      '@babel/env',
      {
        targets: {
          browsers: [
            process.env.BABEL_ENV === 'commonjs'
              ? 'ie 11'
              : 'last 2 Chrome versions',
          ],
        },
      },
    ],
    "@babel/preset-flow"
  ],
  plugins: ['@babel/plugin-proposal-class-properties'],
};