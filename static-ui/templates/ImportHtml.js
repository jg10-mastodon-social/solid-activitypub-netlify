class ImportHtml extends HTMLElement {
  connectedCallback() {
    const srcUrl = new URL(this.getAttribute("src"), window.location.href);
    fetch(srcUrl.href)
      .then((response) => response.text())
      .then((text) => (this.innerHTML = text));
  }
}
customElements.define("import-html", ImportHtml);