export function wireWebidLoader(os, document) {
  const loader = document.getElementById("webid-loader");
  if (!loader) return () => {};
  const subscription = os.observeSession().subscribe((session) => {
    if (session.isLoggedIn && session.webId) {
      loader.setAttribute("uri", session.webId);
    } else {
      loader.removeAttribute("uri");
    }
  });
  return () => subscription.unsubscribe();
}

if (typeof document !== "undefined") {
  function usePodOS(el) {
    return new Promise((resolve) => {
      el.dispatchEvent(
        new CustomEvent("pod-os:init", {
          bubbles: true,
          composed: true,
          cancelable: true,
          detail: (os) => resolve(os),
        })
      );
    });
  }
  document.addEventListener("DOMContentLoaded", async () => {
    const posApp = document.querySelector("pos-app");
    if (!posApp) return;
    const os = await usePodOS(posApp);
    wireWebidLoader(os, document);
  });
}