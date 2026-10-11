import type {Metadata} from 'next';
import {Geist, Geist_Mono} from 'next/font/google';
import {LayoutRouter} from '@/components/layout-router';
import {ServiceWorkerRegister} from '@/components/sw-register';
import {ToastProvider} from '@/components/ui/toast';
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
  title: 'Travel Agency — Operations',
  description:
    'Operations: live departures, payment tracking, balances, and one invoice per payment.',
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
        <ToastProvider>
          <LayoutRouter authEnabled={isAuthEnabled()} session={clientSession}>
            {children}
          </LayoutRouter>
        </ToastProvider>
      </body>
    </html>
  );
}
