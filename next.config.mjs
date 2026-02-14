/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
      timeout: 300 // زمان را به ۵ دقیقه (۳۰۰ ثانیه) افزایش می‌دهد
    },
  },
};

export default nextConfig;