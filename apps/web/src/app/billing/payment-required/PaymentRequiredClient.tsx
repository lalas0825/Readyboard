'use client';

import { useState } from 'react';
import { createPortalSession } from '@/features/billing/services/createPortalSession';

export function PaymentRequiredClient() {
  const [loading, setLoading] = useState(false);

  const handlePortal = async () => {
    setLoading(true);
    const result = await createPortalSession();
    if (result.ok) {
      window.location.href = result.url;
    }
    setLoading(false);
  };

  return (
    <div className="mt-6 space-y-3">
      <button
        onClick={handlePortal}
        disabled={loading}
        className="w-full rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-500 disabled:opacity-50"
      >
        {loading ? 'Opening...' : 'Update Payment Method'}
      </button>
      <a
        href="/dashboard"
        className="block text-xs text-zinc-500 hover:text-zinc-300"
      >
        Continue with limited access
      </a>
    </div>
  );
}
