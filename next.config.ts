import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import {
  CLINICAL_LIVE_PROFILE,
  CLINICAL_WARM_PROFILE,
} from "./src/lib/clinical-cache";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  cacheComponents: true,
  cacheLife: {
    [CLINICAL_LIVE_PROFILE]: {
      stale: 30,
      revalidate: 30,
      expire: 300,
    },
    [CLINICAL_WARM_PROFILE]: {
      stale: 60,
      revalidate: 60,
      expire: 600,
    },
  },
  reactCompiler: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
    proxyClientMaxBodySize: "50mb",
  },
};

export default withSerwist(nextConfig);
