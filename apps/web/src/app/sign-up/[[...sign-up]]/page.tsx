import { SignUp } from "@clerk/nextjs";

import { AuthNotConfigured, AuthShell } from "@/components/auth-shell";
import { isClerkConfigured } from "@/lib/env";

export const metadata = { title: "Create your account" };

export default function SignUpPage() {
  return (
    <AuthShell>
      {isClerkConfigured ? (
        <SignUp
          appearance={{ elements: { rootBox: "mx-auto", card: "shadow-none" } }}
          fallbackRedirectUrl="/dashboard"
          signInUrl="/sign-in"
        />
      ) : (
        <AuthNotConfigured />
      )}
    </AuthShell>
  );
}
