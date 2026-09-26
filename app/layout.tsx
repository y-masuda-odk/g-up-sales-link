import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'G-UP Sales Link',
  description: '営業現場の課題とグループ・パートナーの商材をAIでつなぐ営業連携ツール',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}
