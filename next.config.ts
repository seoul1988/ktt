import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "10.0.0.74",
    "10.0.0.74:3000",
  ],

  experimental: {
    webpackBuildWorker: true,

    // 빌드 시 동시에 처리하는 페이지 수를 줄여
    // 메모리 사용량을 낮춤
    staticGenerationMaxConcurrency: 1,

    // worker 하나가 한 번에 처리하는 페이지 수
    staticGenerationMinPagesPerWorker: 1,
  },
};

export default nextConfig;
