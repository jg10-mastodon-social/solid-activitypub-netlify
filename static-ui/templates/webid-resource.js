/**
 * @element webid-resource
 *
 * @summary A `<pos-resource>` whose `uri` is driven by the currently
 *   logged-in user's WebID.
 *
 * @description
 *   `webid-resource` is a thin wrapper around pod-os's `<pos-resource>`.
 *   On `connectedCallback` it:
 *
 *   1. Creates an inner `<pos-resource>`.
 *   2. Moves its light-DOM children into the inner element so they are
 *      projected into `<pos-resource>`'s default `<slot>` exactly as
 *      they would be if written directly inside a `<pos-resource>`.
 *   3. Waits for the nearest `<pos-app>` to be defined, dispatches
 *      `pod-os:init` to obtain the `os` instance, and subscribes to
 *      `os.observeSession()`.
 *
 *   On every session emission the inner `<pos-resource>`'s `uri` attribute
 *   is set to `session.webId` when logged in, or removed when logged out.
 *   The subscription is torn down on `disconnectedCallback`.
 *
 *   The element silently does nothing if no `<pos-app>` is present in the
 *   document or if the `pod-os:init` round-trip returns no `os` instance.
 *
 * @example
 *   <pos-app restore-previous-session>
 *     <webid-resource>
 *       <pos-list rel="http://www.w3.org/ns/solid/terms#publicTypeIndex" fetch>
 *         <template>…</template>
 *       </pos-list>
 *     </webid-resource>
 *   </pos-app>
 *
 * @slot - Default slot. Children are projected into the inner
 *   `<pos-resource>`'s default slot.
 *
 * @dependency pos-app - Required. The element queries
 *   `document.querySelector("pos-app")` and dispatches `pod-os:init`
 *   (bubbles, composed, cancelable) to obtain the `os` instance.
 *
 * @dependency pos-resource - Required. The inner element is created via
 *   `document.createElement("pos-resource")` and must be defined by the
 *   time `connectedCallback` runs. The pod-os elements library is loaded
 *   before this script in normal page setup, so this is automatic.
 */
export class WebidResource extends HTMLElement {
  connectedCallback() {
    this._disposers = [];
    this._init().catch(() => {});
  }

  disconnectedCallback() {
    this._disposers.forEach(fn => fn());
    this._disposers = [];
  }

  async _init() {
    await customElements.whenDefined("pos-resource");

    const inner = document.createElement("pos-resource");
    while (this.firstChild) inner.appendChild(this.firstChild);
    this.appendChild(inner);

    await customElements.whenDefined("pos-app");
    if (!this.isConnected) return;

    const posApp = document.querySelector("pos-app");
    if (!posApp) return;

    const os = await new Promise(resolve => {
      posApp.dispatchEvent(new CustomEvent("pod-os:init", {
        bubbles: true,
        composed: true,
        cancelable: true,
        detail: os => resolve(os),
      }));
    });
    if (!os || !this.isConnected) return;

    const apply = session => {
      if (session.isLoggedIn && session.webId) {
        inner.setAttribute("uri", session.webId);
      } else {
        inner.removeAttribute("uri");
      }
    };

    const subscription = os.observeSession().subscribe(apply);
    this._disposers.push(() => subscription.unsubscribe());
  }
}

if (typeof customElements !== "undefined" && !customElements.get("webid-resource")) {
  customElements.define("webid-resource", WebidResource);
}