import { SubSignupForm } from '@/features/auth/components/SubSignupForm';
import { RBLogo } from '@/components/RBLogo';

export default function SubSignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-8">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex justify-center">
          <RBLogo size="lg" />
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
