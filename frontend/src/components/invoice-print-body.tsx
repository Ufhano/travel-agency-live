import type {PaymentWithContext} from '@backend/types';
import {Dancing_Script} from 'next/font/google';
import Image from 'next/image';
import {Mail, MapPin, Phone} from 'lucide-react';
import {InvoiceTodayDate} from '@/components/invoice-today-date';
import {formatZARInvoice, hasRealClientEmail} from '@/lib/utils';

const tagline = Dancing_Script({
  subsets: ['latin'],
  weight: ['400', '700'],
});

const TEAL_DEEP = '#00607A';
const TEAL_BRIGHT = '#20C9B7';

/** Recognisable WhatsApp brand mark (green); matches common app icon. */
function WhatsAppMark({className}: {className?: string}) {
  return (
    <svg
      className={className}
      viewBox='0 0 24 24'
      aria-hidden
      focusable='false'
    >
      <path
        fill='#25D366'
        d='M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z'
      />
    </svg>
  );
}

/** Wording preserved from Mulisa Mapfumo Lesotho template (.docx). */
const TERMS = [
  'A non- refundable deposit of R800-00 per person is payable to Secure the booking.',
  'The remaining amount should be paid in instalments.',
  'Note that the snow activities are not included on the package',
  '50% of the about must be paid 2 months before departure',
  'The full amount must be paid on or before 30 days of departure.',
  'Cancellations within 30 days of departure results to no refund.',
  'Cancellations due to what so ever reason when everything has been booked results to no refund, the only option available is for you to get a replacement from your side.',
  'No moving from one date to another or from one trip to another unless when we suggest it.',
  'Please note that it is your responsibility to make sure that you have a valid passport during the time of travelling.',
  'Note that the activities are not compulsory and Nendila Travel & Explorers will not be held responsible for any damages, loss and accidents that may occur during the activities.',
] as const;

function packageDescription(ctx: PaymentWithContext): string {
  const parts = [
    ctx.trip.name,
    ctx.trip.destination,
    ctx.trip.accommodationNote?.trim(),
    ctx.note?.trim(),
  ].filter((p): p is string => Boolean(p && p.length > 0));
  if (parts.length === 0) return 'Travel package';
  return parts.join(' — ');
}

/** First table column title — matches Word template (e.g. “Lesotho Package”). */
function packageColumnHeader(ctx: PaymentWithContext): string {
  const dest = ctx.trip.destination.trim();
  const name = ctx.trip.name.trim();
  const combined = `${dest} ${name}`.toLowerCase();
  if (combined.includes('lesotho')) return 'Lesotho Package';
  const base = dest || name;
  if (!base) return 'Package';
  return /\bpackage\b/i.test(base) ? base : `${base} Package`;
}

function clientContactLine(ctx: PaymentWithContext): string | null {
  if (!hasRealClientEmail(ctx.client.email)) return null;
  const email = ctx.client.email.trim();
  const phone = ctx.client.phone?.trim();
  const showPhone = phone && phone !== '—';
  return showPhone ? `${phone} · ${email}` : email;
}

