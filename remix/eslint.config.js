import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import importPlugin from "eslint-plugin-import";
import jsxA11yPlugin from "eslint-plugin-jsx-a11y";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";

const commonGlobals = {
	console: "readonly",
	window: "readonly",
	document: "readonly",
	globalThis: "readonly",
	navigator: "readonly",
	location: "readonly",
	setTimeout: "readonly",
	clearTimeout: "readonly",
	setInterval: "readonly",
	clearInterval: "readonly",
	Request: "readonly",
	Response: "readonly",
	Headers: "readonly",
	fetch: "readonly",
	FormData: "readonly",
	AbortController: "readonly",
	ReadableStream: "readonly",
	WritableStream: "readonly",
	TransformStream: "readonly",
	WorkerGlobalScope: "readonly",
	describe: "readonly",
	it: "readonly",
	test: "readonly",
	expect: "readonly",
	beforeAll: "readonly",
	afterAll: "readonly",
	beforeEach: "readonly",
	afterEach: "readonly",
};

export default [
	{
		ignores: [
			"build/**",
			"public/**",
			".wrangler/**",
			"functions/**",
			"node_modules/**",
			"**/*.d.ts",
		],
	},
	{
		files: ["**/*.{js,jsx,ts,tsx}"],
		languageOptions: {
			parser: tsParser,
			ecmaVersion: "latest",
			sourceType: "module",
			parserOptions: {
				ecmaFeatures: {
					jsx: true,
				},
			},
			globals: commonGlobals,
		},
		plugins: {
			"@typescript-eslint": tsPlugin,
			import: importPlugin,
			"jsx-a11y": jsxA11yPlugin,
			react: reactPlugin,
			"react-hooks": reactHooksPlugin,
		},
		linterOptions: {
			reportUnusedDisableDirectives: "off",
		},
		settings: {
			react: {
				version: "detect",
			},
			formComponents: ["Form"],
			linkComponents: [
				{ name: "Link", linkAttribute: "to" },
				{ name: "NavLink", linkAttribute: "to" },
			],
			"import/internal-regex": "^~/",
			"import/resolver": {
				node: {
					extensions: [".js", ".jsx", ".ts", ".tsx"],
				},
				typescript: {
					alwaysTryTypes: true,
				},
			},
		},
		rules: {
			...tsPlugin.configs.recommended.rules,
			...importPlugin.configs.recommended.rules,
			...importPlugin.configs.typescript.rules,
			...jsxA11yPlugin.configs.recommended.rules,
			...reactPlugin.configs.recommended.rules,
			...reactPlugin.configs["jsx-runtime"].rules,
			...reactHooksPlugin.configs.recommended.rules,
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/no-empty-object-type": "off",
			"@typescript-eslint/no-empty-interface": "off",
			"import/no-unresolved": "off",
		},
	},
	{
		files: [".eslintrc.cjs"],
		languageOptions: {
			parser: tsParser,
			globals: {
				...commonGlobals,
				module: "writable",
				require: "readonly",
			},
		},
	},
];
