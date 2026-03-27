'use server';

import { resend, EMAIL_FROM } from './client';
import { WelcomeEmail } from './templates/WelcomeEmail';
import { BlockedAlertEmail } from './templates/BlockedAlertEmail';
import { VerifiedReportEmail } from './templates/VerifiedReportEmail';
import { TeamInviteEmail } from './templates/TeamInviteEmail';
import { TrialEndingEmail } from './templates/TrialEndingEmail';
import { PaymentFailedEmail } from './templates/PaymentFailedEmail';
import { NodSentEmail } from './templates/NodSentEmail';
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

export async function sendTeamInviteEmail(params: {
  to: string;
  inviterName: string;
  projectName: string;
  role: string;
  joinUrl: string;
  language?: 'en' | 'es';
}): Promise<void> {
  try {
    const lang = params.language ?? 'en';
    await resend.emails.send({
      from: EMAIL_FROM,
      to: params.to,
      subject: lang === 'es' ? 'Te han invitado a ReadyBoard' : `You've been invited to ${params.projectName}`,
      react: createElement(TeamInviteEmail, {
        inviterName: params.inviterName,
        projectName: params.projectName,
        role: params.role,
        joinUrl: params.joinUrl,
        language: lang,
      }),
    });
  } catch (err) {
    console.error('[Email] Team invite email failed:', err);
  }
}

export async function sendTrialEndingEmail(params: {
  to: string;
  userName: string;
  daysLeft: number;
  language?: 'en' | 'es';
}): Promise<void> {
  try {
    const lang = params.language ?? 'en';
    await resend.emails.send({
      from: EMAIL_FROM,
      to: params.to,
      subject: lang === 'es'
        ? `Tu prueba termina en ${params.daysLeft} día${params.daysLeft !== 1 ? 's' : ''}`
        : `Your trial ends in ${params.daysLeft} day${params.daysLeft !== 1 ? 's' : ''}`,
      react: createElement(TrialEndingEmail, {
        userName: params.userName,
        daysLeft: params.daysLeft,
        billingUrl: `${BASE_URL}/dashboard/billing`,
        language: lang,
      }),
    });
  } catch (err) {
    console.error('[Email] Trial ending email failed:', err);
  }
}

export async function sendPaymentFailedEmail(params: {
  to: string;
  userName: string;
  projectName: string;
  portalUrl: string;
  language?: 'en' | 'es';
}): Promise<void> {
  try {
    const lang = params.language ?? 'en';
    await resend.emails.send({
      from: EMAIL_FROM,
      to: params.to,
      subject: lang === 'es' ? 'Pago fallido — ReadyBoard' : 'Payment failed — ReadyBoard',
      react: createElement(PaymentFailedEmail, {
        userName: params.userName,
        projectName: params.projectName,
        portalUrl: params.portalUrl,
        language: lang,
      }),
    });
  } catch (err) {
    console.error('[Email] Payment failed email failed:', err);
  }
}

export async function sendNodEmail(params: {
  to: string;
  recipientName: string;
  projectName: string;
  areaName: string;
  tradeName: string;
  reasonCode: string;
  dailyCost: string;
  cumulativeCost: string;
  signedAt: string;
  hash: string;
  trackingUuid: string;
  language?: 'en' | 'es';
}): Promise<void> {
  try {
    const lang = params.language ?? 'en';
    await resend.emails.send({
      from: EMAIL_FROM,
      to: params.to,
      subject: lang === 'es'
        ? `Aviso de Retraso — ${params.areaName} / ${params.tradeName}`
        : `Notice of Delay — ${params.areaName} / ${params.tradeName}`,
      react: createElement(NodSentEmail, {
        recipientName: params.recipientName,
        projectName: params.projectName,
        areaName: params.areaName,
        tradeName: params.tradeName,
        reasonCode: params.reasonCode,
        dailyCost: params.dailyCost,
        cumulativeCost: params.cumulativeCost,
        signedAt: params.signedAt,
        hash: params.hash,
        verifyUrl: `${BASE_URL}/api/legal/verify?hash=${params.hash}`,
        dashboardUrl: `${BASE_URL}/dashboard/legal`,
        trackingPixelUrl: `${BASE_URL}/api/legal/track/${params.trackingUuid}`,
        language: lang,
      }),
    });
  } catch (err) {
    console.error('[Email] NOD sent email failed:', err);
  }
}
