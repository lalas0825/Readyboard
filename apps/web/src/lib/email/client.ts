import { Resend } from 'resend';

/**
 * Resend email client. Uses placeholder key during build/dev
 * when RESEND_API_KEY is not set. Calls fail gracefully at runtime.
 */
export const resend = new Resend(
  process.env.RESEND_API_KEY || 're_placeholder',
);

export const EMAIL_FROM = process.env.RESEND_FROM_EMAIL || 'ReadyBoard <noreply@readyboard.ai>';
