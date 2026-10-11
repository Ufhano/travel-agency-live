import type {PaymentWithContext} from '@backend/types';
import {DEFAULT_INVOICE_TERMS} from '@backend/invoice-terms';
import {Dancing_Script} from 'next/font/google';
import {InvoiceTermsSection} from '@/components/invoice-terms-section';
import {InvoiceTodayDate} from '@/components/invoice-today-date';
import {formatDate, formatZARInvoice, hasRealClientEmail} from '@/lib/utils';

const tagline = Dancing_Script({
  subsets: ['latin'],
  weight: ['400', '700'],
});

const TEAL_DEEP = '#00607A';
const TEAL_BRIGHT = '#20C9B7';

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
  terms,
  tripId,
  tripLabel,
}: {
  ctx: PaymentWithContext;
  /** `payment` = single receipt. `partial` / `full` = client statement. */
  variant?: 'payment' | 'partial' | 'full';
  /** Terms & Conditions lines for this trip; falls back to the default template. */
  terms?: string[];
  tripId?: string;
  tripLabel?: string;
}) {
  const termsList =
    terms && terms.length > 0 ? terms : DEFAULT_INVOICE_TERMS;
  const desc = packageDescription(ctx);
  const packageHeader = packageColumnHeader(ctx);
  const contactLine = clientContactLine(ctx);
  const netPrice = Math.max(
    0,
    ctx.client.packagePrice - (ctx.client.discount ?? 0),
  );
  const paid =
    variant === 'full'
      ? netPrice
      : variant === 'partial'
        ? ctx.totalPaidAfter
        : ctx.amount;
  const balance = variant === 'full' ? 0 : ctx.balanceAfter;
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

      <div className='invoice-print-inner relative px-8 pb-10 pt-8 sm:px-12 sm:pt-10'>
        {/* Top bar: logo + INVOICE ribbon + company */}
        <div className='flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between'>
          <div className='max-w-md'>
            <div className='min-w-0 pt-1'>
                <p
                  className='text-lg font-bold tracking-tight sm:text-xl'
                  style={{color: TEAL_DEEP}}
                >
                  Travel Agency
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

          <div className='flex flex-col items-stretch gap-4 lg:items-end'>
            <div
              className='print-color-exact self-end px-10 py-3 text-center text-xl font-bold tracking-[0.2em] text-white'
              style={{backgroundColor: TEAL_DEEP}}
            >
              {ribbonLabel}
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
                  {formatDate(ctx.paidAt)}
                </td>
                <td className='invoice-col-paid border-r border-t border-black px-2 py-3 sm:px-3 tabular-nums whitespace-nowrap'>
                  {formatZARInvoice(paid)}
                </td>
                <td className='invoice-col-qty border-r border-t border-black px-2 py-3 sm:px-3 tabular-nums text-center'>
                  1
                </td>
                <td className='invoice-col-total border-r border-t border-black px-2 py-3 sm:px-3 tabular-nums whitespace-nowrap'>
                  {formatZARInvoice(netPrice)}
                </td>
                <td className='invoice-col-outstanding border-t border-black px-2 py-3 sm:px-3 tabular-nums whitespace-nowrap'>
                  {formatZARInvoice(balance)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className='invoice-footer-group'>
        <InvoiceTermsSection
          initialTerms={termsList}
          tripId={tripId}
          tripLabel={tripLabel}
        />

        <div className='invoice-signature mt-10 flex flex-wrap items-end gap-x-10 gap-y-4 border-t border-slate-200 pt-6 text-sm print:border-black/20'>
          <div className='min-w-[12rem] flex-1'>
            <p className='font-semibold' style={{color: TEAL_DEEP}}>
              Signature:
            </p>
            <div className='mt-8 h-14 w-48 border-b border-slate-300' />
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
          Travel Agency, thank you for travelling with us.
        </p>
        </div>
      </div>
    </div>
  );
}
