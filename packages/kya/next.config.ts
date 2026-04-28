import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // Transpile the workspace engine package — it ships CJS, Next bundles ESM.
  transpilePackages: ['@tpsdev/governance-engine'],
  // postgres.js loads native bindings via dynamic require; mark as external
  // so Next doesn't try to bundle it for the server build.
  serverExternalPackages: ['postgres'],
  experimental: {
    // Server Actions need a body-size limit override only if Sanna YAML
    // exports get large; keeping default for now.
  },
};

export default config;
