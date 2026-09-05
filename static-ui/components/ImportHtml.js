/**
 * Inline an HTML fragment by URL.
 *
 * @element import-html
 *
 * Fetches the resource at `src` and inserts the response body into the
 * element's light DOM via `innerHTML`. Relative URLs in `src` are resolved
 * against `window.location.href`.
 *
 * @attr {string} src - URL of the HTML fragment to inline. Required.
 *   Resolved against the host document's location; relative paths inside
 *   the fetched HTML are *not* rewritten against the source URL.
 *
 * The element currently emits no events. Fetch rejections are swallowed by
 * the `then` chain, leaving the element empty with no signal to listeners.
 *
 * Security: setting `innerHTML` from a fetched response is an HTML-injection
 * sink. Operators should only point `src` at HTML they trust (in this
 * project, fragments under `/templates/` served from the same origin).
 *
 * Wiring: registered on module load via the trailing `customElements.define`
 * call. Typically loaded as a deferred script — e.g.
 * `<script src="/components/ImportHtml.js" defer></script>` — from any page
 * that uses the element.
 */
class ImportHtml extends HTMLElement {
  connectedCallback() {
    const srcUrl = new URL(this.getAttribute("src"), window.location.href);
    fetch(srcUrl.href)
      .then((response) => response.text())
      .then((text) => (this.innerHTML = text));
  }
}
customElements.define("import-html", ImportHtml);