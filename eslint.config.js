import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'prefer-const': 'off',
      'no-empty': 'off',
      'no-constant-binary-expression': 'off',
      'no-useless-assignment': 'off',
      'no-var': 'off'
    }
  }
);
