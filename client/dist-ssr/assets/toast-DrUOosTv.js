import { jsxs, jsx } from "react/jsx-runtime";
import { toast } from "react-toastify";
const notifySuccess = (msg) => toast.success(msg);
const notifyError = (msg) => toast.error(msg);
function confirmToast(message, { confirmText = "Confirm", cancelText = "Cancel", danger = true } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (val) => {
      if (!settled) {
        settled = true;
        resolve(val);
      }
    };
    toast(
      ({ closeToast }) => /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("div", { style: { marginBottom: 12, fontSize: ".9rem", lineHeight: 1.4, color: "var(--text)" }, children: message }),
        /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 8, justifyContent: "flex-end" }, children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => {
                done(false);
                closeToast();
              },
              style: {
                padding: "6px 14px",
                borderRadius: 8,
                fontSize: ".8rem",
                fontWeight: 600,
                cursor: "pointer",
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--sub)"
              },
              children: cancelText
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => {
                done(true);
                closeToast();
              },
              style: {
                padding: "6px 14px",
                borderRadius: 8,
                fontSize: ".8rem",
                fontWeight: 700,
                cursor: "pointer",
                border: "none",
                background: danger ? "var(--danger, #DC2626)" : "var(--accent)",
                color: "#fff"
              },
              children: confirmText
            }
          )
        ] })
      ] }),
      {
        autoClose: false,
        closeOnClick: false,
        closeButton: false,
        draggable: false,
        onClose: () => done(false)
        // dismissed without choosing → treated as cancel
      }
    );
  });
}
export {
  notifyError as a,
  confirmToast as c,
  notifySuccess as n
};
