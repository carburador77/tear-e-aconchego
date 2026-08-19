import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite que o celular acesse o servidor de desenvolvimento pela rede local/Tailscale.
  allowedDevOrigins: ["100.76.66.69"],
};

export default nextConfig;
