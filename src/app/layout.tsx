import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BevChat Hub - LINE OA Chat Management',
  description: 'ระบบรวมแชท LINE OA หลายเพจในที่เดียว',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}