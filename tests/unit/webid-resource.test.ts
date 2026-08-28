// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";

interface MockSession {
  isLoggedIn: boolean;
  webId?: string;
}

interface MockSubscription {
  unsubscribe: ReturnType<typeof vi.fn>;
}

interface MockOs {
  observeSession: () => { subscribe: (cb: (session: MockSession) => void) => MockSubscription };
}

class PosResourceStub extends HTMLElement {}
class PosAppStub extends HTMLElement {
  constructor() {
    super();
    this._mockOs = null;
    this.addEventListener("pod-os:init", (event) => {
      const detail = event.detail;
      detail(this._mockOs);
    });
  }
  setMockOs(os) {
    this._mockOs = os;
  }
}

customElements.define("pos-resource", PosResourceStub);
customElements.define("pos-app", PosAppStub);

import { WebidResource } from "../../static-ui/templates/webid-resource.js";

beforeEach(() => {
  document.body.innerHTML = "";
});

function makeMockOs(): { os: MockOs; emit: (session: MockSession) => void; subscription: MockSubscription } {
  const subscription: MockSubscription = { unsubscribe: vi.fn() };
  let emitFn: ((session: MockSession) => void) | null = null;
  const os: MockOs = {
    observeSession: () => ({
      subscribe: (cb: (session: MockSession) => void) => {
        emitFn = cb;
        return subscription;
      },
    }),
  };
  return {
    os,
    emit: (session: MockSession) => emitFn?.(session),
    subscription,
  };
}

function makePosAppWithMockOs(): { posApp: PosAppStub; emit: (session: MockSession) => void; subscription: MockSubscription; os: MockOs } {
  const posApp = document.createElement("pos-app") as PosAppStub;
  document.body.appendChild(posApp);
  const { os, emit, subscription } = makeMockOs();
  posApp.setMockOs(os);
  return { posApp, emit, subscription, os };
}

// happy-dom does not upgrade an element created with `createElement` until
// something triggers the upgrade (e.g. an `instanceof` check, a property
// access on the prototype, or an upgrade hint). Force the upgrade before
// appending so `connectedCallback` fires.
function createWebidResource(): WebidResource {
  const el = document.createElement("webid-resource") as WebidResource;
  // Touch `instanceof` to force happy-dom to perform the upgrade synchronously.
  void (el instanceof WebidResource);
  return el;
}

