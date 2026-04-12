import js from '@eslint/js'
import ts from 'typescript-eslint'
import vue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'

export default [
  // Ignorar archivos generados y de configuración
  {
    ignores: [
      'dist/**',
      '.wrangler/**',
      'migrations/**',
      'node_modules/**',
    ],
  },

  // Base JS
  js.configs.recommended,

  // Worker (TypeScript puro)
  ...ts.configs.recommended.map(config => ({
    ...config,
    files: ['src/worker/**/*.ts'],
  })),
  {
    files: ['src/worker/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.worker.json',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': 'warn',
    },
  },

  // Frontend Vue + TypeScript
  ...ts.configs.recommended.map(config => ({
    ...config,
    files: ['src/frontend/**/*.{ts,vue}'],
  })),
  ...vue.configs['flat/recommended'].map(config => ({
    ...config,
    files: ['src/frontend/**/*.vue'],
  })),
  {
    files: ['src/frontend/**/*.{ts,vue}'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: ts.parser,
        project: './tsconfig.json',
        extraFileExtensions: ['.vue'],
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'vue/multi-word-component-names': 'off',   // las views tienen nombres simples
      'vue/require-default-prop': 'off',
      'vue/max-attributes-per-line': 'off',      // los SVGs inline quedan en una línea
      'vue/html-closing-bracket-spacing': 'off', // estilo, no bug
      'vue/html-self-closing': 'off',            // estilo
      'vue/singleline-html-element-content-newline': 'off',
      'no-console': 'warn',
    },
  },
]
