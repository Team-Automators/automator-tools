import { jsxs, Fragment, jsx } from "react/jsx-runtime";
import { useNavigate } from "react-router-dom";
import { a as TYPES } from "./types-nNhWZ2i7.js";
import { g as getLocationId } from "../entry-server.mjs";
import "node:async_hooks";
import "react-dom/server";
import "react-router-dom/server.mjs";
import "react";
import "react-toastify";
function CopywritersList() {
  const navigate = useNavigate();
  const locationId = getLocationId();
  function goTo(type) {
    const u = new URL(`/copywriters/${type}`, window.location.origin);
    if (locationId) u.searchParams.set("locationId", locationId);
    navigate(u.pathname + u.search);
  }
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("div", { className: "topnav", children: /* @__PURE__ */ jsxs("div", { className: "topnav-left", children: [
      /* @__PURE__ */ jsx("span", { className: "breadcrumb", children: "Dashboard" }),
      /* @__PURE__ */ jsx("span", { className: "breadcrumb-sep", children: "/" }),
      /* @__PURE__ */ jsx("span", { className: "breadcrumb-current", children: "Copywriters" })
    ] }) }),
    /* @__PURE__ */ jsxs("div", { className: "content", children: [
      /* @__PURE__ */ jsx("div", { className: "page-header", children: /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("div", { className: "page-title", children: "Copywriters" }),
        /* @__PURE__ */ jsx("div", { className: "page-sub", children: "Select a specialist to start generating copy" })
      ] }) }),
      /* @__PURE__ */ jsx("div", { className: "card-grid", children: Object.entries(TYPES).map(([key, type]) => /* @__PURE__ */ jsxs(
        "div",
        {
          className: "type-card",
          onClick: () => goTo(key),
          role: "button",
          tabIndex: 0,
          onKeyDown: (e) => e.key === "Enter" && goTo(key),
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
              /* @__PURE__ */ jsx("p", { style: { color: "var(--sub)", fontSize: ".8125rem", lineHeight: 1.5, marginTop: 4 }, children: type.description })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "type-card-arrow", children: [
              "Start session",
              /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", width: "14", height: "14", children: /* @__PURE__ */ jsx("path", { d: "M5 12h14M12 5l7 7-7 7" }) })
            ] })
          ]
        },
        key
      )) })
    ] })
  ] });
}
export {
  CopywritersList as default
};
