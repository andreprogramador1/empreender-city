import type { NextConfig } from "next";

const securityHeaders = [
  // Allow embedding in iframes: same origin, dash.com.br (HTTP/HTTPS), localhost
  {
    key: "Content-Security-Policy",
    value:
      "frame-ancestors 'self' https://dash.com.br http://dash.com.br https://*.dash.com.br http://*.dash.com.br http://localhost https://localhost http://localhost:* https://localhost:* http://127.0.0.1 https://127.0.0.1 http://127.0.0.1:* https://127.0.0.1:*",
  },
  // Block MIME-type sniffing (e.g. treating a .txt as script)
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Control what info the Referer header leaks
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable unnecessary browser APIs
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  // Enable DNS prefetch for faster navigation
  { key: "X-DNS-Prefetch-Control", value: "on" },
  // Force HTTPS (browsers cache this for 2 years)
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "kxuhnbmureteruqbiubi.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
