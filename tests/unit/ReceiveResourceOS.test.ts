// @ts-nocheck — component is imported from static-ui/components/ outside
// the tsconfig include; suppress the resulting diagnostics.
// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ReceiveResourceOS } from "../../static-ui/components/ReceiveResourceOS.js";

class TestReceive extends ReceiveResourceOS {}
if (!customElements.get("test-receive")) {
  customElements.define("test-receive", TestReceive);
}

interface OsHandlers {
  os: { tag: string };
  receiveResource: ((resource: unknown) => Promise<unknown>) | null;
  setOs: ((os: unknown) => Promise<unknown>) | null;
}

function attachOsHandlers(el: HTMLElement, os: { tag: string }): OsHandlers {
  const captured: OsHandlers = {
    os,
    receiveResource: null,
    setOs: null,
  };
  el.addEventListener("pod-os:resource", (event) => {
    const ev = event as CustomEvent;
    captured.receiveResource = ev.detail as (resource: unknown) => Promise<unknown>;
  });
  el.addEventListener("pod-os:init", (event) => {
    const ev = event as CustomEvent;
    captured.setOs = ev.detail as (os: unknown) => Promise<unknown>;
    ev.detail(os);
    event.stopImmediatePropagation();
  });
  return captured;
}

function createInstance(): TestReceive {
  const el = document.createElement("test-receive") as TestReceive;
  void (el instanceof TestReceive);
  return el;
}

