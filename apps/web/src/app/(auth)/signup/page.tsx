import { SignupForm } from '@/features/auth/components/SignupForm';
import { RBLogo } from '@/components/RBLogo';

export default function SignupPage() {
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
            &ldquo;Your team reports from the field in 3 taps — no training, no WiFi, no waiting.&rdquo;
          </p>
          <p className="mt-2 text-sm text-white/60">— ReadyBoard</p>
        </div>
      </div>

      {/* Right: signup form */}
      <div className="flex flex-1 items-center justify-center bg-zinc-950 px-8">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex justify-center">
            <RBLogo size="lg" />
          </div>
          <h1 className="mb-6 text-center text-xl font-semibold text-zinc-100">
            Create your account
          </h1>
          <SignupForm />
        </div>
      </div>
    </div>
  );
}
