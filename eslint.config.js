import { defineConfig } from 'eslint/config';
import eslintConfigInclusiveDesign from '@inclusive-design/eslint-config';

export default defineConfig([
	{
		ignores: ['coverage/*.js', 'README.md'],
	},
	{
		extends: [eslintConfigInclusiveDesign],
		rules: {
			camelcase: ['error', { properties: 'never' }],
			'require-unicode-regexp': 'off',
			'regexp/no-super-linear-move': 'off',
			'regexp/prefer-named-capture-group': 'off',
		},
	},
]);