describe("webid-resource custom element", () => {
  it("creates exactly one <pos-resource> child on connect", async () => {
    const wrapper = createWebidResource();
    document.body.appendChild(wrapper);
    await new Promise(resolve => setTimeout(resolve, 100));
    const inners = wrapper.querySelectorAll("pos-resource");
    expect(inners.length).toBe(1);
    wrapper.remove();
  });

  it("creates an inner <pos-resource> with no id of its own", async () => {
    const wrapper = createWebidResource();
    wrapper.id = "webid-loader";
    document.body.appendChild(wrapper);
    await new Promise(resolve => setTimeout(resolve, 100));
    const inner = wrapper.querySelector("pos-resource");
    expect(inner).not.toBeNull();
    expect(inner?.id).not.toBe("webid-loader");
    wrapper.remove();
  });

  it("moves its projected children into the inner <pos-resource>", async () => {
    const child = document.createElement("span");
    child.textContent = "hello";
    const wrapper = createWebidResource();
    wrapper.appendChild(child);
    document.body.appendChild(wrapper);
    await new Promise(resolve => setTimeout(resolve, 100));

    const inner = wrapper.querySelector("pos-resource");
    expect(wrapper.firstChild).toBe(inner);
    expect(wrapper === child.parentElement).toBe(false);
    expect(inner?.contains(child)).toBe(true);
    wrapper.remove();
  });

  it("sets uri on the inner <pos-resource> when the session reports a logged-in webId", async () => {
    const { emit } = makePosAppWithMockOs();
    const wrapper = createWebidResource();
    wrapper.appendChild(document.createElement("span"));
    document.body.appendChild(wrapper);
    await new Promise(resolve => setTimeout(resolve, 100));
    const inner = wrapper.querySelector("pos-resource") as PosResourceStub;
    expect(inner).not.toBeNull();
    const setSpy = vi.spyOn(inner, "setAttribute");
    emit({ isLoggedIn: true, webId: "https://alice.example/webid#me" });
    expect(setSpy).toHaveBeenCalledWith("uri", "https://alice.example/webid#me");
    wrapper.remove();
  });

  it("removes uri from the inner <pos-resource> when the session reports logged-out", async () => {
    const { emit } = makePosAppWithMockOs();
    const wrapper = createWebidResource();
    wrapper.appendChild(document.createElement("span"));
    document.body.appendChild(wrapper);
    await new Promise(resolve => setTimeout(resolve, 100));
    const inner = wrapper.querySelector("pos-resource") as PosResourceStub;
    expect(inner).not.toBeNull();
    const removeSpy = vi.spyOn(inner, "removeAttribute");
    emit({ isLoggedIn: false });
    expect(removeSpy).toHaveBeenCalledWith("uri");
    wrapper.remove();
  });

  it("updates uri on the inner <pos-resource> when webId changes after a logged-out state", async () => {
    const { emit } = makePosAppWithMockOs();
    const wrapper = createWebidResource();
    wrapper.appendChild(document.createElement("span"));
    document.body.appendChild(wrapper);
    await new Promise(resolve => setTimeout(resolve, 100));
    const inner = wrapper.querySelector("pos-resource") as PosResourceStub;
    expect(inner).not.toBeNull();
    const setSpy = vi.spyOn(inner, "setAttribute");
    emit({ isLoggedIn: false });
    emit({ isLoggedIn: true, webId: "https://bob.example/webid#me" });
    expect(setSpy).toHaveBeenCalledWith("uri", "https://bob.example/webid#me");
    wrapper.remove();
  });

  it("does nothing on logged-in emission when webId is missing", async () => {
    const { emit } = makePosAppWithMockOs();
    const wrapper = createWebidResource();
    wrapper.appendChild(document.createElement("span"));
    document.body.appendChild(wrapper);
    await new Promise(resolve => setTimeout(resolve, 100));
    const inner = wrapper.querySelector("pos-resource") as PosResourceStub;
    expect(inner).not.toBeNull();
    const setSpy = vi.spyOn(inner, "setAttribute");
    const removeSpy = vi.spyOn(inner, "removeAttribute");
    emit({ isLoggedIn: true });
    expect(setSpy).not.toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalledWith("uri");
    wrapper.remove();
  });

  it("unsubscribes from the session on disconnect", async () => {
    const { subscription } = makePosAppWithMockOs();
    const wrapper = createWebidResource();
    wrapper.appendChild(document.createElement("span"));
    document.body.appendChild(wrapper);
    await new Promise(resolve => setTimeout(resolve, 100));
    wrapper.remove();
    expect(subscription.unsubscribe).toHaveBeenCalled();
  });

  it("does not throw and does not set uri when no <pos-app> is in the document", async () => {
    const wrapper = createWebidResource();
    const child = document.createElement("span");
    wrapper.appendChild(child);
    document.body.appendChild(wrapper);
    await new Promise(resolve => setTimeout(resolve, 100));
    const inner = wrapper.querySelector("pos-resource");
    expect(inner).not.toBeNull();
    const setSpy = vi.spyOn(inner as PosResourceStub, "setAttribute");
    expect(setSpy).not.toHaveBeenCalled();
    wrapper.remove();
  });

  it("does not throw and does not set uri when pod-os:init returns undefined", async () => {
    const posApp = document.createElement("pos-app") as PosAppStub;
    document.body.appendChild(posApp);
    const wrapper = createWebidResource();
    const child = document.createElement("span");
    wrapper.appendChild(child);
    document.body.appendChild(wrapper);
    await new Promise(resolve => setTimeout(resolve, 100));
    const inner = wrapper.querySelector("pos-resource");
    expect(inner).not.toBeNull();
    const setSpy = vi.spyOn(inner as PosResourceStub, "setAttribute");
    expect(setSpy).not.toHaveBeenCalled();
    wrapper.remove();
  });
});