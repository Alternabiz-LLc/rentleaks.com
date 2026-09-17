"use client";

import { Icon } from "./Icon";

export function PrintButton({ label = "Print or save as PDF" }: { label?: string }) {
  return (
    <button type="button" className="dk-btn dk-btn--primary dk-noprint" onClick={() => window.print()}>
      <Icon name="export" size={14} /> {label}
    </button>
  );
}
