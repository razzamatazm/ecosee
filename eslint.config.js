import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'demo-dist/', 'node_modules/', 'coverage/'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
