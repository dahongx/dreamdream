"use client";

import * as Toast from "@radix-ui/react-toast";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";
import { useI18n } from "@/i18n/client";

interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "success" | "error";
}

interface ToastContextValue {
  toast: (params: Omit<ToastMessage, "id">) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const { dict } = useI18n();
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const toast = useCallback(
    ({ title, description, variant = "default" }: Omit<ToastMessage, "id">) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, title, description, variant }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3000);
    },
    [],
  );

  const success = useCallback(
    (title: string, description?: string) => {
      toast({ title, description, variant: "success" });
    },
    [toast],
  );

  const error = useCallback(
    (title: string, description?: string) => {
      toast({ title, description, variant: "error" });
    },
    [toast],
  );

  return (
    <ToastContext.Provider value={{ toast, success, error }}>
      <Toast.Provider swipeDirection="right">
        {children}
        {toasts.map((t) => (
          <Toast.Root
            key={t.id}
            className="fixed left-1/2 top-1/2 z-[110] flex w-fit min-w-[160px] max-w-[min(80vw,300px)] -translate-x-1/2 -translate-y-1/2 items-center gap-[var(--space-sm)] rounded-[var(--radius-md)] border border-border-strong bg-surface-solid/95 px-[var(--space-md)] py-[var(--space-sm)] shadow-(--shadow-overlay) backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
            duration={3000}
          >
            <div className="flex flex-1 flex-col gap-[var(--space-xs)]">
              <Toast.Title
                className={`text-sm font-medium ${
                  t.variant === "success"
                    ? "text-text-primary"
                    : t.variant === "error"
                      ? "text-semantic-error"
                      : "text-text-primary"
                }`}
              >
                {t.title}
              </Toast.Title>
              {t.description && (
                <Toast.Description className="text-xs text-text-muted">
                  {t.description}
                </Toast.Description>
              )}
            </div>
            <Toast.Close className="-mr-[var(--space-xs)] rounded-[var(--radius-sm)] p-[var(--space-xs)] text-text-muted transition-colors hover:text-text-primary">
              <span className="sr-only">{dict.shell.close}</span>
              <span aria-hidden="true">✕</span>
            </Toast.Close>
          </Toast.Root>
        ))}
        <Toast.Viewport />
      </Toast.Provider>
    </ToastContext.Provider>
  );
}
