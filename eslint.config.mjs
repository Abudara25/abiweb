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
        requestAnimationFrame: 'readonly',
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
    // Code reellement execute en prod (Cloudflare Workers) : le routeur
    // _worker.js et les handlers functions/api/*.js qu'il importe. L'ancien
    // dossier api/*.js (format serverless Vercel, req/res) a ete supprime le
    // 2026-09-03 - il n'etait plus utilise depuis la migration vers
    // Cloudflare et n'implementait meme plus la verification Turnstile.
    files: ['_worker.js', 'functions/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        fetch: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        AbortSignal: 'readonly',
        TextEncoder: 'readonly',
        btoa: 'readonly',
        crypto: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-undef': 'error',
    },
  },
];
