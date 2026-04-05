import { ForgotPasswordForm } from '@/features/auth/components/ForgotPasswordForm';
import { RBLogo } from '@/components/RBLogo';

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-8">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex justify-center">
          <RBLogo size="lg" />
        </div>
        <h1 className="mb-6 text-center text-xl font-semibold text-zinc-100">
          Reset your password
        </h1>
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