beforeEach(() => {
  document.body.innerHTML = "";
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("ReceiveResourceOS custom element", () => {
  describe("connectedCallback wires init()", () => {
    it("calls init() on connect", () => {
      const el = createInstance();
      const initSpy = vi.spyOn(el, "init");
      document.body.appendChild(el);
      expect(initSpy).toHaveBeenCalledTimes(1);
      el.remove();
    });
  });

  describe("init() dispatches custom events", () => {
    it("dispatches pod-os:resource on connect", () => {
      const el = createInstance();
      const seen: string[] = [];
      el.addEventListener("pod-os:resource", () => seen.push("resource"));
      document.body.appendChild(el);
      expect(seen).toContain("resource");
      el.remove();
    });

    it("dispatches pod-os:init on connect", () => {
      const el = createInstance();
      const seen: string[] = [];
      el.addEventListener("pod-os:init", () => seen.push("init"));
      document.body.appendChild(el);
      expect(seen).toContain("init");
      el.remove();
    });

    it("sets bubbles, composed, cancelable on pod-os:resource", () => {
      const el = createInstance();
      let event: CustomEvent | null = null;
      el.addEventListener("pod-os:resource", (e) => {
        event = e as CustomEvent;
      });
      document.body.appendChild(el);
      expect(event).not.toBeNull();
      expect(event!.bubbles).toBe(true);
      expect(event!.composed).toBe(true);
      expect(event!.cancelable).toBe(true);
      el.remove();
    });

    it("sets bubbles, composed, cancelable on pod-os:init", () => {
      const el = createInstance();
      let event: CustomEvent | null = null;
      el.addEventListener("pod-os:init", (e) => {
        event = e as CustomEvent;
      });
      document.body.appendChild(el);
      expect(event).not.toBeNull();
      expect(event!.bubbles).toBe(true);
      expect(event!.composed).toBe(true);
      expect(event!.cancelable).toBe(true);
      el.remove();
    });

    it("puts receiveResource itself in pod-os:resource.detail", () => {
      const el = createInstance();
      let detail: unknown = undefined;
      el.addEventListener("pod-os:resource", (e) => {
        detail = (e as CustomEvent).detail;
      });
      document.body.appendChild(el);
      expect(detail).toBe(el.receiveResource);
      el.remove();
    });

    it("puts setOs itself in pod-os:init.detail", () => {
      const el = createInstance();
      let detail: unknown = undefined;
      el.addEventListener("pod-os:init", (e) => {
        detail = (e as CustomEvent).detail;
      });
      document.body.appendChild(el);
      expect(detail).toBe(el.setOs);
      el.remove();
    });

    it("dispatches both pod-os:resource and pod-os:init on each connect", () => {
      const el = createInstance();
      const seen: string[] = [];
      el.addEventListener("pod-os:resource", () => seen.push("resource"));
      el.addEventListener("pod-os:init", () => seen.push("init"));
      document.body.appendChild(el);
      expect(seen).toContain("resource");
      expect(seen).toContain("init");
      expect(seen.length).toBe(2);
      el.remove();
    });
  });

  describe("receiveResource validation", () => {
    it("returns false for undefined resource", async () => {
      const el = createInstance();
      document.body.appendChild(el);
      const updateSpy = vi.spyOn(el, "update");
      const result = await el.receiveResource(undefined);
      expect(result).toBe(false);
      expect((el as unknown as { resource?: unknown }).resource).toBeUndefined();
      expect(updateSpy).not.toHaveBeenCalled();
      el.remove();
    });

    it("returns false for null resource", async () => {
      const el = createInstance();
      document.body.appendChild(el);
      const updateSpy = vi.spyOn(el, "update");
      const result = await el.receiveResource(null);
      expect(result).toBe(false);
      expect((el as unknown as { resource?: unknown }).resource).toBeUndefined();
      expect(updateSpy).not.toHaveBeenCalled();
      el.remove();
    });

    it("returns false for a resource without uri", async () => {
      const el = createInstance();
      document.body.appendChild(el);
      const updateSpy = vi.spyOn(el, "update");
      const result = await el.receiveResource({});
      expect(result).toBe(false);
      expect((el as unknown as { resource?: unknown }).resource).toBeUndefined();
      expect(updateSpy).not.toHaveBeenCalled();
      el.remove();
    });

    it("stores resource and calls update() exactly once for a valid resource, returning true", async () => {
      const el = createInstance();
      document.body.appendChild(el);
      const updateSpy = vi.spyOn(el, "update");
      const resource = { uri: "https://example.test/x" };
      const result = await el.receiveResource(resource);
      expect(result).toBe(true);
      expect((el as unknown as { resource?: unknown }).resource).toBe(resource);
      expect(updateSpy).toHaveBeenCalledTimes(1);
      el.remove();
    });

    it("is reachable through the pod-os:resource event detail", async () => {
      const el = createInstance();
      const os = { tag: "mock-os" };
      const handlers = attachOsHandlers(el, os);
      document.body.appendChild(el);
      expect(handlers.receiveResource).not.toBeNull();
      const resource = { uri: "https://example.test/things/1" };
      await handlers.receiveResource!(resource);
      expect((el as unknown as { resource?: unknown }).resource).toBe(resource);
      el.remove();
    });
  });

  describe("setOs flow", () => {
    it("stores the os instance on this.os", async () => {
      const el = createInstance();
      document.body.appendChild(el);
      const os = { tag: "mock-os" };
      await el.setOs(os);
      expect((el as unknown as { os?: unknown }).os).toBe(os);
      el.remove();
    });

    it("calls update() when no resource was previously stored", async () => {
      const el = createInstance();
      document.body.appendChild(el);
      const updateSpy = vi.spyOn(el, "update");
      await el.setOs({ tag: "mock-os" });
      // receiveResource(undefined) returns false (no update); the fallback branch in setOs calls update().
      expect(updateSpy).toHaveBeenCalledTimes(1);
      el.remove();
    });

    it("calls update() exactly once when a resource is already stored (fallback branch is suppressed because receiveResource now resolves to true)", async () => {
      const el = createInstance();
      document.body.appendChild(el);
      const resource = { uri: "https://example.test/y" };
      await el.receiveResource(resource);
      const updateSpy = vi.spyOn(el, "update");
      await el.setOs({ tag: "mock-os" });
      // setOs → receiveResource(this.resource) → update() (once, inside receiveResource).
      // receiveResource returns true, so the fallback `if (!hasResource) this.update()` branch is skipped.
      expect(updateSpy).toHaveBeenCalledTimes(1);
      el.remove();
    });

    it("is reachable through the pod-os:init event detail", async () => {
      const el = createInstance();
      const os = { tag: "mock-os" };
      const handlers = attachOsHandlers(el, os);
      document.body.appendChild(el);
      expect(handlers.setOs).not.toBeNull();
      expect((el as unknown as { os?: unknown }).os).toBe(os);
      el.remove();
    });
  });

  describe("init() retry timer", () => {
    it("re-runs init() after 50ms while this.os is still undefined", () => {
      const el = createInstance();
      const initSpy = vi.spyOn(el, "init");
      document.body.appendChild(el);
      const initialCalls = initSpy.mock.calls.length;
      vi.advanceTimersByTime(50);
      expect(initSpy.mock.calls.length).toBeGreaterThan(initialCalls);
      el.remove();
    });

    it("does not re-run init() after 50ms once setOs has populated this.os", () => {
      const el = createInstance();
      const os = { tag: "mock-os" };
      attachOsHandlers(el, os);
      document.body.appendChild(el);
      expect((el as unknown as { os?: unknown }).os).toBe(os);

      const initSpy = vi.spyOn(el, "init");
      const callsAtStart = initSpy.mock.calls.length;
      vi.advanceTimersByTime(50);
      expect(initSpy.mock.calls.length).toBe(callsAtStart);
      el.remove();
    });

    it("cancels the prior pending timer when init() runs again", () => {
      const el = createInstance();
      document.body.appendChild(el);
      const clearSpy = vi.spyOn(globalThis, "clearTimeout");

      el.init();

      expect(clearSpy).toHaveBeenCalled();
      el.remove();
    });

    it("schedules exactly one 50ms retry timer per init() pass", () => {
      const el = createInstance();
      document.body.appendChild(el);
      const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
      setTimeoutSpy.mockClear();
      el.init();
      expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 50);
      el.remove();
    });
  });

  describe("update()", () => {
    it("returns true in the base class", () => {
      const el = createInstance();
      document.body.appendChild(el);
      expect(el.update()).toBe(true);
      el.remove();
    });
  });
});
