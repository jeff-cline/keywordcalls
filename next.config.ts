import type { NextConfig } from "next";
// Keep pdfkit external so it loads its own font-metric data files from node_modules at runtime
// (Next's server bundler otherwise rewrites the path and breaks Helvetica.afm loading).
const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit"],
};
export default nextConfig;
