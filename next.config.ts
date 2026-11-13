import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Todo el contenido es dinámico y sensible: no se usa caché de componentes.
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
