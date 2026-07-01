import js from '@eslint/js'
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

const tsBaseConfig = {
  files: ['**/*.{ts,tsx}'],
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      ecmaFeatures: { jsx: true }
    },
    globals: {
      ...globals.browser,
      ...globals.node
    }
  },
  plugins: {
    '@typescript-eslint': tsPlugin
  },
  rules: {
    ...tsPlugin.configs.recommended.rules,
    'no-undef': 'off',
    'no-redeclare': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
    ],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-require-imports': 'off',
    '@typescript-eslint/no-empty-object-type': 'off'
  }
}

const reactConfig = {
  files: ['src/renderer/**/*.{ts,tsx}'],
  plugins: {
    react,
    'react-hooks': reactHooks
  },
  settings: {
    react: { version: 'detect' }
  },
  rules: {
    ...react.configs.recommended.rules,
    ...reactHooks.configs.recommended.rules,
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'react/no-unescaped-entities': 'off',
    'react/no-unknown-property': [
      'error',
      { ignore: ['partition', 'useragent', 'allowpopups', 'webpreferences'] }
    ]
  }
}

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      'out/**',
      'release/**',
      'dist/**',
      'node_modules/**',
      'docs/**',
      'coverage/**',
      'scripts/**',
      '**/*.d.ts'
    ]
  },
  js.configs.recommended,
  tsBaseConfig,
  reactConfig
]
