import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // src/components/ui/** is shadcn scaffolding: generated vendor-style code
  // the user never wrote. Linting it trips the platform's build gate on
  // noise (e.g. no-explicit-any in newly added shadcn components) and feeds
  // an AI "fix" loop against code that shouldn't change — every retry
  // billed. Ignore it wholesale; the user's own code stays fully linted.
  { ignores: ["dist", "src/components/ui/**"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": "off",
      // Cấm màu hex tuỳ ý trong class Tailwind (vd. bg-[#f47b20]); dùng token brand-navy/brand-orange.
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/\\[#[0-9a-fA-F]{3,8}\\]/]",
          message: "Không dùng màu hex tuỳ ý trong class; dùng token (brand-navy, brand-orange, primary…).",
        },
        {
          selector: "TemplateElement[value.raw=/\\[#[0-9a-fA-F]{3,8}\\]/]",
          message: "Không dùng màu hex tuỳ ý trong class; dùng token (brand-navy, brand-orange, primary…).",
        },
      ],
    },
  }
);
