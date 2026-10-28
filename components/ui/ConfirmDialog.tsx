import React, { createContext, useCallback, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { useAppTheme } from '../../app/theme';

export interface ConfirmDialogOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

interface ConfirmDialogProps extends ConfirmDialogOptions {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

type DialogListener = (
  options: ConfirmDialogOptions,
  resolve: (value: boolean) => void
) => void;

let globalDialogListener: DialogListener | null = null;

/**
 * Imperative helper to prompt the user with an in-app confirmation modal.
 * Works seamlessly across Mobile (iOS/Android), Laptop, and PC web.
 * Never uses window.confirm or Alert.alert.
 */
export function showConfirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (globalDialogListener) {
      globalDialogListener(options, resolve);
    } else {
      // Safe fallback if provider is not yet mounted
      resolve(true);
    }
  });
}

/**
 * Standalone Declarative ConfirmDialog Component
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  visible,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
  loading = false,
}) => {
  const theme = useAppTheme();

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
          {message ? (
            <Text style={[styles.message, { color: theme.colors.muted }]}>{message}</Text>
          ) : null}

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[
                styles.button,
                styles.cancelButton,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.surface,
                },
              ]}
              onPress={onCancel}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={[styles.cancelButtonText, { color: theme.colors.text }]}>
                {cancelText}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.confirmButton,
                {
                  backgroundColor: destructive ? theme.colors.danger : theme.colors.primary,
                },
              ]}
              onPress={onConfirm}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.confirmButtonText}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

interface DialogState extends ConfirmDialogOptions {
  visible: boolean;
  resolve?: (value: boolean) => void;
}

const ConfirmDialogContext = createContext<{
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
}>({
  confirm: showConfirmDialog,
});

/**
 * ConfirmDialogProvider wraps the application to enable app-wide in-app dialogs
 */
export const ConfirmDialogProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [dialogState, setDialogState] = useState<DialogState>({
    visible: false,
    title: '',
  });

  const handleOpen = useCallback(
    (options: ConfirmDialogOptions, resolve: (value: boolean) => void) => {
      setDialogState({
        ...options,
        visible: true,
        resolve,
      });
    },
    []
  );

  React.useEffect(() => {
    globalDialogListener = handleOpen;
    return () => {
      if (globalDialogListener === handleOpen) {
        globalDialogListener = null;
      }
    };
  }, [handleOpen]);

  const handleConfirm = () => {
    const res = dialogState.resolve;
    setDialogState((prev) => ({ ...prev, visible: false, resolve: undefined }));
    if (res) res(true);
  };

  const handleCancel = () => {
    const res = dialogState.resolve;
    setDialogState((prev) => ({ ...prev, visible: false, resolve: undefined }));
    if (res) res(false);
  };

  return (
    <ConfirmDialogContext.Provider value={{ confirm: showConfirmDialog }}>
      {children}
      <ConfirmDialog
        visible={dialogState.visible}
        title={dialogState.title}
        message={dialogState.message}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
        destructive={dialogState.destructive}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ConfirmDialogContext.Provider>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  button: {
    flex: 1,
    minHeight: 46,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    minWidth: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  confirmButton: {},
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
