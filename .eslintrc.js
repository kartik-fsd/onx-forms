module.exports = {
    "extends": [
        "plugin:preact/recommended"
    ],
    "settings": {
        "react": {
            "pragma": "h",  // For Preact, use h instead of React.createElement
            "version": "detect"
        }
    },
    "parserOptions": {
        "ecmaVersion": 2020,
        "sourceType": "module",
        "ecmaFeatures": {
            "jsx": true
        }
    },
    "plugins": [
        "preact",
        "react-hooks",
        "jsx-a11y"
    ],
    "rules": {
        // Enforce consistent JSX formatting
        "jsx-quotes": ["error", "prefer-double"],
        "preact/jsx-pascal-case": "error",

        // Prevent common errors
        "no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
        "no-console": ["warn", { "allow": ["warn", "error"] }],
        "no-debugger": "warn",

        // Enforce hook rules
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn",

        // Accessibility
        "jsx-a11y/alt-text": "warn",
        "jsx-a11y/click-events-have-key-events": "warn",

        // Best practices
        "preact/no-unknown-property": "error",
        "preact/jsx-key": "error",
        "eqeqeq": ["warn", "always", { "null": "ignore" }],
        "prefer-const": "warn",
        "prefer-destructuring": "warn"
    }
};