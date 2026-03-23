'use client';

import { useEffect, useState } from 'react';
import { fetchNotifications } from '../services/fetchNotifications';
import type { DashboardNotification } from '../services/fetchNotifications';

type EscalationAlertsSectionProps = {
  projectId: string;
};

const ALERT_STYLES: Record<string, { border: string; bg: string; icon: string; color: string }> = {
  legal_escalation: {
    border: 'border-red-900/50',
    bg: 'bg-red-950/20',
    icon: '!',
    color: 'text-red-400',
  },
  legal_follow_up: {
    border: 'border-amber-900/50',
    bg: 'bg-amber-950/20',
    icon: '?',
    color: 'text-amber-400',
  },
  nod_reminder: {
    border: 'border-purple-900/50',
    bg: 'bg-purple-950/20',
    icon: '*',
    color: 'text-purple-400',
  },
};

/**
 * Displays escalation and reminder notifications as alert cards
 * above the legal docs table. Only shows unread notifications
 * of legal types (escalation, follow-up, NOD reminder).
 */
export function EscalationAlertsSection({ projectId: _projectId }: EscalationAlertsSectionProps) {
  const [alerts, setAlerts] = useState<DashboardNotification[]>([]);

  useEffect(() => {
    fetchNotifications().then((notifs) => {
      const legalAlerts = notifs.filter(
        (n) =>
          !n.readAt &&
          (n.type === 'legal_escalation' || n.type === 'legal_follow_up' || n.type === 'nod_reminder'),
      );
      setAlerts(legalAlerts);
    });
  }, []);

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((alert) => {
        const style = ALERT_STYLES[alert.type] ?? ALERT_STYLES.nod_reminder;
        return (
          <div
            key={alert.id}
            className={`rounded-lg border ${style.border} ${style.bg} px-4 py-3`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${style.border} text-[10px] font-bold ${style.color}`}
              >
                {style.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${style.color}`}>{alert.title}</p>
                {alert.body && (
                  <p className="mt-0.5 text-xs text-zinc-400">{alert.body}</p>
                )}
                <p className="mt-1 text-[10px] text-zinc-600">
                  {new Date(alert.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
