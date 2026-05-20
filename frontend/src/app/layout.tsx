import type {Metadata} from 'next';
import {Geist, Geist_Mono} from 'next/font/google';
import {AppShell} from '@/components/app-shell';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Nendila Travel Explorers — Operations',
  description:
    'Internal operations preview: live departures, payment tracking, balances, and one immutable invoice per payment.',
  icons: {
    icon: [{url: '/nendila-logo.png', type: 'image/png'}],
    apple: [{url: '/nendila-logo.png', type: 'image/png'}],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en'>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
