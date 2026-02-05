import {defineConfig} from 'eslint/config';
import eslintConfigInclusiveDesign from '@inclusive-design/eslint-config';

export default defineConfig([
	{
		ignores: ['coverage/*.js', 'README.md'],
	},
	{
		extends: [eslintConfigInclusiveDesign],
		rules: {
			camelcase: ['error', {properties: 'never'}],
		},
	},
]);
