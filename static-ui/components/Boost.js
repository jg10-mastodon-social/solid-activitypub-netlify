/**
 * Boost component for boosting ActivityPub activities.
 * Posts an Announce activity to the user's outbox.
 *
 * @element boost-component
 *
 * @fires boosting-error - Fired on error. Detail: {message: string}
 * @fires boosting-success - Fired on successful boost. Detail: {url: string}
 *
 * @attr {string} outbox - URL of ActivityPub outbox. Optional. Supports {binding}
 *   interpolation. If omitted, resolved from the resolved actor's profile
 *   (as:outbox) on every boost click.
 * @attr {string} actor - URL of the posting actor. Optional. Supports {binding}
 *   interpolation. If omitted, resolved from the closest ancestor element with
 *   bind-subject="actor" (or bind-object="actor"). May contain a
 *   space-separated list of actor URLs; when 2 or more are present, a picker
 *   is rendered in the shadow DOM and the selected actor is used for the
 *   boost.
 *
 * CSRF: relies on DPoP-bound tokens via this.os.session.authenticatedFetch.
 * Pages embedding this component should set a Content-Security-Policy with
 * frame-ancestors to prevent clickjacking.
 */
import { ReceiveResourceOS } from "./ReceiveResourceOS.js";

class Boost extends ReceiveResourceOS {
  constructor() {
    super();
    const template = document.createElement("template");
    template.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: sans-serif;
        }
        select[name="actor-picker"] {
          margin-right: 8px;
          padding: 8px;
          border: 1px solid #ccc;
          border-radius: 4px;
          font: inherit;
        }
        button {
          padding: 8px 16px;
          background: #0066cc;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        button:hover {
          background: #0055aa;
        }
        button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }
        button.saving {
          position: relative;
        }
        button.saving::before {
          content: "";
          display: inline-block;
          width: 12px;
          height: 12px;
          border: 2px solid #fff;
          border-top-color: transparent;
          border-radius: 50%;
          margin-right: 6px;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .error {
          color: #cc0000;
          margin-top: 8px;
          padding: 8px;
          background: #fff0f0;
          border-radius: 4px;
          font-size: 14px;
        }
        .success {
          color: #006600;
          margin-top: 8px;
          padding: 8px;
          background: #f0fff0;
          border-radius: 4px;
          font-size: 14px;
        }
      </style>
      <div>
        <button name="boost">Boost</button>
        <div class="error" style="display:none;"></div>
        <div class="success" style="display:none;"></div>
      </div>
    `;

    const shadowRoot = this.attachShadow({ mode: "open" });
    shadowRoot.appendChild(template.content.cloneNode(true));

    this._boostButton = this.shadowRoot.querySelector('button[name="boost"]');
    this._boostButton.addEventListener("click", () => {
      this.boost();
    });

    // Wrap parent setOs so the actor picker is rendered (with labels) once
    // the os is available. The parent setOs is an instance arrow-function
    // field, so it cannot be invoked via super.setOs; capture and call it
    // explicitly.
    const parentSetOs = this.setOs;
    this.setOs = async os => {
      await parentSetOs.call(this, os);
      await this._renderActorPicker();
    };
  }

  connectedCallback() {
    super.connectedCallback();
  }

  get outbox() {
    return this.getAttribute("outbox");
  }

  set outbox(value) {
    this.setAttribute("outbox", value);
  }

  get actor() {
    return this.getAttribute("actor");
  }

  set actor(value) {
    this.setAttribute("actor", value);
  }

  async boost() {
    if (!this.os) {
      this._showError("PodOS not initialized");
      this.dispatchEvent(
        new CustomEvent("boosting-error", {
          bubbles: true,
          composed: true,
          detail: { message: "PodOS not initialized" }
        })
      );
      return;
    }

    const actor = this._resolveActor();
    if (!actor) {
      const message = "Actor not provided and no ancestor bound as 'actor'";
      this._showError(message);
      this.dispatchEvent(
        new CustomEvent("boosting-error", {
          bubbles: true,
          composed: true,
          detail: { message }
        })
      );
      return;
    }

    this._setButtonLoading(true);

    const outboxResult = this._resolveOutbox(actor);
    let outbox;
    if (typeof outboxResult === "string") {
      outbox = outboxResult;
    } else {
      outbox = await outboxResult;
    }
    if (!outbox) {
      this._resetButton();
      const message = "Outbox not provided and actor's profile has no as:outbox";
      this._showError(message);
      this.dispatchEvent(
        new CustomEvent("boosting-error", {
          bubbles: true,
          composed: true,
          detail: { message }
        })
      );
      return;
    }

    const objectToBoost = this._getObjectToBoost();
    if (!objectToBoost) {
      this._resetButton();
      const message = "No activity to boost";
      this._showError(message);
      this.dispatchEvent(
        new CustomEvent("boosting-error", {
          bubbles: true,
          composed: true,
          detail: { message }
        })
      );
      return;
    }

    const published = new Date().toISOString();
    const activity = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "Announce",
      actor,
      object: objectToBoost,
      published,
      to: ["https://www.w3.org/ns/activitystreams#Public"],
      cc: []
    };

    const response = await this.os.session.authenticatedFetch(outbox, {
      method: "POST",
      body: JSON.stringify(activity),
      headers: {
        "Content-Type": "application/activity+json"
      }
    });

    if (response.status < 200 || response.status >= 300) {
      const errMsg = `Failed to boost: ${response.status}`;
      this._showError(errMsg);
      this._resetButton();
      this.dispatchEvent(
        new CustomEvent("boosting-error", {
          bubbles: true,
          composed: true,
          detail: { message: errMsg }
        })
      );
      return;
    }

    this._showSuccess("Boosted successfully!");
    this._resetButton();
    this.dispatchEvent(
      new CustomEvent("boosting-success", {
        bubbles: true,
        composed: true,
        detail: { url: outbox }
      })
    );
  }

  _resolveActor() {
    const actors = this._actorList();
    if (actors.length === 0) return null;
    if (actors.length === 1) return actors[0];
    return this._selectedActor || actors[0];
  }

  _actorList() {
    const explicit = this.expandTemplate(this.getAttribute("actor"));
    if (explicit) return explicit.split(/\s+/).filter(s => s.length > 0);
    const bound = this.valueFromBinding("actor");
    if (bound) return bound.split(/\s+/).filter(s => s.length > 0);
    return [];
  }

  async _renderActorPicker() {
    const actors = this._actorList();
    let select = this.shadowRoot.querySelector('select[name="actor-picker"]');

    if (actors.length < 2) {
      if (select) select.remove();
      this._selectedActor = actors[0] || null;
      return;
    }

    if (!select) {
      select = document.createElement("select");
      select.name = "actor-picker";
      select.addEventListener("change", () => {
        this._selectedActor = select.value;
      });
      this._boostButton.parentNode.insertBefore(select, this._boostButton);
    }

    select.replaceChildren();
    for (const uri of actors) {
      if (this.os?.store?.fetch) {
        try {
          await this.os.store.fetch(uri);
        } catch (e) {
          // ignore — label() will fall back to the URI
        }
      }
      const label = this.os?.store?.get ? this.os.store.get(uri).label() : uri;
      const option = document.createElement("option");
      option.value = uri;
      option.textContent = label;
      select.appendChild(option);
    }

    if (!this._selectedActor || !actors.includes(this._selectedActor)) {
      this._selectedActor = actors[0];
    }
    select.value = this._selectedActor;
  }

  _resolveOutbox(actor) {
    let explicit = this.expandTemplate(this.getAttribute("outbox"));
    if (explicit) return explicit;
    explicit = this.valueFromBinding("outbox");
    if (explicit) return explicit;
    return this._lookupOutboxInProfile(actor);
  }

  async _lookupOutboxInProfile(actor) {
    await this.os.store.fetch(actor);
    return this.os.store.get(actor).anyValue(
      "https://www.w3.org/ns/activitystreams#outbox"
    );
  }

  expandTemplate(value) {
    if (value?.startsWith("{") && value?.endsWith("}")) {
      const binding = value.slice(1, -1);
      return this.valueFromBinding(binding);
    }
    return value;
  }

  valueFromBinding(binding) {
    const el = this
      .closest(
        `:has([bind-object='${binding}'],[bind-subject='${binding}'])`
      )
      ?.querySelector(
        `[bind-object='${binding}'],[bind-subject='${binding}']`
      );
    if (!el) return null;
    return el.getAttribute("bind-subject") == binding
      ? el.resource?.uri
      : el.value || el.getAttribute("value") || el.innerText;
  }

  _getObjectToBoost() {
    if (!this.resource) return null;
    const isCreate = this.resource
      .types()
      .some(t => t.uri === "https://www.w3.org/ns/activitystreams#Create");
    const objectUri = isCreate
      ? this.resource.anyValue(
          "https://www.w3.org/ns/activitystreams#object"
        )
      : this.resource.uri;
    if (!objectUri) return null;
    const constructed = this._constructObject(objectUri);
    return constructed.type ? constructed : objectUri;
  }

  _constructObject(uri) {
    const kb = this.os.store.graph;
    const subject = kb.sym(uri);
    const obj = { id: uri };

    const types = kb
      .each(subject, kb.sym("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"))
      .map(t => t.value);
    if (types.length > 0) obj.type = types[0];

    const predicateMap = {
      "https://www.w3.org/ns/activitystreams#content": "content",
      "https://www.w3.org/ns/activitystreams#name": "name",
      "https://www.w3.org/ns/activitystreams#summary": "summary",
      "https://www.w3.org/ns/activitystreams#attributedTo": "attributedTo",
      "https://www.w3.org/ns/activitystreams#published": "published",
      "https://www.w3.org/ns/activitystreams#updated": "updated",
      "https://www.w3.org/ns/activitystreams#url": "url",
      "https://www.w3.org/ns/activitystreams#inReplyTo": "inReplyTo",
      "https://www.w3.org/ns/activitystreams#to": "to",
      "https://www.w3.org/ns/activitystreams#cc": "cc",
      "https://www.w3.org/ns/activitystreams#bcc": "bcc",
      "https://www.w3.org/ns/activitystreams#tag": "tag",
      "https://www.w3.org/ns/activitystreams#attachment": "attachment",
      "https://www.w3.org/ns/activitystreams#image": "image",
      "https://www.w3.org/ns/activitystreams#sensitive": "sensitive",
      "https://www.w3.org/ns/activitystreams#replies": "replies"
    };

    for (const [predUri, key] of Object.entries(predicateMap)) {
      const values = kb.each(subject, kb.sym(predUri)).map(v => v.value);
      if (values.length === 0) continue;
      obj[key] = values.length === 1 ? values[0] : values;
    }

    return obj;
  }

  _setButtonLoading(loading) {
    if (this._boostButton) {
      this._boostButton.disabled = loading;
      if (loading) {
        this._boostButton.classList.add("saving");
      }
    }
  }

  _resetButton() {
    if (this._boostButton) {
      this._boostButton.disabled = false;
      this._boostButton.classList.remove("saving");
    }
  }

  _clearError() {
    const errorDiv = this.shadowRoot.querySelector(".error");
    if (errorDiv) {
      errorDiv.remove();
    }
  }

  _showError(message) {
    this._clearSuccess();
    const errorDiv = document.createElement("div");
    errorDiv.className = "error";
    errorDiv.textContent = message;
    this.shadowRoot.querySelector("div").appendChild(errorDiv);
  }

  _clearSuccess() {
    const successDiv = this.shadowRoot.querySelector(".success");
    if (successDiv) {
      successDiv.textContent = "";
      successDiv.style.display = "none";
    }
  }

  _showSuccess(message) {
    this._clearError();
    const successDiv = this.shadowRoot.querySelector(".success");
    if (successDiv) {
      successDiv.textContent = message;
      successDiv.style.display = "block";
    }
  }
}

if (!customElements.get("boost-component")) {
  customElements.define("boost-component", Boost);
}
