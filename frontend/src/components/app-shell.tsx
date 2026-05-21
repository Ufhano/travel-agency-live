'use client';

import Link from 'next/link';
import Image from 'next/image';
import {usePathname, useRouter} from 'next/navigation';
import {
  FileText,
  LayoutDashboard,
  LogOut,
  Settings,
  Upload,
  Users,
} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {cn} from '@/lib/utils';
import type {SessionPayload} from '@/lib/session-token';

const nav = [
  {href: '/', label: 'Dashboard', icon: LayoutDashboard},
  {href: '/clients', label: 'Clients', icon: Users},
  {href: '/invoices', label: 'Invoices', icon: FileText},
  {href: '/import', label: 'Import', icon: Upload},
];

export function AppShell({
  children,
  authEnabled = false,
  session = null,
}: {
  children: React.ReactNode;
  authEnabled?: boolean;
  session?: SessionPayload | null;
}) {
  const pathname = usePathname() ?? '/';
  const router = useRouter();

  if (pathname === '/login') {
    return <>{children}</>;
  }

  const links =
    session?.role === 'admin'
      ? [...nav, {href: '/settings', label: 'Settings', icon: Settings}]
      : nav;

  async function signOut() {
    await fetch('/api/auth/logout', {method: 'POST'});
    router.push('/login');
    router.refresh();
  }

  return (
    <div className='min-h-screen bg-background'>
      <header className='no-print sticky top-0 z-40 border-b border-border/60 bg-card/75 backdrop-blur-md supports-[backdrop-filter]:bg-card/65'>
        <div className='mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:gap-4 sm:px-6'>
          <Link
            href='/'
            className={cn(
              'flex min-h-9 max-w-[min(100%,20rem)] flex-1 shrink items-center gap-0 sm:max-w-none sm:flex-none sm:gap-0',
              'rounded-xl border border-border/80 bg-gradient-to-b from-card to-card/90 text-card-foreground shadow-sm',
              'ring-1 ring-black/[0.03] transition-[border-color,box-shadow,background-color] duration-200',
              'hover:border-border hover:shadow-md',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              'dark:from-card dark:to-muted/25 dark:ring-white/[0.06]',
            )}
          >
            <span className='flex min-h-9 flex-1 items-center gap-2.5 px-2.5 py-1.5 sm:min-h-10 sm:gap-3 sm:px-3 sm:py-2'>
              <span className='relative h-8 w-[7.25rem] shrink-0 sm:h-9 sm:w-[8.75rem]'>
                <Image
                  src='/nendila-logo.png'
                  alt='Nendila Travel & Explorers'
                  fill
                  className={cn(
                    'object-contain object-left',
                    'mix-blend-multiply contrast-105 dark:mix-blend-normal dark:contrast-100 dark:brightness-[1.06]',
                  )}
                  sizes='(max-width: 640px) 120px, 150px'
                  priority
                />
              </span>
              <span
                className='hidden h-6 w-px shrink-0 bg-border/70 sm:block'
                aria-hidden
              />
              <span className='hidden min-w-0 flex-col items-start gap-0.5 sm:flex lg:pr-0.5'>
                <span className='text-[11px] font-semibold leading-none tracking-tight text-foreground/90'>
                  {session?.displayName ?? 'Operations'}
                </span>
                <span className='text-[10px] font-normal leading-none text-muted-foreground'>
                  {session?.role === 'admin' ? 'Administrator' : 'Workspace'}
                </span>
              </span>
            </span>
          </Link>
          <nav className='flex shrink-0 items-center gap-0.5 sm:gap-1'>
            {links.map(({href, label, icon: Icon}) => {
              const active =
                href === '/' ? pathname === '/' : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors sm:px-3',
                    active
                      ? 'bg-muted/90 text-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                  )}
                >
                  <Icon className='h-4 w-4 shrink-0 opacity-90' />
                  <span className='hidden md:inline'>{label}</span>
                </Link>
              );
            })}
            {authEnabled ? (
              <Button
                type='button'
                variant='ghost'
                size='sm'
                className='ml-1 text-muted-foreground hover:text-foreground'
                onClick={() => void signOut()}
                title='Sign out'
              >
                <LogOut className='h-4 w-4' />
                <span className='hidden lg:inline'>Sign out</span>
              </Button>
            ) : null}
          </nav>
        </div>
      </header>
      <main className='mx-auto max-w-7xl px-4 py-8 sm:px-6'>{children}</main>
    </div>
  );
}
