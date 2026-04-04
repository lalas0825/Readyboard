import { SubSignupForm } from '@/features/auth/components/SubSignupForm';

export default function SubSignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-8">
      <div className="w-full max-w-sm">
        <div className="mx-auto mb-10 flex items-center justify-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/readyboard-icon-animated.svg" alt="" className="h-8 w-8" />
          <span className="text-xl font-bold text-zinc-100">ReadyBoard</span>
        </div>
        <h1 className="mb-2 text-center text-xl font-semibold text-zinc-100">
          Specialty Contractor
        </h1>
        <p className="mb-6 text-center text-sm text-zinc-500">
          Create your account to track progress and protect your work.
        </p>
        <SubSignupForm />
      </div>
    </div>
  );
}
