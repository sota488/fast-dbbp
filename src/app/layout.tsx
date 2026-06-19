import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Fast DBBP',
  description: 'Fast DBBP 練習アプリ',
  openGraph: {
    title: 'Fast DBBP',
    description: 'Fast DBBP 練習アプリ',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
