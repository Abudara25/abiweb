export default [
  {
    ignores: ['node_modules/**', 'js/vendor/**'],
  },
  {
    files: ['js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        console: 'readonly',
        confirm: 'readonly',
        IntersectionObserver: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        // Défini dans analytics-loader.js, appelé depuis cookie-banner.js.
        abiwebLoadAnalytics: 'readonly',
        // Chargés via js/vendor/gsap.min.js et ScrollTrigger.min.js.
        gsap: 'readonly',
        ScrollTrigger: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-undef': 'error',
    },
  },
  {
    files: ['api/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        process: 'readonly',
        Buffer: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-undef': 'error',
    },
  },
];
