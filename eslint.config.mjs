import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import reactHooksPlugin from 'eslint-plugin-react-hooks'

export default [
  {
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        browser: true,
        node: true,
        es2022: true,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...tsPlugin.configs['recommended-requiring-type-checking'].rules,
      ...reactHooksPlugin.configs.recommended.rules,

      'react-hooks/rules-of-hooks': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-ignore': true,
          'ts-expect-error': 'allow-with-description',
          'ts-nocheck': true,
          'ts-check': false,
        },
      ],
      '@typescript-eslint/consistent-type-imports': 'warn',
      '@typescript-eslint/no-floating-promises': 'off',
      'no-console': 'warn',
    },
    ignores: [
      'dist/**',
      'dist-electron/**',
      'build/**',
      'release/**',
      'node_modules/**',
      'vendor/**',
      'public/**',
      '*.config.{js,cjs,ts,mjs}',
      'scripts/**',
    ],
  },
  {
    files: ['electron/**/*'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
    languageOptions: {
      globals: { jest: true, node: true },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
]
