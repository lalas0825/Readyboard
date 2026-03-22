import { orchestrateAction } from '../../services/orchestrateAction';
import type { ActionEvent, ActionEventHandler } from '../ActionEventBus';

/**
 * Factory that captures projectId and returns a bus subscriber.
 * Only reacts to confirmed events — reverts are not sent to external systems.
 * Fire-and-forget: void the promise intentionally.
 */
export function createOrchestratorSubscriber(projectId: string): ActionEventHandler {
  return (event: ActionEvent) => {
    if (event.type !== 'action:confirmed') return;

    const { action } = event;

    void orchestrateAction({
      event_type: 'corrective_action.created',
      project_id: projectId,
      action_id: action.id,
      delay_log_id: action.delay_log_id,
      area_id: action.area_id,
      trade_name: action.trade_name,
      assigned_to: action.assigned_to,
      assigned_to_name: action.assigned_to_name,
      deadline: action.deadline,
      note: action.note,
      status: action.status,
      created_by: action.created_by,
      created_at: action.created_at,
      client_latency_ms: Date.now() - event.optimisticInsertedAt,
    });
  };
}
