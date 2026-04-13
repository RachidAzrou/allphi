import type { NextConfig } from "next";
import withPWA from "next-pwa";

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

/**
 * next-pwa injecteert een `webpack`-config. Next.js 16 gebruikt standaard Turbopack;
 * die combinatie geeft een fout zolang die webpack-hook bestaat.
 *
 * - `next dev`: geen withPWA → geen webpack-hook → Turbopack is ok.
 * - `next build`: withPWA actief → gebruik `npm run build` (`next build --webpack`).
 */
const isProdBuild = process.env.NODE_ENV === "production";

export default isProdBuild
  ? withPWA({
      dest: "public",
      register: true,
      skipWaiting: true,
    })(nextConfig)
  : nextConfig;
