'use client';

import { useState } from 'react';
import type { ReferralRowStatus } from '../queries';
import type { ReferralCopy } from '../i18n';
import { fill } from '../i18n';

/**
 * The referrals table: filter chips and one row per referral.
 *
 * Rows arrive already fetched and already formatted by the server, dates
 * included, so no `Date` has to survive serialization and the browser's locale
 * cannot disagree with the account's. Filtering is client-side over that same
 * list: this is a handful of rows, and a round trip per chip would be a request
 * that returns nothing new.
 */

export interface TableRow {
  id: string;
  label: string;
  /** "Joined 4 May 2026", built server-side. */
  meta: string;
  status: ReferralRowStatus;
}

type Filter = 'all' | ReferralRowStatus;

const STATUS_STYLES: Record<ReferralRowStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  trialing: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  pending: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  lapsed: 'bg-rose-50 text-rose-700 ring-rose-600/20',
};

export function ReferralTable({ rows, copy }: { rows: TableRow[]; copy: ReferralCopy }) {
  const [filter, setFilter] = useState<Filter>('all');

  const statusLabel: Record<ReferralRowStatus, string> = {
    active: copy.statusActive,
    trialing: copy.statusTrialing,
    pending: copy.statusPending,
    lapsed: copy.statusLapsed,
  };

  const counts: Record<Filter, number> = {
    all: rows.length,
    active: rows.filter((row) => row.status === 'active').length,
    trialing: rows.filter((row) => row.status === 'trialing').length,
    pending: rows.filter((row) => row.status === 'pending').length,
    lapsed: rows.filter((row) => row.status === 'lapsed').length,
  };

  const visible = filter === 'all' ? rows : rows.filter((row) => row.status === filter);

  if (rows.length === 0) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">{copy.emptyTitle}</h2>
        <p className="mt-2 max-w-prose text-sm text-slate-600">{copy.emptyText}</p>
      </section>
    );
  }

  const chips: Array<[Filter, string]> = [
    ['all', copy.filterAll],
    ['active', copy.filterActive],
    ['trialing', copy.filterTrialing],
    ['pending', copy.filterPending],
    ['lapsed', copy.filterLapsed],
  ];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">{copy.listTitle}</h2>
        <p className="text-sm text-slate-500">{fill(copy.listTotal, { count: rows.length })}</p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {chips.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors ${
              filter === key
                ? 'border-brand-500 bg-brand-50 font-medium text-brand-700'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {label}
            <span className="text-slate-400">{counts[key]}</span>
          </button>
        ))}
      </div>

      <ul className="mt-5 divide-y divide-slate-100 border-t border-slate-100">
        {visible.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
            {/* Full width of its own on a phone: sharing the line with the
                badge truncated longer names to something nobody recognises. */}
            <div className="min-w-0 basis-full sm:flex-1 sm:basis-0">
              <p className="truncate font-medium text-slate-900">{row.label}</p>
              <p className="mt-0.5 truncate text-sm text-slate-500">{row.meta}</p>
            </div>

            <span
              className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ${STATUS_STYLES[row.status]}`}
            >
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
              {statusLabel[row.status]}
            </span>
          </li>
        ))}
      </ul>

      {visible.length === 0 && <p className="py-4 text-sm text-slate-500">{copy.emptyFiltered}</p>}

      <p className="mt-4 max-w-prose text-xs leading-relaxed text-slate-500">{copy.countsHint}</p>
    </section>
  );
}
