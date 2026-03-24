import { LoginForm } from '@/features/auth/components/LoginForm';

export default function LoginPage() {
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
          Sign in to your account
        </h1>
        <LoginForm />
      </div>
    </div>
  );
}
