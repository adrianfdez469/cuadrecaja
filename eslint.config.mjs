import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

/**
 * Colour written inside an `sx` prop cannot respond to the theme, which is how
 * the app accumulated 108 distinct hex values for six meanings and why a dark
 * mode was impossible. Every colour belongs in `src/theme/tokens.ts`.
 *
 * Starts as a warning: ~360 literals predate the rule, and failing the build on
 * all of them would only get the rule switched off. It flips to "error" once the
 * per-screen migration has drained them.
 */
const NO_HARDCODED_COLOUR = [
  {
    selector:
      'JSXAttribute[name.name="sx"] Literal[value=/#[0-9a-fA-F]{3,8}\\b/]',
    message:
      "No escribas colores hexadecimales en sx. Usá theme.palette.semantic (src/theme/tokens.ts).",
  },
  {
    selector: 'JSXAttribute[name.name="sx"] Literal[value=/rgba?\\(/]',
    message:
      "No escribas rgba() en sx. Usá un token de src/theme/tokens.ts, o alpha() de MUI sobre un token.",
  },
  {
    selector:
      'JSXAttribute[name.name="sx"] TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b/]',
    message:
      "No interpoles colores hexadecimales en sx. Usá theme.palette.semantic (src/theme/tokens.ts).",
  },
];

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_"
      }],
      "no-restricted-syntax": ["warn", ...NO_HARDCODED_COLOUR]
    }
  },
  {
    // The theme is the one place a colour may be named.
    files: ["src/theme/**"],
    rules: { "no-restricted-syntax": "off" }
  }
];

export default eslintConfig;
