import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'G-UP Sales Link',
  description: '営業部隊をまたいで案件と商材を共有する営業連携ツール',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
