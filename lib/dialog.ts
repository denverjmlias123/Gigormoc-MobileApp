import { showToast } from '../components/ui/Toast';
import { showConfirmDialog, ConfirmDialogOptions } from '../components/ui/ConfirmDialog';

/**
 * Universal in-app notification helper.
 * Uses in-app Toast across all platforms.
 */
export function notify(title: string, message?: string): Promise<void> {
  const fullText = message ? `${title}: ${message}` : title;
  showToast(fullText, 'info');
  return Promise.resolve();
}

/**
 * Universal in-app confirmation modal.
 * Works seamlessly on Web (PC/Laptop/Mobile) and Native (iOS/Android) via in-app Modal.
 */
export function confirmDialog(options: {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}): Promise<boolean> {
  return showConfirmDialog(options);
}
