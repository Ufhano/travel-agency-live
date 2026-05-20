'use client';

/**
 * Manual departure date on the invoice table (not read from the trip record).
 * Type before Print / Save as PDF, or leave blank and write by hand.
 */
export function InvoiceDepartureDateCell() {
  return (
    <div className='min-h-[1.35rem] border-b border-black'>
      <input
        type='text'
        inputMode='text'
        autoComplete='off'
        aria-label='Departure date (fill in)'
        className='w-full border-0 bg-transparent p-0 text-[13px] outline-none placeholder:text-slate-400 focus:ring-0 dark:placeholder:text-slate-500'
        placeholder=''
      />
    </div>
  );
}
