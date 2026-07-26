import withBundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzerConfig = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typedRoutes: false,
  typescript: {
    ignoreBuildErrors: true, // Bun workspace hoists duplicate next types; type-check runs separately via bun run type-check
  },
  async redirects() {
    return [];
  },
};

export default withBundleAnalyzerConfig(nextConfig);
