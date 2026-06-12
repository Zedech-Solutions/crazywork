"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

const ConfirmContext = createContext<(o: ConfirmOptions) => Promise<boolean>>(
  async () => false,
);

export const useConfirm = () => useContext(ConfirmContext);

// Promise-based replacement for window.confirm — branded in-app dialog.
// Usage: const confirm = useConfirm(); if (await confirm({ message })) { ... }
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setOpts(options);
      }),
    [],
  );

  function settle(value: boolean) {
    resolver.current?.(value);
    resolver.current = null;
    setOpts(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <DialogPrimitive.Root
        open={opts !== null}
        onOpenChange={(open) => !open && settle(false)}
      >
        <DialogContent
          aria-describedby={undefined}
          className="max-w-sm rounded-2xl"
        >
          <DialogTitle className="headline text-3xl">
            {opts?.title ?? "Are you sure?"}
          </DialogTitle>
          <p className="mt-2 text-sm text-brown">{opts?.message}</p>
          <div className="mt-6 flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => settle(false)}
              className="rounded-lg"
            >
              {opts?.cancelLabel ?? "Cancel"}
            </Button>
            <Button
              variant={opts?.danger ? "danger" : "accent"}
              onClick={() => settle(true)}
              className="rounded-lg"
            >
              {opts?.confirmLabel ?? "Confirm"}
            </Button>
          </div>
        </DialogContent>
      </DialogPrimitive.Root>
    </ConfirmContext.Provider>
  );
}
