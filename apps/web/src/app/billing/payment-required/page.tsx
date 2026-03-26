import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/getSession';
import { PaymentRequiredClient } from './PaymentRequiredClient';

export default async function PaymentRequiredPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6">
      <div className="w-full max-w-md rounded-xl border border-red-900/50 bg-zinc-900 p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-950/50">
          <span className="text-3xl">&#9888;</span>
        </div>
        <h1 className="text-xl font-semibold text-zinc-100">Payment Required</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Your subscription payment is past due. Update your payment method to
          restore access to Pro features.
        </p>
        <p className="mt-1 text-xs text-zinc-600">
          Field operations (foreman checklists, area updates) remain active.
        </p>
        <PaymentRequiredClient />
      </div>
    </div>
  );
}
