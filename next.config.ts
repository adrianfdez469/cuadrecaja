import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/olvide-contraseña",
        destination: "/olvide-contrasena",
        permanent: true,
      },
      {
        source: "/restablecer-contraseña",
        destination: "/restablecer-contrasena",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
