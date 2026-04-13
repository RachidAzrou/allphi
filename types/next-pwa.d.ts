declare module "next-pwa" {
  function withPWA(pluginOptions?: Record<string, unknown>): (
    nextConfig: import("next").NextConfig,
  ) => import("next").NextConfig;
  export default withPWA;
}
