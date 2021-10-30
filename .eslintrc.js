module.exports = {
  extends: ['react-app'],
  rules: {
    'no-console': 'error',
    '@typescript-eslint/no-unused-vars': ['error'],
    'prefer-const': 'error',
    'import/no-duplicates': 'error',
    'import/no-default-export': 'error',
    'import/order': [
      'error',
      {
        alphabetize: {
          order: 'asc',
          caseInsensitive: true,
        },
        'newlines-between': 'always',
        groups: [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index',
          'object',
        ],
      },
    ],
    'react-hooks/exhaustive-deps': [
      'warn',
      {
        additionalHooks: '(useAtom|useAction)',
      },
    ],
  },
}
