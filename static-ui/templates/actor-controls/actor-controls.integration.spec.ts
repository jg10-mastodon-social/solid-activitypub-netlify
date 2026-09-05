import { describe, it, expect, vi } from "vitest";
import { wireWebidLoader } from "./actor-controls.js";

interface MockSession {
  isLoggedIn: boolean;
  webId?: string;
}

interface MockSubscription {
  unsubscribe: () => void;
}

interface MockOs {
  observeSession: () => { subscribe: (cb: (session: MockSession) => void) => MockSubscription };
}

interface MockLoader {
  setAttribute: (name: string, value: string) => void;
  removeAttribute: (name: string) => void;
}

interface MockDocument {
  getElementById: (id: string) => MockLoader | null;
}

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

function makeMockDocument(loader: MockLoader | null = null): MockDocument {
  return {
    getElementById: vi.fn().mockReturnValue(loader),
  };
}

function makeMockLoader(): MockLoader {
  return {
    setAttribute: vi.fn(),
    removeAttribute: vi.fn(),
  };
}

describe("actor-controls.js wiring", () => {
  it("sets the loader uri when the session reports a logged-in webId", () => {
    const loader = makeMockLoader();
    const document = makeMockDocument(loader);
    const { os, emit } = makeMockOs();

    wireWebidLoader(os, document);

    expect(loader.setAttribute).not.toHaveBeenCalled();
    expect(loader.removeAttribute).not.toHaveBeenCalled();

    emit({ isLoggedIn: true, webId: "https://alice.example/webid#me" });

    expect(loader.setAttribute).toHaveBeenCalledWith("uri", "https://alice.example/webid#me");
  });

  it("removes the loader uri when the session reports logged-out", () => {
    const loader = makeMockLoader();
    const document = makeMockDocument(loader);
    const { os, emit } = makeMockOs();

    wireWebidLoader(os, document);

    emit({ isLoggedIn: false });

    expect(loader.removeAttribute).toHaveBeenCalledWith("uri");
    expect(loader.setAttribute).not.toHaveBeenCalled();
  });

  it("does not touch the loader when logged-in but webId is missing", () => {
    const loader = makeMockLoader();
    const document = makeMockDocument(loader);
    const { os, emit } = makeMockOs();

    wireWebidLoader(os, document);

    emit({ isLoggedIn: true });

    expect(loader.setAttribute).not.toHaveBeenCalled();
    expect(loader.removeAttribute).toHaveBeenCalledWith("uri");
  });

  it("returns a no-op disposer when no loader exists in the document", () => {
    const document = makeMockDocument(null);
    const { os, subscription } = makeMockOs();

    const dispose = wireWebidLoader(os, document);

    expect(typeof dispose).toBe("function");
    dispose();
    expect(subscription.unsubscribe).toHaveBeenCalled();
    expect(document.getElementById).toHaveBeenCalledWith("webid-loader");
  });
});