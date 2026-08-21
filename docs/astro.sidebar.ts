import type { StarlightIcon } from '@astrojs/starlight/types'

import { group } from './config/sidebar'

export const sidebar = [
  group('Start', {
    badge: icon('rocket'),
    items: [
      'start/base',
      'start/actions',
      'start/extensions',
      'start/forms',
      'start/routing',
      'start/tooling',
    ],
  }),

  group('Handbook', {
    badge: icon('open-book'),
    items: [
      'handbook/history',
      'handbook/atomization',
      'handbook/extensions',
      'handbook/async-context',
      'handbook/async',
      'handbook/suspense',
      'handbook/lifecycle',
      'handbook/routing',
      'handbook/computed-factory',
      'handbook/persist',
      'handbook/sampling',
      'handbook/ux',
      {
        label: 'Forms',
        items: [
          'handbook/forms/introduction',
          'handbook/forms/comparison',
          {
            label: 'Concepts',
            items: [
              'handbook/forms/concepts/field-atom',
              'handbook/forms/concepts/reactive-validation',
              'handbook/forms/concepts/field-array',
              'handbook/forms/concepts/fieldset',
              'handbook/forms/concepts/form',
            ],
          },
          {
            label: 'Recipes',
            items: [
              'handbook/forms/recipes/async-default-values',
              'handbook/forms/recipes/async-validation-debounce',
              'handbook/forms/recipes/auto-submit',
              'handbook/forms/recipes/handling-submit-errors',
              'handbook/forms/recipes/dependent-validation',
              'handbook/forms/recipes/focus-management',
              'handbook/forms/recipes/errors-ux',
              'handbook/forms/recipes/fields-factory',
              'handbook/forms/recipes/abstract-components',
              'handbook/forms/recipes/compound-fields',
              // 'handbook/forms/recipes/wizard-forms',
              // 'handbook/forms/recipes/persistence',
            ],
          },
          // 'handbook/forms/migration/react-hook-form'
        ],
      },
    ],
  }),

  group('Guides', {
    badge: icon('puzzle'),
    items: [
      {
        autogenerate: {
          directory: 'guides',
        },
      },
    ],
  }),

  group('Reference', {
    badge: icon('information'),
    items: [
      {
        label: '@reatom/core',
        collapsed: false,
        items: [
          {
            label: 'Core API',
            link: '/reference/core',
          },
          {
            label: 'Async',
            link: '/reference/async',
          },
          {
            label: 'Forms',
            link: '/handbook/forms/introduction',
          },
          {
            label: 'Routing',
            link: '/reference/routing',
          },
          {
            label: 'Persistence',
            link: '/handbook/persist',
          },
          {
            label: 'Primitives',
            link: '/reference/primitives',
          },
          {
            label: 'Methods',
            link: '/reference/methods',
          },
          {
            label: 'Extensions',
            link: '/reference/extensions',
          },
          {
            label: 'Web Utilities',
            link: '/reference/web',
          },
          {
            label: 'Utils',
            link: '/reference/utils',
          },
        ],
      },
      {
        label: '@reatom/react',
        link: '/reference/react',
      },
      // {
      //   label: '@reatom/vue',
      //   link: '/reference/vue',
      // },
      // {
      //   label: '@reatom/lit',
      //   link: '/reference/lit',
      // },
      {
        label: '@reatom/preact',
        link: '/reference/preact',
      },
      {
        label: '@reatom/jsx',
        link: '/reference/jsx',
      },
      {
        label: '@reatom/vite',
        link: '/reference/vite',
      },
      {
        label: '@reatom/zod',
        link: '/reference/zod',
      },
    ],
  }),
]
function icon(iconName: StarlightIcon) {
  return iconName
}
