"use strict";

module.exports = {
  "rules": {
    "mozilla/no-aArgs": "warn",
    "mozilla/reject-importGlobalProperties": "warn",
    "mozilla/var-only-at-top-level": "warn",
    "block-scoped-var": "error",
    "camelcase": "warn",
    "comma-dangle": "off",
    "complexity": ["error", {"max": 20}],
    "curly": "error",
    "dot-location": ["warn", "property"],
    "indent-legacy": ["warn", 2, {"SwitchCase": 1}],
    "max-len": ["warn", 80, 2, {"ignoreUrls": true}],
    "max-nested-callbacks": ["error", 3],
    "new-cap": ["error", {"capIsNew": false}],
    "new-parens": "error",
    "no-extend-native": "error",
    "no-fallthrough": "error",
    "no-inline-comments": "warn",
    "no-mixed-spaces-and-tabs": "error",
    "no-multi-spaces": "warn",
    "no-multi-str": "warn",
    "no-multiple-empty-lines": ["warn", {"max": 1}],
    "no-return-assign": "error",
    "no-sequences": "error",
    "no-shadow": "warn",
    "no-throw-literal": "error",
    "no-unused-vars": "error",
    "padded-blocks": ["warn", "never"],
    "quotes": ["warn", "double", "avoid-escape"],
    "semi": ["warn", "always"],
    "semi-spacing": ["warn", {"before": false, "after": true}],
    "space-in-parens": ["warn", "never"],
    "strict": ["error", "global"],
    "yoda": "error"
  }
};
