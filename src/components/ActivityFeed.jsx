import React from "react";
import {
  AlertCircle,
  Bell,
  Loader2,
  Mail,
  RefreshCcw,
  Sparkles,
} from "lucide-react";

const toneStyles = {
  success: {
    container:
      "bg-gradient-to-br from-emerald-50 via-white to-emerald-100 border border-emerald-100 text-emerald-900 shadow-sm",
    badge: "bg-emerald-500/15 text-emerald-700",
    icon: "bg-emerald-500 text-white shadow",
  },
  pending: {
    container:
      "bg-gradient-to-br from-amber-50 via-white to-amber-100 border border-amber-100 text-amber-900 shadow-sm",
    badge: "bg-amber-500/20 text-amber-700",
    icon: "bg-amber-500 text-white shadow",
  },
  warning: {
    container:
      "bg-gradient-to-br from-orange-50 via-white to-amber-100 border border-amber-100 text-amber-900 shadow-sm",
    badge: "bg-orange-500/20 text-orange-700",
    icon: "bg-orange-500 text-white shadow",
  },
  info: {
    container:
      "bg-gradient-to-br from-indigo-50 via-white to-indigo-100 border border-indigo-100 text-indigo-900 shadow-sm",
    badge: "bg-indigo-500/15 text-indigo-700",
    icon: "bg-indigo-500 text-white shadow",
  },
  danger: {
    container:
      "bg-gradient-to-br from-rose-50 via-white to-rose-100 border border-rose-100 text-rose-900 shadow-sm",
    badge: "bg-rose-500/15 text-rose-700",
    icon: "bg-rose-500 text-white shadow",
  },
  neutral: {
    container: "bg-white border border-gray-200 text-gray-900 shadow-sm",
    badge: "bg-gray-100 text-gray-600",
    icon: "bg-gray-900 text-white shadow",
  },
};

const actionStyles = {
  primary:
    "inline-flex items-center justify-center rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-bold text-white shadow transition hover:bg-gray-700",
  success:
    "inline-flex items-center justify-center rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white shadow transition hover:bg-emerald-600",
  warning:
    "inline-flex items-center justify-center rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white shadow transition hover:bg-amber-600",
  danger:
    "inline-flex items-center justify-center rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-bold text-white shadow transition hover:bg-rose-600",
  outline:
    "inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 transition hover:bg-gray-50",
  ghost:
    "inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-bold text-gray-600 transition hover:bg-gray-100",
};

const ActivityFeed = ({
  items,
  loading = false,
  errors = [],
  onRefresh,
  onViewAll,
  pendingInviteCount = 0,
  unreadUpdateCount = 0,
}) => {
  const filteredErrors = errors.filter((message) => Boolean(message?.trim?.()));
  const showSkeleton = loading && (!items || items.length === 0);
  const hasItems = Array.isArray(items) && items.length > 0;

  return (
    <section className="bg-white/90 border border-gray-100 rounded-3xl shadow-sm p-5 space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-black text-gray-900">Activity Feed</h3>
            {pendingInviteCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                <Mail className="h-3.5 w-3.5" />
                {pendingInviteCount} pending
              </span>
            )}
            {unreadUpdateCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
                <Bell className="h-3.5 w-3.5" />
                {unreadUpdateCount} new
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-gray-500 max-w-xl">
            Track invites, roster changes, and matches that need attention — everything you need to fill courts fast.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              <span>{loading ? "Refreshing" : "Refresh"}</span>
            </button>
          )}
          {onViewAll && (
            <button
              type="button"
              onClick={onViewAll}
              className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-3 py-2 text-sm font-semibold text-white shadow transition hover:bg-gray-700"
            >
              View all updates
            </button>
          )}
        </div>
      </div>

      {filteredErrors.length > 0 && (
        <div className="space-y-2">
          {filteredErrors.map((message, index) => (
            <div
              key={index}
              className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
            >
              <AlertCircle className="mt-0.5 h-4 w-4" />
              <span>{message}</span>
            </div>
          ))}
        </div>
      )}

      {showSkeleton ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {[...Array(3)].map((_, index) => (
            <div
              key={index}
              className="min-w-[260px] rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
            >
              <div className="mb-3 h-5 w-24 rounded-full bg-gray-100 animate-pulse" />
              <div className="mb-2 h-4 w-3/4 rounded bg-gray-100 animate-pulse" />
              <div className="mb-4 h-3 w-2/3 rounded bg-gray-100 animate-pulse" />
              <div className="flex gap-2">
                <div className="h-8 w-20 rounded-lg bg-gray-100 animate-pulse" />
                <div className="h-8 w-20 rounded-lg bg-gray-100 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : hasItems ? (
        <div className="-mx-1 flex gap-4 overflow-x-auto pb-2 px-1">
          {items.map((item) => {
            const tone = toneStyles[item.tone] || toneStyles.neutral;
            const IconComponent = item.icon;
            return (
              <article
                key={item.id}
                className={`min-w-[260px] sm:min-w-[280px] flex flex-col gap-4 rounded-2xl p-4 transition-transform hover:-translate-y-1 ${tone.container}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${tone.badge}`}>
                    {item.statusLabel}
                  </span>
                  {item.relativeTime && (
                    <span className="text-[11px] font-semibold text-gray-500" title={item.timestampLabel}>
                      {item.relativeTime}
                    </span>
                  )}
                </div>
                <div className="flex items-start gap-3">
                  {IconComponent && (
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone.icon}`}>
                      <IconComponent className="h-5 w-5" />
                    </div>
                  )}
                  <div className="flex-1 space-y-1">
                    <h4 className="text-sm font-black leading-snug text-gray-900">
                      {item.title}
                    </h4>
                    {item.description && (
                      <p className="text-xs font-semibold text-gray-600">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>
                {item.meta?.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    {item.meta.map((meta, metaIndex) => {
                      const MetaIcon = meta.icon;
                      return (
                        <span
                          key={`${item.id}-meta-${metaIndex}`}
                          className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-3 py-1 text-[11px] font-semibold text-gray-600"
                        >
                          {MetaIcon && <MetaIcon className="h-3.5 w-3.5" />}
                          <span className="truncate max-w-[140px]">
                            {meta.label}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                )}
                {item.actions?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {item.actions.map((action, actionIndex) => {
                      const variant = action.variant && actionStyles[action.variant]
                        ? action.variant
                        : "outline";
                      const className = `${actionStyles[variant]} ${action.className || ""}`.trim();
                      return (
                        <button
                          key={`${item.id}-action-${actionIndex}`}
                          type="button"
                          onClick={action.onClick}
                          disabled={action.disabled}
                          className={`${className} ${
                            action.disabled
                              ? "cursor-not-allowed opacity-60"
                              : ""
                          }`}
                        >
                          {action.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center shadow-sm">
          <Sparkles className="h-10 w-10 text-emerald-400" />
          <h4 className="text-base font-black text-gray-900">You're all caught up</h4>
          <p className="text-sm font-semibold text-gray-500 max-w-md">
            We'll let you know as soon as there are new invites, player responses, or matches that need more players.
          </p>
        </div>
      )}
    </section>
  );
};

export default ActivityFeed;
