import { ForgotPasswordForm } from '@/features/auth/components/ForgotPasswordForm';

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-8">
      <div className="w-full max-w-sm">
        <div className="mx-auto mb-10 flex items-center justify-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/readyboard-icon-animated.svg" alt="" className="h-8 w-8" />
          <span className="text-xl font-bold text-zinc-100">ReadyBoard</span>
        </div>
        <h1 className="mb-6 text-center text-xl font-semibold text-zinc-100">
          Reset your password
        </h1>
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
