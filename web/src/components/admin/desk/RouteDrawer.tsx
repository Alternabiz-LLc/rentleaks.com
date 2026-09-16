"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Drawer } from "./Drawer";

/**
 * A drawer whose open state lives in the URL (?open=id), so a dossier can be
 * rendered on the server, linked from ⌘K and survive a reload. Closing
 * navigates to `closeHref` without scrolling the page underneath.
 */
export function RouteDrawer({ closeHref, title, kicker, children, width }: { closeHref: string; title: string; kicker?: string; children: React.ReactNode; width?: number }) {
  const router = useRouter();
  const close = useCallback(() => router.push(closeHref, { scroll: false }), [router, closeHref]);
  return (
    <Drawer open onClose={close} title={title} kicker={kicker} width={width}>
      {children}
    </Drawer>
  );
}
