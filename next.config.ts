import type { NextConfig } from 'next';

const config: NextConfig = {
  experimental: { cpus: 2 },
  async rewrites() {
    return [{ source: '/dashboards/stunting-literacy', destination: '/dashboards/stunting-literacy/index.html' }];
  },
};
export default config;
