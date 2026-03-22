import { toast } from 'sonner';
import type { ActionEvent } from '../ActionEventBus';

/**
 * Toast subscriber — fires Spanish-language sonner toasts.
 * Pure function, no React, no hooks.
 */
export function toastSubscriber(event: ActionEvent): void {
  switch (event.type) {
    case 'action:confirmed':
      toast.success(`Acción correctiva creada — ${event.action.trade_name}`, {
        description: `Asignada a ${event.action.assigned_to_name}`,
        duration: 4000,
      });
      break;

    case 'action:reverted':
      toast.error(`Error al crear acción correctiva — ${event.action.trade_name}`, {
        description: 'La operación fue revertida. Intenta de nuevo.',
        duration: 5000,
      });
      break;
  }
}
