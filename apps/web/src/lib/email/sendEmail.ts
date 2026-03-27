'use server';

import { resend, EMAIL_FROM } from './client';
import { WelcomeEmail } from './templates/WelcomeEmail';
import { BlockedAlertEmail } from './templates/BlockedAlertEmail';
import { VerifiedReportEmail } from './templates/VerifiedReportEmail';
import { createElement } from 'react';

/**
 * Server-side email sender via Resend.
 * Fire-and-forget — never blocks the calling operation.
 * All sends are wrapped in try/catch to prevent failures from cascading.
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://readyboard.ai';

export async function sendWelcomeEmail(params: {
  to: string;
  userName: string;
  role: string;
}): Promise<void> {
  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: params.to,
      subject: 'Welcome to ReadyBoard',
      react: createElement(WelcomeEmail, {
        userName: params.userName,
        loginUrl: `${BASE_URL}/login`,
        role: params.role,
      }),
    });
  } catch (err) {
    console.error('[Email] Welcome email failed:', err);
  }
}

export async function sendBlockedAlertEmail(params: {
  to: string;
  recipientName: string;
  projectName: string;
  areaName: string;
  tradeName: string;
  reasonCode: string;
  blockedSince: string;
  dailyCost: string;
}): Promise<void> {
  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: params.to,
      subject: `Area Blocked — ${params.areaName} / ${params.tradeName}`,
      react: createElement(BlockedAlertEmail, {
        ...params,
        dashboardUrl: `${BASE_URL}/dashboard/delays`,
      }),
    });
  } catch (err) {
    console.error('[Email] Blocked alert email failed:', err);
  }
}

export async function sendWeeklyReportEmail(params: {
  to: string;
  recipientName: string;
  projectName: string;
  verifiedCount: number;
  totalAreas: number;
  overallProgress: string;
  topDelays: { area: string; trade: string; cost: string }[];
  weekOf: string;
}): Promise<void> {
  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: params.to,
      subject: `Weekly Report — ${params.projectName} (${params.weekOf})`,
      react: createElement(VerifiedReportEmail, {
        ...params,
        dashboardUrl: `${BASE_URL}/dashboard`,
      }),
    });
  } catch (err) {
    console.error('[Email] Weekly report email failed:', err);
  }
}
