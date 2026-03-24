import { SignupForm } from '@/features/auth/components/SignupForm';

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-8">
      <div className="w-full max-w-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/readyboard-lockup-dark.svg"
          alt="ReadyBoard"
          className="mx-auto mb-10 h-10"
        />
        <h1 className="mb-6 text-center text-xl font-semibold text-zinc-100">
          Create your account
        </h1>
        <SignupForm />
      </div>
    </div>
  );
}
