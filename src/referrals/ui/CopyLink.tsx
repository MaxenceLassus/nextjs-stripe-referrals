'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The referral link and the one button on the page that matters.
 *
 * A client component only because the clipboard is a browser capability. The
 * link itself is rendered from the server, so it is readable and selectable
 * before any JavaScript runs — which is also the fallback when the clipboard
 * refuses.
 */
export function CopyLink({
  link,
  copyLabel,
  copiedLabel,
}: {
  link: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Refused: insecure context, or permission denied. The link is on screen
      // and selectable, so this is a missing convenience rather than a failure
      // worth an error message.
      return;
    }

    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="flex flex-wrap items-stretch gap-2">
      <p className="flex min-w-0 flex-1 basis-72 items-center overflow-hidden text-ellipsis whitespace-nowrap rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm text-slate-700">
        {link}
      </p>
      <button
        type="button"
        onClick={copy}
        className="rounded-lg bg-brand-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-700"
      >
        {copied ? copiedLabel : copyLabel}
      </button>
    </div>
  );
}
