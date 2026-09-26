import { apiData, withApiAuth } from "@/server/api/http";

/** Who is signed in, which business they're acting for, and its plan. */
export const GET = withApiAuth(async (ctx) => {
  const { org, member, profile, plan } = ctx;
  return apiData({
    org: { id: org.id, name: org.name },
    member: {
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      avatarUrl: member.avatarUrl,
    },
    plan: {
      id: plan.id,
      name: plan.name,
      limits: plan.limits,
      features: plan.features,
    },
    onboardingCompleted: ctx.onboardingCompleted,
    business: profile
      ? {
          displayName: profile.displayName,
          logoUrl: profile.logoUrl,
          defaultCurrency: profile.defaultCurrency,
          taxLabel: profile.taxLabel,
          defaultTaxRate: profile.defaultTaxRate,
          taxInclusive: profile.taxInclusive,
        }
      : null,
  });
});
