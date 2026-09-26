import "server-only";

import { eq } from "drizzle-orm";
import nodemailer from "nodemailer";
import { Resend } from "resend";

import { db } from "@/server/db";
import { emailSettings } from "@/server/db/schema";
import { decryptSecret } from "@/lib/crypto";
import { env, isResendConfigured } from "@/lib/env";

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface SendMailInput {
  orgId: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: MailAttachment[];
}

export interface SendMailResult {
  ok: boolean;
  error?: string;
  provider?: "smtp" | "resend";
}

/**
 * Send an email using the org's configured transport:
 *  1. Custom SMTP (nodemailer) when the business has set it up.
 *  2. Platform default (Resend) otherwise.
 * Fails gracefully with a descriptive error when nothing is configured.
 */
export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const [settings] = await db
    .select()
    .from(emailSettings)
    .where(eq(emailSettings.orgId, input.orgId))
    .limit(1);

  const fromName = settings?.fromName ?? "InvoiceGen";
  const fromEmail = settings?.fromEmail;

  // 1. Custom SMTP
  if (settings?.provider === "smtp" && settings.smtpHost && settings.smtpUser) {
    try {
      const transporter = nodemailer.createTransport({
        host: settings.smtpHost,
        port: settings.smtpPort ?? 587,
        secure: settings.smtpSecure,
        auth: {
          user: settings.smtpUser,
          pass: settings.smtpPasswordEnc
            ? decryptSecret(settings.smtpPasswordEnc)
            : undefined,
        },
      });
      await transporter.sendMail({
        from: `${fromName} <${fromEmail ?? settings.smtpUser}>`,
        to: input.to,
        replyTo: settings.replyTo ?? undefined,
        subject: input.subject,
        html: input.html,
        text: input.text,
        attachments: input.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
        })),
      });
      return { ok: true, provider: "smtp" };
    } catch (e) {
      return { ok: false, error: `SMTP error: ${(e as Error).message}` };
    }
  }

  // 2. Platform default (Resend)
  if (isResendConfigured) {
    try {
      const resend = new Resend(env.RESEND_API_KEY);
      const { error } = await resend.emails.send({
        from: env.EMAIL_FROM,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        replyTo: fromEmail ?? undefined,
        attachments: input.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
        })),
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true, provider: "resend" };
    } catch (e) {
      return { ok: false, error: `Resend error: ${(e as Error).message}` };
    }
  }

  return {
    ok: false,
    error:
      "No email transport configured. Add RESEND_API_KEY or set up SMTP in Settings → Email.",
  };
}
