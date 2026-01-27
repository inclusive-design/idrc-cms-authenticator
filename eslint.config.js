import {defineConfig} from 'eslint/config';
import eslintConfigInclusiveDesign from '@inclusive-design/eslint-config';

export default defineConfig([
	{
		extends: [eslintConfigInclusiveDesign],
		ignores: ['coverage/**', 'README.md'],
		rules: {
			camelcase: ['error', {properties: 'never'}],
		},
	},
]);
