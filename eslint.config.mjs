import js from "@eslint/js";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import parser from "@typescript-eslint/parser";
import google from "eslint-config-google";
import prettier from "eslint-plugin-prettier/recommended";
import pluginSecurity from "eslint-plugin-security";
import ts from "typescript-eslint";

delete google.rules["valid-jsdoc"];
delete google.rules["require-jsdoc"];

export default ts.config(
    google,
    js.configs.recommended,
    ...ts.configs.recommended,
    prettier,
    pluginSecurity.configs.recommended,
    {
        plugins: { "@typescript-eslint": typescriptEslint },
        languageOptions: {
            parser,
            parserOptions: {
                project: "tsconfig.json",
            },
        },
    },
    { ignores: ["*", "!src"] }
);
