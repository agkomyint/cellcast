import type { NextConfig } from 'next';
const config: NextConfig = { async headers() { return [{source:'/:path*',headers:[{key:'Cross-Origin-Opener-Policy',value:'same-origin'},{key:'Cross-Origin-Embedder-Policy',value:'require-corp'}]}]; } };
export default config;
