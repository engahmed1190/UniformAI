import type { Metadata } from 'next';
import { IBM_Plex_Sans_Arabic, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const sans = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
});

// Arabic UI. A Latin face falling back to a system Arabic font renders
// noticeably weaker than a face drawn for the script, so this is its own font.
const arabic = IBM_Plex_Sans_Arabic({
  variable: '--font-arabic',
  subsets: ['arabic'],
  weight: ['400', '500', '600'],
});

// Prices, quantities and order IDs only.
const mono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: 'UniformAI',
  description: 'Design, cost and order company uniforms.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${sans.variable} ${arabic.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