export function InvoicePrintBody({
  ctx,
  variant = 'payment',
}: {
  ctx: PaymentWithContext;
  /** `payment` = single receipt. `partial` / `full` = client statement. */
  variant?: 'payment' | 'partial' | 'full';
}) {
  const desc = packageDescription(ctx);
  const packageHeader = packageColumnHeader(ctx);
  const contactLine = clientContactLine(ctx);
  const paid =
    variant === 'full'
      ? ctx.client.packagePrice
      : variant === 'partial'
        ? ctx.totalPaidAfter
        : ctx.amount;
  const balance =
    variant === 'full' ? 0 : ctx.balanceAfter;
  const ribbonLabel =
    variant === 'full'
      ? 'INVOICE — PAID IN FULL'
      : variant === 'partial'
        ? 'INVOICE — PARTIAL PAYMENT'
        : 'INVOICE';

  return (
    <div
      id='invoice-print'
      className='invoice-print relative mx-auto max-w-4xl overflow-visible border border-black/10 bg-white text-[13px] leading-normal text-slate-900 shadow-sm print:mx-0 print:max-w-none print:border-0 print:shadow-none'
      style={{color: '#0f172a'}}
    >
      {/* Decorative shapes — top left */}
      <div
        className='pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full opacity-[0.22] print:opacity-30'
        style={{
          background: `radial-gradient(circle, ${TEAL_BRIGHT} 0%, transparent 70%)`,
        }}
      />
      <div
        className='pointer-events-none absolute -left-8 top-24 h-56 w-56 rounded-full opacity-[0.14] print:opacity-22'
        style={{
          background: `radial-gradient(circle, ${TEAL_DEEP} 0%, transparent 68%)`,
        }}
      />
      <div
        className='pointer-events-none absolute left-32 top-0 h-40 w-[min(55%,20rem)] rounded-bl-[3rem] rounded-tr-[4rem] opacity-[0.12] print:opacity-18'
        style={{background: TEAL_BRIGHT}}
      />

      <div className='relative px-8 pb-10 pt-8 sm:px-12 sm:pt-10'>
        {/* Top bar: logo + INVOICE ribbon + company */}
        <div className='flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between'>
          <div className='max-w-md'>
            <div className='flex items-start gap-4'>
              <div className='relative h-24 w-24 shrink-0 sm:h-28 sm:w-28'>
                <Image
                  src='/nendila-logo.png'
                  alt='Nendila Travel & Explorers'
                  fill
                  className='object-contain'
                  sizes='(max-width: 640px) 96px, 112px'
                  priority
                />
              </div>
              <div className='min-w-0 pt-1'>
                <p
                  className='text-lg font-bold tracking-tight sm:text-xl'
                  style={{color: TEAL_DEEP}}
                >
                  Nendila Travel & Explorers
                </p>
                <p
                  className={`mt-0.5 text-lg sm:text-xl ${tagline.className}`}
                  style={{color: TEAL_BRIGHT}}
                >
                  Live, Travel & Explore!
                </p>
                <p className='mt-2 font-mono text-xs text-slate-600'>
                  Invoice no.{' '}
                  <span className='font-semibold text-slate-900'>
                    {ctx.invoiceNumber}
                  </span>
                </p>
              </div>
            </div>
          </div>

          <div className='flex flex-col items-stretch gap-4 lg:items-end'>
            <div
              className='print-color-exact self-end px-6 py-3 text-center text-base font-bold tracking-[0.12em] text-white sm:px-10 sm:text-xl sm:tracking-[0.2em]'
              style={{backgroundColor: TEAL_DEEP}}
            >
              {ribbonLabel}
            </div>

            <div
              className='space-y-2.5 text-sm lg:text-right'
              style={{color: TEAL_DEEP}}
            >
              <p className='font-bold leading-snug'>
                Nendila Travel and Explore (PTY) LTD
              </p>
              <p className='text-xs font-medium text-slate-700'>
                Reg No: 2021/548431/07
              </p>
              <ul className='mt-3 space-y-2 text-left text-[13px] text-slate-800 lg:text-right'>
                <li className='flex gap-2 lg:ml-auto lg:flex-row-reverse lg:justify-end'>
                  <Mail
                    className='mt-0.5 h-4 w-4 shrink-0'
                    style={{color: TEAL_BRIGHT}}
                  />
                  <a
                    href='mailto:Nendila.Travels@gmail.com'
                    className='break-all underline-offset-2 hover:underline'
                  >
                    Nendila.Travels@gmail.com
                  </a>
                </li>
                <li className='flex gap-2 lg:ml-auto lg:flex-row-reverse lg:justify-end'>
                  <Phone
                    className='mt-0.5 h-4 w-4 shrink-0'
                    style={{color: TEAL_BRIGHT}}
                  />
                  <span>+27 72 145 8530</span>
                </li>
                <li className='flex gap-2 lg:ml-auto lg:flex-row-reverse lg:justify-end'>
                  <WhatsAppMark className='mt-0.5 h-4 w-4 shrink-0' />
                  <span>+27 72 145 8530</span>
                </li>
                <li className='flex gap-2 lg:ml-auto lg:flex-row-reverse lg:items-start lg:justify-end'>
                  <MapPin
                    className='mt-0.5 h-4 w-4 shrink-0'
                    style={{color: TEAL_BRIGHT}}
                  />
                  <span>Unit 214, Airport Park, Germiston, 1400</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Client block */}
        <div
          className='mt-10 border-t-2 pt-6'
          style={{borderColor: `${TEAL_DEEP}33`}}
        >
          <div className='grid gap-1 text-sm sm:max-w-lg'>
            <p>
              <span className='font-semibold' style={{color: TEAL_DEEP}}>
                Name of Client:{' '}
              </span>
              {ctx.client.fullName}
            </p>
            {contactLine ? (
              <p>
                <span className='font-semibold' style={{color: TEAL_DEEP}}>
                  Contacts:{' '}
                </span>
                {contactLine}
              </p>
            ) : null}
          </div>
        </div>

        {/* Line items table */}
        <div className='mt-8 overflow-x-auto print:overflow-visible'>
          <table className='invoice-table w-full border border-black text-left'>
            <thead>
              <tr className='border-b border-black bg-slate-50'>
                <th className='invoice-col-package border-r border-black px-2 py-2 font-bold sm:px-3'>
                  {packageHeader}
                </th>
                <th className='invoice-col-date border-r border-black px-2 py-2 font-bold sm:px-3'>
                  Date
                </th>
                <th className='invoice-col-paid border-r border-black px-2 py-2 font-bold sm:px-3'>
                  <span className='block leading-tight'>Amount</span>
                  <span className='block leading-tight'>paid</span>
                </th>
                <th className='invoice-col-qty border-r border-black px-2 py-2 font-bold sm:px-3'>
                  <span className='block leading-tight'>No of</span>
                  <span className='block leading-tight'>Clients</span>
                </th>
                <th className='invoice-col-total border-r border-black px-2 py-2 font-bold sm:px-3'>
                  <span className='block leading-tight'>Total amount</span>
                  <span className='block leading-tight'>to be paid</span>
                </th>
                <th className='invoice-col-outstanding px-2 py-2 font-bold sm:px-3'>
                  <span className='block leading-tight'>Outstanding</span>
                  <span className='block leading-tight'>amount</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className='align-top'>
                <td className='invoice-col-package border-r border-t border-black px-2 py-3 sm:px-3 break-words'>
                  {desc}
                </td>
                <td className='invoice-col-date border-r border-t border-black px-2 py-3 sm:px-3 text-[11px] leading-snug tabular-nums'>
                  <InvoiceTodayDate compact className='block' />
                </td>
                <td className='invoice-col-paid border-r border-t border-black px-2 py-3 sm:px-3 tabular-nums whitespace-nowrap'>
                  {formatZARInvoice(paid)}
                </td>
                <td className='invoice-col-qty border-r border-t border-black px-2 py-3 sm:px-3 tabular-nums text-center'>
                  1
                </td>
                <td className='invoice-col-total border-r border-t border-black px-2 py-3 sm:px-3 tabular-nums whitespace-nowrap'>
                  {formatZARInvoice(ctx.client.packagePrice)}
                </td>
                <td className='invoice-col-outstanding border-t border-black px-2 py-3 sm:px-3 tabular-nums whitespace-nowrap'>
                  {formatZARInvoice(balance)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Terms */}
        <section className='mt-10 break-inside-avoid border border-slate-200 bg-slate-50/80 p-5 sm:p-6 print:border-black/20 print:bg-white'>
          <h2
            className='text-center text-sm font-bold uppercase tracking-wide sm:text-base'
            style={{color: TEAL_DEEP}}
          >
            TERMS AND CONDITIONS
          </h2>
          <ol className='mt-4 list-none space-y-2.5 text-[13px] leading-relaxed text-slate-800'>
            {TERMS.map((t, i) => (
              <li key={i} className='flex gap-2'>
                <span className='w-5 shrink-0 font-medium tabular-nums'>
                  {i + 1}.
                </span>
                <span>{t}</span>
              </li>
            ))}
          </ol>
        </section>

        <div className='mt-10 flex flex-wrap items-end gap-x-10 gap-y-4 border-t border-slate-200 pt-6 text-sm print:border-black/20'>
          <div className='min-w-[12rem] flex-1'>
            <p className='font-semibold' style={{color: TEAL_DEEP}}>
              Signature:
            </p>
            <div className='relative mt-1 h-14 w-48 max-w-full sm:h-16 sm:w-56'>
              <Image
                src='/nendila-signature.png'
                alt='Authorised signature'
                fill
                className='object-contain object-left'
                sizes='224px'
              />
            </div>
          </div>
          <p>
            <span className='font-semibold' style={{color: TEAL_DEEP}}>
              Date:
            </span>
            <span className='ml-2 tabular-nums'>
              <InvoiceTodayDate />
            </span>
          </p>
        </div>

        <p className='mt-8 text-center text-[11px] text-slate-500 print:text-slate-600'>
          Nendila Travel & Explorers,thank you for travelling with us.
        </p>
      </div>
    </div>
  );
}
