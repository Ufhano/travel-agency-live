import type {Metadata} from 'next';
import {Geist, Geist_Mono} from 'next/font/google';
import {AppShell} from '@/components/app-shell';
import {ServiceWorkerRegister} from '@/components/sw-register';
import {isAuthEnabled} from '@/lib/auth-config';
import {getSession} from '@/lib/auth-server';
import {toClientSession} from '@/lib/session-token';
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

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let clientSession = null;
  try {
    clientSession = toClientSession(await getSession());
  } catch {
    clientSession = null;
  }

  return (
    <html lang='en'>
      <head>
        <link rel='manifest' href='/manifest.json' />
        <meta name='theme-color' content='#000000' />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans`}>
        <ServiceWorkerRegister />
        <AppShell authEnabled={isAuthEnabled()} session={clientSession}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
