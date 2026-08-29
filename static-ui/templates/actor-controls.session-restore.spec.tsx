// @vitest-environment stencil
import { vi, describe, it, expect, beforeEach } from "vitest";
import { render } from "@stencil/vitest";
import { BehaviorSubject } from "rxjs";
import { PodOS, type PodOsSession } from "@pod-os/core";
import sessionStore from "@pod-os/elements/dist/collection/store/session.js";
import "../../static-ui/templates/webid-resource.js";
import { readFileSync } from "fs";
import { join } from "path";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const WEBID    = "https://pod.test/profile/card#me";
const TYPE_IDX = "https://pod.test/settings/privateTypeIndex.ttl";
const ACTOR    = "https://example.test/actor";

const WEBID_TURTLE  = `
@prefix solid: <http://www.w3.org/ns/solid/terms#>.
<${WEBID}> solid:privateTypeIndex <${TYPE_IDX}>.`;
const TYPE_IDX_TURTLE = `
@prefix solid: <http://www.w3.org/ns/solid/terms#>.
@prefix as: <https://www.w3.org/ns/activitystreams#>.
<${TYPE_IDX}> a solid:TypeIndex.
<#test>
    a solid:TypeRegistration;
    solid:forClass as:Service;
    solid:instance <${ACTOR}>.
`;
    const ACTOR_TURTLE = `
@prefix as: <https://www.w3.org/ns/activitystreams#>.
    <${ACTOR}> a as:Service.`;

let sessionInfo$: BehaviorSubject<{ isLoggedIn: boolean; webId: string }>;
let mockOs: PodOS;
let sessionSub: { unsubscribe: () => void } | null = null;

function buildMockOs(): PodOS {
  const mockSession: PodOsSession = {
    authenticatedFetch: (url, init) => fetch(url as any, init),
    observeSession: () => sessionInfo$,
    login: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
  };
  return new PodOS({ session: mockSession } as any);
}

// Intercept pod-os:init to provide the mock os to all components
// (webid-resource, pos-resource, etc.), and mirror pos-app's behavior
// of subscribing to observeSession and updating pod-os's global session
// store so pos-login's render reacts to the session.
function installPodOsInitInterceptor() {
  const listener = (event: Event) => {
    (event as CustomEvent).detail(mockOs);
    sessionSub?.unsubscribe();
    sessionSub = mockOs.observeSession().subscribe((s) => {
      sessionStore.state.webId = s.webId;
      sessionStore.state.isLoggedIn = s.isLoggedIn;
    });
    event.stopImmediatePropagation();
  };
  document.addEventListener("pod-os:init", listener, true);
  return () => {
    document.removeEventListener("pod-os:init", listener, true);
    sessionSub?.unsubscribe();
    sessionSub = null;
  };
}

beforeEach(() => {
  sessionInfo$ = new BehaviorSubject({ isLoggedIn: false, webId: "" });
  sessionStore.state.isLoggedIn = false;
  sessionStore.state.webId = "";
  mockOs = buildMockOs();
  mockFetch.mockReset();
  mockFetch.mockImplementation((url: any) => {
    const u = url.toString();
    if (u.startsWith(WEBID.split("#")[0])) {
      return Promise.resolve(new Response(WEBID_TURTLE, { status: 200, headers: { "content-type": "text/turtle" } }));
    }
    if (u === TYPE_IDX) {
      return Promise.resolve(new Response(TYPE_IDX_TURTLE, { status: 200, headers: { "content-type": "text/turtle" } }));
    }
    if (u === ACTOR) {
      return Promise.resolve(new Response(ACTOR_TURTLE, { status: 200, headers: { "content-type": "text/turtle" } }));
    }
    return Promise.resolve(new Response("", { status: 404 }));
  });
});

const FRAGMENT_PATH = join(__dirname, "actor-controls.html");
const FRAGMENT_HTML = readFileSync(FRAGMENT_PATH, "utf-8");

describe("actor-controls fragment — session-restore regression", () => {
  it("renders an actor row after the session is restored", async () => {
    const removeInterceptor = installPodOsInitInterceptor();

    const { root, waitForChanges } = await render(FRAGMENT_HTML);
    await waitForChanges();

    // The full production fragment places <webid-resource> inside
    // <pos-login>'s if-logged-in slot. In happy-dom + Stencil's test
    // environment, connectedCallback is not always fired for projected
    // content, so we call it manually. This is purely a test-env
    // workaround; in real browsers the lifecycle runs automatically.
    const wr = root.querySelector("webid-resource") as any;
    if (wr && !wr._disposers && typeof wr.connectedCallback === "function") {
      wr.connectedCallback();
    }

    // Simulate pos-app restoring the session. In production this is
    // what handleIncomingRedirect triggers after pod-os:loaded.
    sessionInfo$.next({ isLoggedIn: true, webId: WEBID });

    await new Promise(r => setTimeout(r, 1000));
    await waitForChanges();

    removeInterceptor();

    const rows = root.querySelectorAll(`[about="${ACTOR}"]`);
    expect(rows.length).toBe(1);

    // The actor resource should have a rich link and type badges
    const actorResource = rows[0] as Element;
    const listItem = actorResource.closest("li");
    expect(listItem?.querySelector("pos-rich-link")).not.toBeNull();
    expect(listItem?.querySelector("pos-type-badges")).not.toBeNull();
  }, 30000);
});
