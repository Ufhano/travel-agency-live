'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {Compass, FileText, LayoutDashboard, Upload, Users} from 'lucide-react';
import {cn} from '@/lib/utils';

// i
const nav = [
  {href: '/', label: 'Dashboard', icon: LayoutDashboard},
  {href: '/clients', label: 'Clients', icon: Users},
  {href: '/invoices', label: 'Invoices', icon: FileText},
  {href: '/import', label: 'Import', icon: Upload},
];

export function AppShell({children}: {children: React.ReactNode}) {
  const pathname = usePathname() ?? '/';
  return (
    <div className='min-h-screen bg-background'>
      <header className='no-print sticky top-0 z-40 border-b bg-card/80 backdrop-blur-md'>
        <div className='mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6'>
          <Link href='/' className='flex items-center gap-2 font-semibold'>
            <span className='flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground'>
              <Compass className='h-5 w-5' aria-hidden />
            </span>
            <span className='hidden sm:inline'>
              Nendila Travel Explorers
              <span className='ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground'>
                Operations console
              </span>
            </span>
          </Link>
          <nav className='flex items-center gap-1'>
            {nav.map(({href, label, icon: Icon}) => {
              const active =
                href === '/' ? pathname === '/' : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  )}
                >
                  <Icon className='h-4 w-4' />
                  <span className='hidden md:inline'>{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className='mx-auto max-w-7xl px-4 py-8 sm:px-6'>{children}</main>
    </div>
  );
}
