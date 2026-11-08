import type { Metadata } from 'next';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/jetbrains-mono/400.css';
import './globals.css';
export const metadata: Metadata = {
  metadataBase: new URL(process.env.CELLCAST_PUBLIC_URL || 'http://localhost:3000'),
  title: 'CellCast AI · Single-cell research workspace',
  description: 'Explore public single-cell studies, compare measured responses, and run scPlantLLM and scGPT locally in your browser.',
};
export default function Layout({children}:{children:React.ReactNode}) {return <html lang="en"><body>{children}</body></html>}
