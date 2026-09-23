import { SignIn } from "@clerk/nextjs";

import { AuthNotConfigured, AuthShell } from "@/components/auth-shell";
import { isClerkConfigured } from "@/lib/env";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <AuthShell>
      {isClerkConfigured ? (
        <SignIn
          appearance={{ elements: { rootBox: "mx-auto", card: "shadow-none" } }}
          fallbackRedirectUrl="/dashboard"
          signUpUrl="/sign-up"
        />
      ) : (
        <AuthNotConfigured />
      )}
    </AuthShell>
  );
}
