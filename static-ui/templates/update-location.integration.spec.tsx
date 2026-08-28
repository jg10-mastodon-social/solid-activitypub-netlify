import { describe, it, expect, vi } from "vitest";
import { wireRouteSync } from "./update-location.js";

interface MockRouter {
  addEventListener: ReturnType<typeof vi.fn>;
  dispatch: (uri: string) => void;
}

function makeMockRouter(): MockRouter {
  const listener = { current: null as ((e: { detail: unknown }) => void) | null };
  return {
    addEventListener: vi.fn((_type: string, cb: (e: { detail: unknown }) => void) => {
      listener.current = cb;
    }),
    dispatch: (uri: string) => {
      listener.current?.({ detail: uri });
    },
  };
}

interface MockWindow {
  location: { href: string };
}

function makeMockWindow(href: string): MockWindow {
  const location = { href };
  return new Proxy({} as MockWindow, {
    get(_target, prop) {
      if (prop === "location") return location;
      return undefined;
    },
    set(_target, prop, value) {
      if (prop === "location" && typeof value === "string") {
        location.href = value;
        return true;
      }
      return false;
    },
  });
}

describe("update-location.js wiring", () => {
  it("updates window.location when pod-os:route-changed fires with a different URI", () => {
    const router = makeMockRouter();
    const win = makeMockWindow("https://example.test/");

    wireRouteSync(router, win);

    router.dispatch("https://example.test/alice");

    expect(win.location.href).toBe("https://example.test/alice");
  });

  it("leaves window.location alone when the URI already matches the current href", () => {
    const router = makeMockRouter();
    const win = makeMockWindow("https://example.test/alice");

    wireRouteSync(router, win);

    router.dispatch("https://example.test/alice");

    expect(win.location.href).toBe("https://example.test/alice");
  });

  it("updates window.location when navigating from one actor to another", () => {
    const router = makeMockRouter();
    const win = makeMockWindow("https://example.test/alice");

    wireRouteSync(router, win);

    router.dispatch("https://example.test/bob");

    expect(win.location.href).toBe("https://example.test/bob");
  });

  it("attaches exactly one listener for pod-os:route-changed on the router", () => {
    const router = makeMockRouter();
    const win = makeMockWindow("https://example.test/");

    wireRouteSync(router, win);

    expect(router.addEventListener).toHaveBeenCalledTimes(1);
    expect(router.addEventListener).toHaveBeenCalledWith("pod-os:route-changed", expect.any(Function));
  });
});
