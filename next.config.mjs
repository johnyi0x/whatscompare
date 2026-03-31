/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  async redirects() {
    return [
      { source: "/favicon.ico", destination: "/icon", permanent: false },
      { source: "/favicon.png", destination: "/icon", permanent: false },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "placehold.co", pathname: "/**" },
      { protocol: "https", hostname: "encrypted-tbn0.gstatic.com", pathname: "/**" },
      { protocol: "https", hostname: "encrypted-tbn1.gstatic.com", pathname: "/**" },
      { protocol: "https", hostname: "encrypted-tbn2.gstatic.com", pathname: "/**" },
      { protocol: "https", hostname: "encrypted-tbn3.gstatic.com", pathname: "/**" },
    ],
  },
};

export default nextConfig;
