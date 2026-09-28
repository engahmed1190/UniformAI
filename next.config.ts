import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev badge sits in the corner the ERP assistant's launcher uses, and
  // the client demo may well run on `npm run dev`.
  devIndicators: false,
};

export default nextConfig;
