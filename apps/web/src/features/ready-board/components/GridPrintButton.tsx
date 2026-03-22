'use client';

/**
 * KISS export: triggers browser print dialog.
 * "Save as PDF" is built into every modern browser.
 * Hides itself in print mode via print:hidden.
 */
export function GridPrintButton({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <button
      onClick={() => window.print()}
      className="rounded-md border border-zinc-700 px-3 py-1 text-xs text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200 print:hidden"
    >
      Export PDF
    </button>
  );
}
