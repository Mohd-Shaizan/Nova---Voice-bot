import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import jsxConfig from 'eslint-plugin-react/configs/jsx-runtime.js';

export default [
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.jsx'], // Include both .js and .jsx files
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true, // Enable JSX support
        },
      },
    },
    plugins: {
      react: jsxConfig.plugins.react, // Add React plugin for JSX
      '@next/next': nextPlugin,
    },
    rules: {
      ...jsxConfig.rules, // Apply JSX-specific rules
      '@next/next/no-html-link-for-pages': 'off', // Example Next.js rule
    },
    settings: {
      react: {
        version: 'detect', // Automatically detect React version
      },
    },
  },
];
