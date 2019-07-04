module.exports =
  process.env.NODE_ENV === 'test'
    ? {
        presets: ['@babel/env', '@babel/preset-flow', '@babel/typescript'],
        plugins: [
          '@babel/plugin-proposal-class-properties',
          '@babel/proposal-object-rest-spread',
        ],
      }
    : {}
