import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { g as getLocationId, u as useAIConfig, a as api } from "../entry-server.mjs";
import { u as useCachedResource } from "./useCachedResource-la3fKty1.js";
import { T as TYPE_ORDER, a as TYPES } from "./types-nNhWZ2i7.js";
import { c as confirmToast, n as notifySuccess } from "./toast-DrUOosTv.js";
import "node:async_hooks";
import "react-dom/server";
import "react-router-dom/server.mjs";
import "react-toastify";
function Skeleton({ w = "100%", h = 14, r = 8, style }) {
  return /* @__PURE__ */ jsx("div", { className: "skeleton", style: { width: w, height: h, borderRadius: r, ...style } });
}
function SkeletonStats({ count = 4 }) {
  return /* @__PURE__ */ jsx("div", { className: "grid grid-cols-2 gap-3 md:grid-cols-4", children: Array.from({ length: count }).map((_, i) => /* @__PURE__ */ jsxs("div", { className: "card p-4.5", children: [
    /* @__PURE__ */ jsx(Skeleton, { w: "40%", h: 12 }),
    /* @__PURE__ */ jsx(Skeleton, { w: "60%", h: 26, style: { marginTop: 12 } })
  ] }, i)) });
}
function SkeletonList({ rows = 5 }) {
  return /* @__PURE__ */ jsx("div", { className: "flex flex-col gap-2.5", children: Array.from({ length: rows }).map((_, i) => /* @__PURE__ */ jsxs("div", { className: "card flex items-center gap-3.5 px-4.5 py-4", children: [
    /* @__PURE__ */ jsx(Skeleton, { w: 38, h: 38, r: 10 }),
    /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
      /* @__PURE__ */ jsx(Skeleton, { w: "45%", h: 13 }),
      /* @__PURE__ */ jsx(Skeleton, { w: "70%", h: 11, style: { marginTop: 8 } })
    ] }),
    /* @__PURE__ */ jsx(Skeleton, { w: 64, h: 24, r: 12 })
  ] }, i)) });
}
const PAGE_SIZE = 5;
function relTime(ts) {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 6e4);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function Pagination({ page, total, onPage }) {
  const pages = Math.ceil(total / PAGE_SIZE);
  if (pages <= 1) return null;
  return /* @__PURE__ */ jsxs("div", { className: "dash-pagination", children: [
    /* @__PURE__ */ jsx(
      "button",
      {
        className: "dash-page-btn",
        disabled: page === 0,
        onClick: () => onPage(page - 1),
        "aria-label": "Previous page",
        children: "‹"
      }
    ),
    /* @__PURE__ */ jsxs("span", { className: "dash-page-label", children: [
      page + 1,
      " / ",
      pages
    ] }),
    /* @__PURE__ */ jsx(
      "button",
      {
        className: "dash-page-btn",
        disabled: page === pages - 1,
        onClick: () => onPage(page + 1),
        "aria-label": "Next page",
        children: "›"
      }
    )
  ] });
}
function Dashboard() {
  const navigate = useNavigate();
  const locationId = getLocationId();
  const { config } = useAIConfig();
  const [page, setPage] = useState(0);
  const { data, loading, setData } = useCachedResource(`dashboard:${locationId}`, () => api.getDashboard());
  function goTo(path) {
    const u = new URL(path, window.location.origin);
    if (locationId) u.searchParams.set("locationId", locationId);
    navigate(u.pathname + u.search);
  }
  async function deleteCopy(e, copyId) {
    e.stopPropagation();
    if (!await confirmToast("Move this conversation to Archive? You can restore it later.", { confirmText: "Archive", danger: false })) return;
    setData((prev) => prev ? {
      ...prev,
      recentCopies: (prev.recentCopies || []).filter((c) => c.id !== copyId),
      totalCopies: Math.max(0, (prev.totalCopies ?? 1) - 1)
    } : prev);
    await api.deleteCopy(copyId).catch(() => {
    });
    notifySuccess("Moved to Archive");
  }
  if (loading) {
    return /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("div", { className: "topnav", children: /* @__PURE__ */ jsx("div", { className: "topnav-left", children: /* @__PURE__ */ jsx("span", { className: "breadcrumb-current", children: "Dashboard" }) }) }),
      /* @__PURE__ */ jsxs("div", { className: "content", children: [
        /* @__PURE__ */ jsx(SkeletonStats, { count: 4 }),
        /* @__PURE__ */ jsx("div", { style: { height: 20 } }),
        /* @__PURE__ */ jsx(SkeletonList, { rows: 5 })
      ] })
    ] });
  }
  const allCopies = (data == null ? void 0 : data.recentCopies) || [];
  const totalCopies = (data == null ? void 0 : data.totalCopies) ?? allCopies.length;
  const aiReady = !!(config == null ? void 0 : config.apiKey);
  const locationName = (data == null ? void 0 : data.locationName) || "My Location";
  const grouped = {};
  allCopies.forEach((c) => {
    const t = c.type || "general";
    if (!grouped[t]) grouped[t] = [];
    grouped[t].push(c);
  });
  const orderedTypes = [...TYPE_ORDER, ...Object.keys(grouped).filter((t) => !TYPE_ORDER.includes(t))].filter((t) => grouped[t]);
  const sortedCopies = [...allCopies].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const totalPages = Math.max(1, Math.ceil(sortedCopies.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages - 1);
  const pageSlice = sortedCopies.slice(pageSafe * PAGE_SIZE, pageSafe * PAGE_SIZE + PAGE_SIZE);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("div", { className: "topnav", children: [
      /* @__PURE__ */ jsx("div", { className: "topnav-left", children: /* @__PURE__ */ jsx("span", { className: "breadcrumb-current", children: "Dashboard" }) }),
      /* @__PURE__ */ jsx("div", { className: "topnav-right", children: aiReady ? /* @__PURE__ */ jsxs("span", { className: "chip chip-green", children: [
        /* @__PURE__ */ jsx("svg", { width: "8", height: "8", viewBox: "0 0 8 8", children: /* @__PURE__ */ jsx("circle", { cx: "4", cy: "4", r: "4", fill: "currentColor" }) }),
        "AI Active"
      ] }) : /* @__PURE__ */ jsx("span", { className: "chip chip-red", children: "AI not configured" }) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "content", children: [
      /* @__PURE__ */ jsxs("div", { className: "page-header", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("div", { className: "page-title", children: "Welcome back" }),
          /* @__PURE__ */ jsx("div", { className: "page-sub", children: locationName })
        ] }),
        /* @__PURE__ */ jsxs("button", { className: "btn btn-primary", onClick: () => goTo("/copywriters"), children: [
          /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "16", height: "16", children: [
            /* @__PURE__ */ jsx("path", { d: "M12 20h9" }),
            /* @__PURE__ */ jsx("path", { d: "M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" })
          ] }),
          "New Copy"
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "stat-grid", children: [
        /* @__PURE__ */ jsxs("div", { className: "stat-card", children: [
          /* @__PURE__ */ jsx("div", { className: "stat-label", children: "Total Copy" }),
          /* @__PURE__ */ jsx("div", { className: "stat-value", children: totalCopies })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "stat-card", children: [
          /* @__PURE__ */ jsx("div", { className: "stat-label", children: "Copywriters" }),
          /* @__PURE__ */ jsx("div", { className: "stat-value", children: Object.keys(TYPES).length })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "stat-card", children: [
          /* @__PURE__ */ jsx("div", { className: "stat-label", children: "AI Status" }),
          /* @__PURE__ */ jsx("div", { className: "stat-value", style: { fontSize: "1rem", marginTop: 8 }, children: aiReady ? /* @__PURE__ */ jsx("span", { className: "chip chip-green", children: "Active" }) : /* @__PURE__ */ jsx("span", { className: "chip chip-red", children: "Setup required" }) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "stat-card", children: [
          /* @__PURE__ */ jsx("div", { className: "stat-label", children: "Categories Used" }),
          /* @__PURE__ */ jsx("div", { className: "stat-value", children: orderedTypes.length })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "dash-cat-header", style: { marginBottom: 4 }, children: [
        /* @__PURE__ */ jsx("div", { className: "section-title", style: { margin: 0 }, children: "Recent Copy" }),
        /* @__PURE__ */ jsx(Pagination, { page: pageSafe, total: sortedCopies.length, onPage: setPage })
      ] }),
      allCopies.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "empty-state", children: [
        /* @__PURE__ */ jsx("div", { className: "empty-icon", children: "✍️" }),
        /* @__PURE__ */ jsx("div", { className: "empty-title", children: "No copy yet" }),
        /* @__PURE__ */ jsx("div", { className: "empty-sub", children: "Start a conversation with a Copywriter" }),
        /* @__PURE__ */ jsx("button", { className: "btn btn-primary mt-2", onClick: () => goTo("/copywriters"), children: "Open Copywriters" })
      ] }) : /* @__PURE__ */ jsx("div", { className: "recent-list", children: pageSlice.map((copy) => {
        const typeInfo = TYPES[copy.type] || TYPES.general;
        const link = copy.customerId && copy.customerId !== "_unsorted" ? `/library/${copy.customerId}/${copy.id}` : `/library/_unsorted/${copy.id}`;
        return /* @__PURE__ */ jsxs(
          "div",
          {
            className: "recent-item",
            onClick: () => goTo(link),
            children: [
              /* @__PURE__ */ jsxs("div", { className: "recent-info", children: [
                /* @__PURE__ */ jsx("div", { className: "recent-title", children: copy.title || "Untitled" }),
                copy.preview && /* @__PURE__ */ jsx("div", { className: "recent-preview", children: copy.preview })
              ] }),
              /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }, children: [
                /* @__PURE__ */ jsx("span", { className: "badge", style: { background: typeInfo.colorBg, color: typeInfo.color }, children: typeInfo.title.replace(" Copywriter", "") }),
                /* @__PURE__ */ jsx("div", { className: "recent-meta", children: relTime(copy.updatedAt) }),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    className: "btn btn-ghost btn-sm",
                    style: { color: "var(--danger)", padding: "4px 6px", minHeight: "auto" },
                    onClick: (e) => deleteCopy(e, copy.id),
                    title: "Archive",
                    children: /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "14", height: "14", children: [
                      /* @__PURE__ */ jsx("polyline", { points: "3 6 5 6 21 6" }),
                      /* @__PURE__ */ jsx("path", { d: "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" })
                    ] })
                  }
                )
              ] })
            ]
          },
          copy.id
        );
      }) }),
      /* @__PURE__ */ jsx("div", { className: "section-title", style: { marginTop: 32 }, children: "Copywriters" }),
      /* @__PURE__ */ jsx("div", { className: "card-grid", children: Object.entries(TYPES).slice(0, 3).map(([key, type]) => /* @__PURE__ */ jsxs(
        "div",
        {
          className: "type-card",
          onClick: () => goTo(`/copywriters/${key}`),
          children: [
            /* @__PURE__ */ jsx("div", { className: "type-card-icon", style: { background: type.colorBg }, children: /* @__PURE__ */ jsx(
              "span",
              {
                style: { color: type.color, width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center" },
                dangerouslySetInnerHTML: { __html: type.icon }
              }
            ) }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("h3", { children: type.title }),
              /* @__PURE__ */ jsx("p", { className: "mt-1", children: type.description })
            ] })
          ]
        },
        key
      )) }),
      /* @__PURE__ */ jsx("div", { style: { marginTop: 12, textAlign: "center" }, children: /* @__PURE__ */ jsx("button", { className: "btn btn-ghost text-sm", onClick: () => goTo("/copywriters"), children: "View all copywriters →" }) })
    ] })
  ] });
}
export {
  Dashboard as default
};
