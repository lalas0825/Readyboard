import { LoginForm } from '@/features/auth/components/LoginForm';
import { Suspense } from 'react';
import { RBLogo } from '@/components/RBLogo';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen">
      {/* Left: foreman image (hidden on mobile) */}
      <div className="relative hidden lg:flex lg:w-1/2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/hero-foreman.jpg"
          alt="Construction foreman using ReadyBoard on jobsite"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute bottom-12 left-12 right-12">
          <p className="text-lg font-semibold text-white/90">
            &ldquo;If you had this every morning at 7am — how many calls would you not make today?&rdquo;
          </p>
          <p className="mt-2 text-sm text-white/60">— ReadyBoard</p>
        </div>
      </div>

      {/* Right: login form */}
      <div className="flex flex-1 items-center justify-center bg-zinc-950 px-8">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex justify-center">
            <RBLogo size="lg" />
          </div>
          <h1 className="mb-6 text-center text-xl font-semibold text-zinc-100">
            Sign in to your account
          </h1>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
