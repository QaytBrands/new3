import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const config = [
  { ignores: ["next-env.d.ts", ".next/**", "node_modules/**", "playwright-report/**", "test-results/**", ".data/**"] },
  ...coreWebVitals,
  ...typescript,
];

export default config;
