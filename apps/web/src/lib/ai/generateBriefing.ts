'use server';

import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createServiceClient } from '@/lib/supabase/service';
import { collectBriefingData, type BriefingContext } from './collectBriefingData';
import { notifyUser } from '@/lib/pushNotify';

// ─── AI Client ──────────────────────────────────────

const HAS_AI_KEY = !!process.env.OPENROUTER_API_KEY;

const openrouter = HAS_AI_KEY
  ? createOpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY!,
    })
  : null;

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
// Demo project ID (383 Madison — hardcoded briefing, no API call)
const DEMO_PROJECT_ID = 'b0000000-0000-0000-0000-000000000001';

const DEMO_BRIEFINGS: Record<string, string> = {
  en: `1. 3 areas blocked on Floor 22 — Drywall crew waiting on Fire Stopping inspection (FDNY). Cumulative cost: $14,400. NOD drafted for Bath 22C.
2. GC verification overdue on Floor 21: 4 tasks pending approval >24h (Tile, Waterproofing). Escalation sent to sub PM.
3. Today's priority: Clear Fire Stopping on F22 to unblock 6 areas. MEP Trim-Out on F20 is 2 days ahead of schedule — keep momentum.`,
  es: `1. 3 áreas bloqueadas en Piso 22 — cuadrilla de Drywall esperando inspección de Fire Stopping (FDNY). Costo acumulado: $14,400. NOD redactado para Baño 22C.
2. Verificación GC vencida en Piso 21: 4 tareas pendientes >24h (Tile, Waterproofing). Escalación enviada al sub PM.
3. Prioridad hoy: Liberar Fire Stopping en P22 para desbloquear 6 áreas. MEP Trim-Out en P20 va 2 días adelantado — mantener ritmo.`,
};

export async function generateMorningBriefing(
  userId: string,
  projectId: string,
  role: string,
  language: string = 'en',
): Promise<GenerateBriefingResult> {
  // Demo mode: instant hardcoded briefing, no API call, no DB write
  if (projectId === DEMO_PROJECT_ID) {
    return {
      ok: true,
      content: DEMO_BRIEFINGS[language] ?? DEMO_BRIEFINGS.en,
      model: 'demo',
      tokensUsed: 0,
      isFallback: false,
    };
  }

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

  // Try AI generation (skip entirely if no API key)
  let content: string;
  let model = MODEL;
  let tokensUsed = 0;
  let isFallback = false;

  if (!openrouter) {
    // No API key — use data-only fallback without calling AI
    console.info('[Briefing] No OPENROUTER_API_KEY configured, using data fallback');
    content = buildFallbackBriefing(ctx, language);
    model = 'fallback';
    isFallback = true;
  } else {
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
