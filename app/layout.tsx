import type { Metadata } from 'next';
import { Cairo, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const sans = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
});

// Arabic UI. A Latin face falling back to a system Arabic font renders
// noticeably weaker than a face drawn for the script, so this is its own font.
// Cairo: drawn for Arabic screen UI rather than adapted from a Latin family,
// so it holds up at the small sizes this interface uses -- table cells, field
// hints, the status pills. A variable axis, so weights cost nothing extra.
const arabic = Cairo({
  variable: '--font-arabic',
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
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
