import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['client/dist', 'server/dist', 'node_modules'] },
  ...tseslint.configs.recommended,
);
