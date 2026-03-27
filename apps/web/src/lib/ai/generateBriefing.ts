'use server';

import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createServiceClient } from '@/lib/supabase/service';
import { collectBriefingData, type BriefingContext } from './collectBriefingData';
import { notifyUser } from '@/lib/pushNotify';

// ─── AI Client ──────────────────────────────────────

const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY || 'or-placeholder',
});

const MODEL = 'google/gemini-2.5-flash-preview';
const FALLBACK_MODEL = 'anthropic/claude-haiku-4-5-20251001';

// ─── Prompt Builder ─────────────────────────────────

function buildPrompt(ctx: BriefingContext, role: string, language: string): string {
  const lang = language === 'es' ? 'Spanish' : 'English';
  const roleLabel = role.includes('gc') || role === 'owner' ? 'GC Project Manager' : 'Subcontractor PM';

  return `You are a senior construction superintendent writing a morning briefing for a ${roleLabel}.
Project: ${ctx.project.name} (${ctx.project.overallPct}% complete)

Current status:
- Active delays: ${ctx.delays.count} (total cost: $${ctx.delays.totalCost.toLocaleString()})
${ctx.delays.topAreas.length > 0 ? `- Blocked areas: ${ctx.delays.topAreas.join(', ')}` : '- No blocked areas'}
- Pending GC verifications: ${ctx.verifications.pendingCount}
- Open corrective actions: ${ctx.correctiveActions.openCount} (${ctx.correctiveActions.overdueCount} overdue)
- NODs pending: ${ctx.legal.pendingNods}, NODs sent: ${ctx.legal.sentNods}
${ctx.forecast.deltaDays != null ? `- Schedule: ${ctx.forecast.deltaDays > 0 ? '+' : ''}${ctx.forecast.deltaDays} days from baseline` : '- Schedule: insufficient data'}
- Field reports in last 24h: ${ctx.recentReports}

Write a briefing in ${lang} with exactly 3 points:
1. What is blocking progress today?
2. What needs urgent attention?
3. What is the key goal for today?

Rules:
- Maximum 300 characters total
- Professional, direct, actionable
- Use specific numbers from the data
- No greetings or sign-offs`;
}

// ─── Fallback (no AI) ───────────────────────────────

function buildFallbackBriefing(ctx: BriefingContext, language: string): string {
  if (language === 'es') {
    return `1. ${ctx.delays.count} bloqueos activos ($${ctx.delays.totalCost.toLocaleString()} acumulado). 2. ${ctx.correctiveActions.openCount} acciones correctivas pendientes${ctx.correctiveActions.overdueCount > 0 ? ` (${ctx.correctiveActions.overdueCount} vencidas)` : ''}. 3. ${ctx.verifications.pendingCount} verificaciones GC esperando aprobacion.`;
  }
  return `1. ${ctx.delays.count} active blocks ($${ctx.delays.totalCost.toLocaleString()} accumulated). 2. ${ctx.correctiveActions.openCount} open CAs${ctx.correctiveActions.overdueCount > 0 ? ` (${ctx.correctiveActions.overdueCount} overdue)` : ''}. 3. ${ctx.verifications.pendingCount} GC verifications awaiting approval.`;
}

// ─── Generator ──────────────────────────────────────

export type GenerateBriefingResult = {
  ok: boolean;
  content: string;
  model: string;
  tokensUsed: number;
  isFallback: boolean;
};

/**
 * Generates an AI morning briefing for a user+project.
 * Idempotent: checks if briefing already exists for today.
 * Falls back to data-only summary if AI fails.
 */
export async function generateMorningBriefing(
  userId: string,
  projectId: string,
  role: string,
  language: string = 'en',
): Promise<GenerateBriefingResult> {
  const supabase = createServiceClient();
  const today = new Date().toISOString().split('T')[0];

  // Idempotency: check if briefing already exists today
  const { data: existing } = await supabase
    .from('briefings')
    .select('id, content')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .eq('briefing_date', today)
    .single();

  if (existing) {
    return { ok: true, content: existing.content, model: 'cached', tokensUsed: 0, isFallback: false };
  }

  // Collect project data
  const ctx = await collectBriefingData(projectId);

  // Try AI generation
  let content: string;
  let model = MODEL;
  let tokensUsed = 0;
  let isFallback = false;

  try {
    const result = await generateText({
      model: openrouter(MODEL),
      prompt: buildPrompt(ctx, role, language),
      maxOutputTokens: 200,
      temperature: 0.3,
    });

    content = result.text.trim();
    tokensUsed = result.usage?.totalTokens ?? 0;

    // Validate: if too short or empty, use fallback
    if (content.length < 20) {
      throw new Error('AI response too short');
    }
  } catch (err) {
    console.warn('[Briefing] AI failed, trying fallback model:', err);

    try {
      const fallback = await generateText({
        model: openrouter(FALLBACK_MODEL),
        prompt: buildPrompt(ctx, role, language),
        maxOutputTokens: 200,
        temperature: 0.3,
      });
      content = fallback.text.trim();
      model = FALLBACK_MODEL;
      tokensUsed = fallback.usage?.totalTokens ?? 0;
    } catch {
      // Both AI models failed — use data-only fallback
      console.warn('[Briefing] Both AI models failed, using data fallback');
      content = buildFallbackBriefing(ctx, language);
      model = 'fallback';
      isFallback = true;
    }
  }

  // Save to database
  const { error } = await supabase.from('briefings').insert({
    user_id: userId,
    project_id: projectId,
    briefing_date: today,
    content,
    role,
    language,
    tokens_used: tokensUsed,
    model,
  });

  if (error) {
    console.error('[Briefing] Save failed:', error.message);
  }

  // Push notification (fire-and-forget)
  const preview = content.slice(0, 100) + (content.length > 100 ? '...' : '');
  void notifyUser(userId, 'Morning Briefing', preview, {
    screen: 'briefing',
    type: 'morning_briefing',
  });

  return { ok: true, content, model, tokensUsed, isFallback };
}
