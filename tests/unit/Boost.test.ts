// @vitest-environment happy-dom
// @ts-nocheck — components are imported from static-ui/components/ outside
// the tsconfig include; suppress the resulting diagnostics.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { graph, sym, literal } from "rdflib";
import "../../static-ui/components/ReceiveResourceOS.js";
import "../../static-ui/components/Boost.js";

const createMockOs = (overrides = {}) => {
  const kb = graph();
  const store = {
    graph: kb,
    fetch: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockImplementation(uri => ({
      uri,
      anyValue: predicate => {
        const val = kb.any(kb.sym(uri), kb.sym(predicate));
        return val ? val.value : null;
      }
    }))
  };
  return {
    session: {
      authenticatedFetch: vi.fn(),
      session: { webId: undefined }
    },
    store,
    ...overrides
  };
};

const mockThing = (uri, types = [], properties = {}) => ({
  uri,
  types: () => types.map(uri => ({ uri })),
  anyValue: predicate => properties[predicate]
});

describe("Boost", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("os initialization", () => {
    it("has setOs method that stores os", async () => {
      const elem = document.createElement("boost-component");
      document.body.appendChild(elem);
      const mockOs = createMockOs();
      await elem.setOs(mockOs);
      expect(elem.os).toBe(mockOs);
    });

    it("dispatches pod-os:init event on connect", () => {
      const elem = document.createElement("boost-component");
      const dispatchSpy = vi.spyOn(elem, "dispatchEvent");
      document.body.appendChild(elem);
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "pod-os:init",
          bubbles: true,
          composed: true
        })
      );
    });
  });

  describe("shadow DOM", () => {
    it("has shadow DOM with boost button", () => {
      const elem = document.createElement("boost-component");
      document.body.appendChild(elem);
      const button = elem.shadowRoot.querySelector('button[name="boost"]');
      expect(button).not.toBeNull();
      expect(button.textContent).toBe("Boost");
    });
  });

  describe("attributes", () => {
    it("has outbox attribute getter/setter", () => {
      const elem = document.createElement("boost-component");
      elem.setAttribute("outbox", "https://example.com/outbox");
      expect(elem.outbox).toBe("https://example.com/outbox");
    });

    it("has actor attribute getter/setter", () => {
      const elem = document.createElement("boost-component");
      elem.setAttribute("actor", "https://example.com/actor");
      expect(elem.actor).toBe("https://example.com/actor");
    });
  });

  describe("validation", () => {
    it("emits error when outbox is missing", async () => {
      const elem = document.createElement("boost-component");
      elem.setAttribute("actor", "https://example.com/actor");
      const mockOs = createMockOs();
      await elem.setOs(mockOs);

      const dispatchSpy = vi.spyOn(elem, "dispatchEvent");
      await elem.boost();

      const boostingError = dispatchSpy.mock.calls.find(
        call => call[0]?.type === "boosting-error"
      );
      expect(boostingError).toBeDefined();
      expect(boostingError[0].detail.message.toLowerCase()).toContain("outbox");
    });

    it("emits error when actor is missing", async () => {
      const elem = document.createElement("boost-component");
      elem.setAttribute("outbox", "https://example.com/outbox");
      const mockOs = createMockOs();
      await elem.setOs(mockOs);

      const dispatchSpy = vi.spyOn(elem, "dispatchEvent");
      await elem.boost();

      const boostingError = dispatchSpy.mock.calls.find(
        call => call[0]?.type === "boosting-error"
      );
      expect(boostingError).toBeDefined();
      expect(boostingError[0].detail.message.toLowerCase()).toContain("actor");
    });

    it("emits error when os is not set", async () => {
      const elem = document.createElement("boost-component");
      elem.setAttribute("outbox", "https://example.com/outbox");
      elem.setAttribute("actor", "https://example.com/actor");

      const dispatchSpy = vi.spyOn(elem, "dispatchEvent");
      await elem.boost();

      const boostingError = dispatchSpy.mock.calls.find(
        call => call[0]?.type === "boosting-error"
      );
      expect(boostingError).toBeDefined();
      expect(boostingError[0].detail.message).toContain("OS");
    });
  });

  describe("posting", () => {
    it("posts Announce activity to outbox", async () => {
      const elem = document.createElement("boost-component");
      elem.setAttribute("outbox", "https://example.com/outbox");
      elem.setAttribute("actor", "https://example.com/actor");

      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true
      });
      const mockOs = createMockOs({
        session: { authenticatedFetch: mockFetch }
      });
      await elem.setOs(mockOs);

      elem.resource = mockThing(
        "https://example.com/users/bob/statuses/123",
        ["https://www.w3.org/ns/activitystreams#Note"]
      );

      await elem.boost();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com/outbox",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/activity+json"
          })
        })
      );

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.type).toBe("Announce");
      expect(body.actor).toBe("https://example.com/actor");
      expect(body.object).toBe(
        "https://example.com/users/bob/statuses/123"
      );
      expect(body.to).toEqual(["https://www.w3.org/ns/activitystreams#Public"]);
    });

    it("emits error on non-2xx response", async () => {
      const elem = document.createElement("boost-component");
      elem.setAttribute("outbox", "https://example.com/outbox");
      elem.setAttribute("actor", "https://example.com/actor");

      const mockFetch = vi.fn().mockResolvedValue({
        status: 500,
        ok: false
      });
      const mockOs = createMockOs({
        session: { authenticatedFetch: mockFetch }
      });
      await elem.setOs(mockOs);

      elem.resource = mockThing(
        "https://example.com/users/bob/statuses/123",
        ["https://www.w3.org/ns/activitystreams#Note"]
      );

      const dispatchSpy = vi.spyOn(elem, "dispatchEvent");
      await elem.boost();

      const boostingError = dispatchSpy.mock.calls.find(
        call => call[0]?.type === "boosting-error"
      );
      expect(boostingError).toBeDefined();
      expect(boostingError[0].detail.message).toContain("500");
    });

    it("extracts Note from Create activity", async () => {
      const elem = document.createElement("boost-component");
      elem.setAttribute("outbox", "https://example.com/outbox");
      elem.setAttribute("actor", "https://example.com/actor");

      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true
      });
      const mockOs = createMockOs({
        session: { authenticatedFetch: mockFetch }
      });
      await elem.setOs(mockOs);

      elem.resource = mockThing(
        "https://example.com/users/bob/activities/create-456",
        ["https://www.w3.org/ns/activitystreams#Create"],
        {
          "https://www.w3.org/ns/activitystreams#object":
            "https://example.com/users/bob/statuses/456"
        }
      );

      await elem.boost();

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.object).toBe("https://example.com/users/bob/statuses/456");
    });

    it("dispatches boosting-success on success", async () => {
      const elem = document.createElement("boost-component");
      elem.setAttribute("outbox", "https://example.com/outbox");
      elem.setAttribute("actor", "https://example.com/actor");

      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true
      });
      const mockOs = createMockOs({
        session: { authenticatedFetch: mockFetch }
      });
      await elem.setOs(mockOs);

      elem.resource = mockThing(
        "https://example.com/users/bob/statuses/123",
        ["https://www.w3.org/ns/activitystreams#Note"]
      );

      const dispatchSpy = vi.spyOn(elem, "dispatchEvent");
      await elem.boost();

      const boostingSuccess = dispatchSpy.mock.calls.find(
        call => call[0]?.type === "boosting-success"
      );
      expect(boostingSuccess).toBeDefined();
      expect(boostingSuccess[0].detail.url).toBe("https://example.com/outbox");
    });
  });

  describe("loading state", () => {
    it("disables button during posting", async () => {
      const elem = document.createElement("boost-component");
      elem.setAttribute("outbox", "https://example.com/outbox");
      elem.setAttribute("actor", "https://example.com/actor");

      let resolveFetch;
      const mockFetch = vi.fn().mockImplementation(
        () => new Promise(resolve => { resolveFetch = resolve; })
      );
      const mockOs = createMockOs({
        session: { authenticatedFetch: mockFetch }
      });
      await elem.setOs(mockOs);

      elem.resource = mockThing(
        "https://example.com/users/bob/statuses/123",
        ["https://www.w3.org/ns/activitystreams#Note"]
      );

      const boostPromise = elem.boost();
      const button = elem.shadowRoot.querySelector('button[name="boost"]');
      expect(button.disabled).toBe(true);

      resolveFetch({ status: 200, ok: true });
      await boostPromise;
      expect(button.disabled).toBe(false);
    });
  });

  describe("Thing resource", () => {
    it("extracts resource URI as object for a non-Create Thing", async () => {
      const elem = document.createElement("boost-component");
      elem.setAttribute("actor", "https://example.com/actor");
      elem.setAttribute("outbox", "https://example.com/outbox");

      const mockFetch = vi.fn().mockResolvedValue({ status: 200, ok: true });
      const mockOs = createMockOs({
        session: { authenticatedFetch: mockFetch }
      });
      await elem.setOs(mockOs);

      elem.resource = mockThing(
        "https://example.com/users/bob/statuses/123",
        ["https://www.w3.org/ns/activitystreams#Note"]
      );

      await elem.boost();

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.object).toBe(
        "https://example.com/users/bob/statuses/123"
      );
    });

    it("extracts as:object URI as object for a Create Thing", async () => {
      const elem = document.createElement("boost-component");
      elem.setAttribute("actor", "https://example.com/actor");
      elem.setAttribute("outbox", "https://example.com/outbox");

      const mockFetch = vi.fn().mockResolvedValue({ status: 200, ok: true });
      const mockOs = createMockOs({
        session: { authenticatedFetch: mockFetch }
      });
      await elem.setOs(mockOs);

      elem.resource = mockThing(
        "https://example.com/users/bob/activities/create-789",
        ["https://www.w3.org/ns/activitystreams#Create"],
        {
          "https://www.w3.org/ns/activitystreams#object":
            "https://example.com/users/bob/statuses/789"
        }
      );

      await elem.boost();

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.object).toBe("https://example.com/users/bob/statuses/789");
    });
  });

  describe("object construction", () => {
    it("inlines a non-Create Thing with id, type, content, attributedTo, published", async () => {
      const elem = document.createElement("boost-component");
      elem.setAttribute("actor", "https://example.com/actor");
      elem.setAttribute("outbox", "https://example.com/outbox");

      const noteUri = "https://example.com/users/bob/statuses/123";
      const kb = graph();
      const subject = sym(noteUri);
      const doc = sym(noteUri);
      kb.add(subject, sym("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"), sym("https://www.w3.org/ns/activitystreams#Note"), doc);
      kb.add(subject, sym("https://www.w3.org/ns/activitystreams#content"), literal("Hello world"), doc);
      kb.add(subject, sym("https://www.w3.org/ns/activitystreams#attributedTo"), sym("https://example.com/users/bob"), doc);
      kb.add(subject, sym("https://www.w3.org/ns/activitystreams#published"), literal("2024-01-01T00:00:00Z"), doc);

      const mockFetch = vi.fn().mockResolvedValue({ status: 200, ok: true });
      const mockOs = {
        session: { authenticatedFetch: mockFetch, session: { webId: undefined } },
        store: { graph: kb, fetch: vi.fn().mockResolvedValue(undefined) }
      };
      await elem.setOs(mockOs);

      elem.resource = mockThing(
        noteUri,
        ["https://www.w3.org/ns/activitystreams#Note"]
      );

      await elem.boost();

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.object).toEqual({
        id: noteUri,
        type: "https://www.w3.org/ns/activitystreams#Note",
        content: "Hello world",
        attributedTo: "https://example.com/users/bob",
        published: "2024-01-01T00:00:00Z"
      });
    });

    it("inlines the inner object of a Create activity", async () => {
      const elem = document.createElement("boost-component");
      elem.setAttribute("actor", "https://example.com/actor");
      elem.setAttribute("outbox", "https://example.com/outbox");

      const createUri = "https://example.com/users/bob/activities/create-1";
      const noteUri = "https://example.com/users/bob/statuses/456";
      const kb = graph();
      const noteSubject = sym(noteUri);
      const noteDoc = sym(noteUri);
      kb.add(noteSubject, sym("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"), sym("https://www.w3.org/ns/activitystreams#Note"), noteDoc);
      kb.add(noteSubject, sym("https://www.w3.org/ns/activitystreams#content"), literal("Nested content"), noteDoc);
      kb.add(noteSubject, sym("https://www.w3.org/ns/activitystreams#attributedTo"), sym("https://example.com/users/bob"), noteDoc);

      const mockFetch = vi.fn().mockResolvedValue({ status: 200, ok: true });
      const mockOs = {
        session: { authenticatedFetch: mockFetch, session: { webId: undefined } },
        store: { graph: kb, fetch: vi.fn().mockResolvedValue(undefined) }
      };
      await elem.setOs(mockOs);

      elem.resource = mockThing(
        createUri,
        ["https://www.w3.org/ns/activitystreams#Create"],
        { "https://www.w3.org/ns/activitystreams#object": noteUri }
      );

      await elem.boost();

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.object).toEqual({
        id: noteUri,
        type: "https://www.w3.org/ns/activitystreams#Note",
        content: "Nested content",
        attributedTo: "https://example.com/users/bob"
      });
    });

    it("includes as:to as an array when multiple values", async () => {
      const elem = document.createElement("boost-component");
      elem.setAttribute("actor", "https://example.com/actor");
      elem.setAttribute("outbox", "https://example.com/outbox");

      const noteUri = "https://example.com/users/bob/statuses/123";
      const kb = graph();
      const subject = sym(noteUri);
      const doc = sym(noteUri);
      kb.add(subject, sym("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"), sym("https://www.w3.org/ns/activitystreams#Note"), doc);
      kb.add(subject, sym("https://www.w3.org/ns/activitystreams#to"), sym("https://example.com/users/alice"), doc);
      kb.add(subject, sym("https://www.w3.org/ns/activitystreams#to"), sym("https://www.w3.org/ns/activitystreams#Public"), doc);

      const mockFetch = vi.fn().mockResolvedValue({ status: 200, ok: true });
      const mockOs = {
        session: { authenticatedFetch: mockFetch, session: { webId: undefined } },
        store: { graph: kb, fetch: vi.fn().mockResolvedValue(undefined) }
      };
      await elem.setOs(mockOs);

      elem.resource = mockThing(
        noteUri,
        ["https://www.w3.org/ns/activitystreams#Note"]
      );

      await elem.boost();

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.object.to).toEqual([
        "https://example.com/users/alice",
        "https://www.w3.org/ns/activitystreams#Public"
      ]);
    });

    it("omits fields not present in the store", async () => {
      const elem = document.createElement("boost-component");
      elem.setAttribute("actor", "https://example.com/actor");
      elem.setAttribute("outbox", "https://example.com/outbox");

      const noteUri = "https://example.com/users/bob/statuses/123";
      const kb = graph();
      const subject = sym(noteUri);
      const doc = sym(noteUri);
      kb.add(subject, sym("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"), sym("https://www.w3.org/ns/activitystreams#Note"), doc);

      const mockFetch = vi.fn().mockResolvedValue({ status: 200, ok: true });
      const mockOs = {
        session: { authenticatedFetch: mockFetch, session: { webId: undefined } },
        store: { graph: kb, fetch: vi.fn().mockResolvedValue(undefined) }
      };
      await elem.setOs(mockOs);

      elem.resource = mockThing(
        noteUri,
        ["https://www.w3.org/ns/activitystreams#Note"]
      );

      await elem.boost();

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.object).toEqual({
        id: noteUri,
        type: "https://www.w3.org/ns/activitystreams#Note"
      });
      expect(body.object).not.toHaveProperty("content");
      expect(body.object).not.toHaveProperty("attributedTo");
    });

    it("picks the first type when multiple types", async () => {
      const elem = document.createElement("boost-component");
      elem.setAttribute("actor", "https://example.com/actor");
      elem.setAttribute("outbox", "https://example.com/outbox");

      const noteUri = "https://example.com/users/bob/statuses/123";
      const kb = graph();
      const subject = sym(noteUri);
      const doc = sym(noteUri);
      kb.add(subject, sym("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"), sym("https://www.w3.org/ns/activitystreams#Note"), doc);
      kb.add(subject, sym("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"), sym("https://example.com/custom/Article"), doc);

      const mockFetch = vi.fn().mockResolvedValue({ status: 200, ok: true });
      const mockOs = {
        session: { authenticatedFetch: mockFetch, session: { webId: undefined } },
        store: { graph: kb, fetch: vi.fn().mockResolvedValue(undefined) }
      };
      await elem.setOs(mockOs);

      elem.resource = mockThing(
        noteUri,
        ["https://www.w3.org/ns/activitystreams#Note"]
      );

      await elem.boost();

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.object.type).toBe("https://www.w3.org/ns/activitystreams#Note");
    });

    it("falls back to URI when object URI has no triples in the graph", async () => {
      const elem = document.createElement("boost-component");
      elem.setAttribute("actor", "https://example.com/actor");
      elem.setAttribute("outbox", "https://example.com/outbox");

      const noteUri = "https://example.com/users/bob/statuses/123";
      const kb = graph();

      const mockFetch = vi.fn().mockResolvedValue({ status: 200, ok: true });
      const mockOs = {
        session: { authenticatedFetch: mockFetch, session: { webId: undefined } },
        store: { graph: kb, fetch: vi.fn().mockResolvedValue(undefined) }
      };
      await elem.setOs(mockOs);

      elem.resource = mockThing(
        noteUri,
        ["https://www.w3.org/ns/activitystreams#Note"]
      );

      await elem.boost();

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.object).toBe(noteUri);
    });

    it("returns null when Create activity has no as:object", async () => {
      const elem = document.createElement("boost-component");
      elem.setAttribute("actor", "https://example.com/actor");
      elem.setAttribute("outbox", "https://example.com/outbox");

      const mockOs = createMockOs();
      await elem.setOs(mockOs);

      elem.resource = mockThing(
        "https://example.com/activities/create-no-object",
        ["https://www.w3.org/ns/activitystreams#Create"]
      );

      const dispatchSpy = vi.spyOn(elem, "dispatchEvent");
      await elem.boost();

      const boostingError = dispatchSpy.mock.calls.find(
        call => call[0]?.type === "boosting-error"
      );
      expect(boostingError).toBeDefined();
      expect(boostingError[0].detail.message.toLowerCase()).toContain("activity");
    });
  });

  describe("binding resolution", () => {
    it("uses actor URL attribute as-is (regression)", async () => {
      const elem = document.createElement("boost-component");
      elem.setAttribute("actor", "https://example.com/actor");
      elem.setAttribute("outbox", "https://example.com/outbox");

      const mockFetch = vi.fn().mockResolvedValue({ status: 200, ok: true });
      const mockOs = createMockOs({
        session: { authenticatedFetch: mockFetch, session: { webId: undefined } }
      });
      await elem.setOs(mockOs);

      elem.resource = mockThing(
        "https://example.com/n/1",
        ["https://www.w3.org/ns/activitystreams#Note"]
      );
      await elem.boost();

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.actor).toBe("https://example.com/actor");
    });

    it("uses outbox URL attribute as-is (regression)", async () => {
      const elem = document.createElement("boost-component");
      elem.setAttribute("actor", "https://example.com/actor");
      elem.setAttribute("outbox", "https://example.com/outbox");

      const mockFetch = vi.fn().mockResolvedValue({ status: 200, ok: true });
      const mockOs = createMockOs({
        session: { authenticatedFetch: mockFetch, session: { webId: undefined } }
      });
      await elem.setOs(mockOs);

      elem.resource = mockThing(
        "https://example.com/n/1",
        ["https://www.w3.org/ns/activitystreams#Note"]
      );
      await elem.boost();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com/outbox",
        expect.any(Object)
      );
    });

    it("resolves actor via {binding} interpolation from bind-subject ancestor", async () => {
      const elem = document.createElement("boost-component");
      elem.setAttribute("actor", "{user}");
      elem.setAttribute("outbox", "https://example.com/outbox");

      const container = document.createElement("div");
      const bound = document.createElement("div");
      bound.setAttribute("bind-subject", "user");
      bound.resource = { uri: "https://example.com/users/alice" };
      container.appendChild(bound);
      container.appendChild(elem);
      document.body.appendChild(container);

      const mockFetch = vi.fn().mockResolvedValue({ status: 200, ok: true });
      const mockOs = createMockOs({
        session: { authenticatedFetch: mockFetch, session: { webId: undefined } }
      });
      await elem.setOs(mockOs);

      elem.resource = mockThing(
        "https://example.com/n/1",
        ["https://www.w3.org/ns/activitystreams#Note"]
      );
      await elem.boost();

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.actor).toBe("https://example.com/users/alice");
    });

    it("resolves actor via default bind-subject='actor' ancestor when attribute omitted", async () => {
      const elem = document.createElement("boost-component");
      elem.setAttribute("outbox", "https://example.com/outbox");

      const container = document.createElement("div");
      const bound = document.createElement("div");
      bound.setAttribute("bind-subject", "actor");
      bound.resource = { uri: "https://example.com/users/bob" };
      container.appendChild(bound);
      container.appendChild(elem);
      document.body.appendChild(container);

      const mockFetch = vi.fn().mockResolvedValue({ status: 200, ok: true });
      const mockOs = createMockOs({
        session: { authenticatedFetch: mockFetch, session: { webId: undefined } }
      });
      await elem.setOs(mockOs);

      elem.resource = mockThing(
        "https://example.com/n/1",
        ["https://www.w3.org/ns/activitystreams#Note"]
      );
      await elem.boost();

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.actor).toBe("https://example.com/users/bob");
    });

    it("emits boosting-error mentioning actor when no actor attribute and no binding", async () => {
      const elem = document.createElement("boost-component");
      elem.setAttribute("outbox", "https://example.com/outbox");

      const mockOs = createMockOs();
      await elem.setOs(mockOs);

      elem.resource = mockThing(
        "https://example.com/n/1",
        ["https://www.w3.org/ns/activitystreams#Note"]
      );

      const dispatchSpy = vi.spyOn(elem, "dispatchEvent");
      await elem.boost();

      const boostingError = dispatchSpy.mock.calls.find(
        call => call[0]?.type === "boosting-error"
      );
      expect(boostingError).toBeDefined();
      expect(boostingError[0].detail.message.toLowerCase()).toContain("actor");
    });

    it("resolves outbox via {binding} interpolation from bind-object ancestor", async () => {
      const elem = document.createElement("boost-component");
      elem.setAttribute("actor", "https://example.com/actor");
      elem.setAttribute("outbox", "{x}");

      const container = document.createElement("div");
      const bound = document.createElement("input");
      bound.setAttribute("bind-object", "x");
      bound.value = "https://example.com/users/alice/outbox";
      container.appendChild(bound);
      container.appendChild(elem);
      document.body.appendChild(container);

      const mockFetch = vi.fn().mockResolvedValue({ status: 200, ok: true });
      const mockOs = createMockOs({
        session: { authenticatedFetch: mockFetch, session: { webId: undefined } }
      });
      await elem.setOs(mockOs);

      elem.resource = mockThing(
        "https://example.com/n/1",
        ["https://www.w3.org/ns/activitystreams#Note"]
      );
      await elem.boost();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com/users/alice/outbox",
        expect.any(Object)
      );
    });

    it("resolves outbox from as:outbox in actor's profile when outbox attribute omitted", async () => {
      const elem = document.createElement("boost-component");
      elem.setAttribute("actor", "https://example.com/users/alice");

      const kb = graph();
      const actorSym = sym("https://example.com/users/alice");
      const outboxSym = sym("https://example.com/users/alice/outbox");
      kb.add(
        actorSym,
        sym("https://www.w3.org/ns/activitystreams#outbox"),
        outboxSym,
        sym("https://example.com/users/alice")
      );

      const mockFetch = vi.fn().mockResolvedValue({ status: 200, ok: true });
      const mockOs = {
        session: {
          authenticatedFetch: mockFetch,
          session: { webId: undefined }
        },
        store: {
          graph: kb,
          fetch: vi.fn().mockResolvedValue(undefined),
          get: vi.fn().mockImplementation(uri => ({
            uri,
            anyValue: predicate => {
              const val = kb.any(kb.sym(uri), kb.sym(predicate));
              return val ? val.value : null;
            }
          }))
        }
      };
      await elem.setOs(mockOs);

      elem.resource = mockThing(
        "https://example.com/n/1",
        ["https://www.w3.org/ns/activitystreams#Note"]
      );
      await elem.boost();

      expect(mockOs.store.fetch).toHaveBeenCalledWith(
        "https://example.com/users/alice"
      );
      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com/users/alice/outbox",
        expect.any(Object)
      );
    });

    it("emits boosting-error mentioning outbox when no outbox attribute and no as:outbox in profile", async () => {
      const elem = document.createElement("boost-component");
      elem.setAttribute("actor", "https://example.com/users/alice");

      const mockFetch = vi.fn();
      const mockOs = createMockOs({
        session: { authenticatedFetch: mockFetch, session: { webId: undefined } }
      });
      await elem.setOs(mockOs);

      elem.resource = mockThing(
        "https://example.com/n/1",
        ["https://www.w3.org/ns/activitystreams#Note"]
      );

      const dispatchSpy = vi.spyOn(elem, "dispatchEvent");
      await elem.boost();

      const boostingError = dispatchSpy.mock.calls.find(
        call => call[0]?.type === "boosting-error"
      );
      expect(boostingError).toBeDefined();
      expect(boostingError[0].detail.message.toLowerCase()).toContain("outbox");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("calls store.fetch on the actor once per boost (no caching)", async () => {
      const elem = document.createElement("boost-component");
      elem.setAttribute("actor", "https://example.com/users/alice");

      const kb = graph();
      const actorSym = sym("https://example.com/users/alice");
      const outboxSym = sym("https://example.com/users/alice/outbox");
      kb.add(
        actorSym,
        sym("https://www.w3.org/ns/activitystreams#outbox"),
        outboxSym,
        sym("https://example.com/users/alice")
      );

      const mockFetch = vi.fn().mockResolvedValue({ status: 200, ok: true });
      const storeFetch = vi.fn().mockResolvedValue(undefined);
      const mockOs = {
        session: {
          authenticatedFetch: mockFetch,
          session: { webId: undefined }
        },
        store: {
          graph: kb,
          fetch: storeFetch,
          get: vi.fn().mockImplementation(uri => ({
            uri,
            anyValue: predicate => {
              const val = kb.any(kb.sym(uri), kb.sym(predicate));
              return val ? val.value : null;
            }
          }))
        }
      };
      await elem.setOs(mockOs);

      elem.resource = mockThing(
        "https://example.com/n/1",
        ["https://www.w3.org/ns/activitystreams#Note"]
      );
      await elem.boost();
      await elem.boost();

      expect(storeFetch).toHaveBeenCalledTimes(2);
      expect(storeFetch).toHaveBeenNthCalledWith(1, "https://example.com/users/alice");
      expect(storeFetch).toHaveBeenNthCalledWith(2, "https://example.com/users/alice");
    });

    it("explicit outbox attribute wins over profile lookup", async () => {
      const elem = document.createElement("boost-component");
      elem.setAttribute("actor", "https://example.com/users/alice");
      elem.setAttribute("outbox", "https://example.com/explicit/outbox");

      const kb = graph();
      const actorSym = sym("https://example.com/users/alice");
      const outboxSym = sym("https://example.com/users/alice/outbox");
      kb.add(
        actorSym,
        sym("https://www.w3.org/ns/activitystreams#outbox"),
        outboxSym,
        sym("https://example.com/users/alice")
      );

      const mockFetch = vi.fn().mockResolvedValue({ status: 200, ok: true });
      const storeFetch = vi.fn().mockResolvedValue(undefined);
      const mockOs = {
        session: {
          authenticatedFetch: mockFetch,
          session: { webId: undefined }
        },
        store: {
          graph: kb,
          fetch: storeFetch
        }
      };
      await elem.setOs(mockOs);

      elem.resource = mockThing(
        "https://example.com/n/1",
        ["https://www.w3.org/ns/activitystreams#Note"]
      );
      await elem.boost();

      expect(storeFetch).not.toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com/explicit/outbox",
        expect.any(Object)
      );
    });
  });

  describe("multiple actors (space-separated actor attribute)", () => {
    const createMockOsWithLabel = (labelMap = {}) => {
      const kb = graph();
      return {
        session: {
          authenticatedFetch: vi.fn().mockResolvedValue({
            status: 200,
            ok: true
          }),
          session: { webId: undefined }
        },
        store: {
          graph: kb,
          fetch: vi.fn().mockResolvedValue(undefined),
          get: vi.fn().mockImplementation(uri => ({
            uri,
            label: () => labelMap[uri] || uri
          }))
        }
      };
    };

    it("renders a <select> with one <option> per actor when attribute lists multiple actors", async () => {
      const elem = document.createElement("boost-component");
      elem.setAttribute(
        "actor",
        "https://example.com/users/alice https://example.com/users/bob"
      );
      elem.setAttribute("outbox", "https://example.com/outbox");
      const mockOs = createMockOsWithLabel();
      await elem.setOs(mockOs);

      const select = elem.shadowRoot.querySelector("select");
      expect(select).not.toBeNull();
      const options = select.querySelectorAll("option");
      expect(options.length).toBe(2);
      expect(options[0].value).toBe("https://example.com/users/alice");
      expect(options[1].value).toBe("https://example.com/users/bob");
    });

    it("does not render a <select> when actor attribute has a single value (regression)", async () => {
      const elem = document.createElement("boost-component");
      elem.setAttribute("actor", "https://example.com/users/alice");
      elem.setAttribute("outbox", "https://example.com/outbox");
      const mockOs = createMockOsWithLabel();
      await elem.setOs(mockOs);

      const select = elem.shadowRoot.querySelector("select");
      expect(select).toBeNull();
    });

    it("uses option labels from os.store.get(uri).label() when available", async () => {
      const elem = document.createElement("boost-component");
      elem.setAttribute(
        "actor",
        "https://example.com/users/alice https://example.com/users/bob"
      );
      elem.setAttribute("outbox", "https://example.com/outbox");
      const mockOs = createMockOsWithLabel({
        "https://example.com/users/alice": "Alice",
        "https://example.com/users/bob": "Bob"
      });
      await elem.setOs(mockOs);

      const options = elem.shadowRoot.querySelectorAll("select option");
      expect(options[0].textContent).toBe("Alice");
      expect(options[1].textContent).toBe("Bob");
    });

    it("falls back to the URI as the option label when store.get(uri).label() returns the URI", async () => {
      const elem = document.createElement("boost-component");
      elem.setAttribute(
        "actor",
        "https://example.com/users/alice https://example.com/users/bob"
      );
      elem.setAttribute("outbox", "https://example.com/outbox");
      const mockOs = createMockOsWithLabel();
      await elem.setOs(mockOs);

      const options = elem.shadowRoot.querySelectorAll("select option");
      expect(options[0].textContent).toBe("https://example.com/users/alice");
      expect(options[1].textContent).toBe("https://example.com/users/bob");
    });

    it("fetches each listed actor's profile to populate labels", async () => {
      const elem = document.createElement("boost-component");
      elem.setAttribute(
        "actor",
        "https://example.com/users/alice https://example.com/users/bob"
      );
      elem.setAttribute("outbox", "https://example.com/outbox");
      const mockOs = createMockOsWithLabel({
        "https://example.com/users/alice": "Alice"
      });
      await elem.setOs(mockOs);

      expect(mockOs.store.fetch).toHaveBeenCalledWith(
        "https://example.com/users/alice"
      );
      expect(mockOs.store.fetch).toHaveBeenCalledWith(
        "https://example.com/users/bob"
      );
    });

    it("sends the first actor's URL as actor in the POST body by default", async () => {
      const elem = document.createElement("boost-component");
      elem.setAttribute(
        "actor",
        "https://example.com/users/alice https://example.com/users/bob"
      );
      elem.setAttribute("outbox", "https://example.com/outbox");

      const mockOs = createMockOsWithLabel();
      const mockFetch = mockOs.session.authenticatedFetch;
      await elem.setOs(mockOs);

      elem.resource = mockThing(
        "https://example.com/n/1",
        ["https://www.w3.org/ns/activitystreams#Note"]
      );
      await elem.boost();

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.actor).toBe("https://example.com/users/alice");
    });

    it("sends the selected actor's URL as actor in the POST body", async () => {
      const elem = document.createElement("boost-component");
      elem.setAttribute(
        "actor",
        "https://example.com/users/alice https://example.com/users/bob"
      );
      elem.setAttribute("outbox", "https://example.com/outbox");

      const mockOs = createMockOsWithLabel();
      const mockFetch = mockOs.session.authenticatedFetch;
      await elem.setOs(mockOs);

      const select = elem.shadowRoot.querySelector("select");
      select.value = "https://example.com/users/bob";
      select.dispatchEvent(new Event("change"));

      elem.resource = mockThing(
        "https://example.com/n/1",
        ["https://www.w3.org/ns/activitystreams#Note"]
      );
      await elem.boost();

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.actor).toBe("https://example.com/users/bob");
    });

    it("resolves outbox from the SELECTED actor's profile when outbox attribute omitted", async () => {
      const elem = document.createElement("boost-component");
      elem.setAttribute(
        "actor",
        "https://example.com/users/alice https://example.com/users/bob"
      );

      const outboxMap = {
        "https://example.com/users/alice":
          "https://example.com/users/alice/outbox",
        "https://example.com/users/bob":
          "https://example.com/users/bob/outbox"
      };

      const kb = graph();
      for (const [actorUri, outboxUri] of Object.entries(outboxMap)) {
        kb.add(
          sym(actorUri),
          sym("https://www.w3.org/ns/activitystreams#outbox"),
          sym(outboxUri),
          sym(actorUri)
        );
      }

      const mockFetch = vi.fn().mockResolvedValue({ status: 200, ok: true });
      const mockOs = {
        session: {
          authenticatedFetch: mockFetch,
          session: { webId: undefined }
        },
        store: {
          graph: kb,
          fetch: vi.fn().mockResolvedValue(undefined),
          get: vi.fn().mockImplementation(uri => ({
            uri,
            label: () => uri,
            anyValue: predicate => {
              if (predicate === "https://www.w3.org/ns/activitystreams#outbox") {
                const out = kb.any(
                  sym(uri),
                  sym("https://www.w3.org/ns/activitystreams#outbox")
                );
                return out ? out.value : null;
              }
              return null;
            }
          }))
        }
      };
      await elem.setOs(mockOs);

      const select = elem.shadowRoot.querySelector("select");
      select.value = "https://example.com/users/bob";
      select.dispatchEvent(new Event("change"));

      elem.resource = mockThing(
        "https://example.com/n/1",
        ["https://www.w3.org/ns/activitystreams#Note"]
      );
      await elem.boost();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com/users/bob/outbox",
        expect.any(Object)
      );
    });

    it("explicit single actor attribute wins over ancestor binding", async () => {
      const elem = document.createElement("boost-component");
      elem.setAttribute("actor", "https://example.com/users/alice");
      elem.setAttribute("outbox", "https://example.com/outbox");

      const container = document.createElement("div");
      const bound = document.createElement("div");
      bound.setAttribute("bind-subject", "actor");
      bound.resource = { uri: "https://example.com/users/shouldnotwin" };
      container.appendChild(bound);
      container.appendChild(elem);
      document.body.appendChild(container);

      const mockOs = createMockOsWithLabel();
      await elem.setOs(mockOs);

      elem.resource = mockThing(
        "https://example.com/n/1",
        ["https://www.w3.org/ns/activitystreams#Note"]
      );
      await elem.boost();

      expect(mockOs.session.authenticatedFetch).toHaveBeenCalledWith(
        "https://example.com/outbox",
        expect.any(Object)
      );
      const [, options] = mockOs.session.authenticatedFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.actor).toBe("https://example.com/users/alice");
    });

    it("explicit actor attribute list wins over ancestor binding", async () => {
      const elem = document.createElement("boost-component");
      elem.setAttribute(
        "actor",
        "https://example.com/users/alice https://example.com/users/bob"
      );
      elem.setAttribute("outbox", "https://example.com/outbox");

      const container = document.createElement("div");
      const bound = document.createElement("div");
      bound.setAttribute("bind-subject", "actor");
      bound.resource = { uri: "https://example.com/users/shouldnotwin" };
      container.appendChild(bound);
      container.appendChild(elem);
      document.body.appendChild(container);

      const mockOs = createMockOsWithLabel();
      await elem.setOs(mockOs);

      elem.resource = mockThing(
        "https://example.com/n/1",
        ["https://www.w3.org/ns/activitystreams#Note"]
      );
      await elem.boost();

      const [, options] = mockOs.session.authenticatedFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.actor).toBe("https://example.com/users/alice");
    });

    it("resolves actor list via {binding} interpolation from bind-object ancestor", async () => {
      const elem = document.createElement("boost-component");
      elem.setAttribute("actor", "{actors}");
      elem.setAttribute("outbox", "https://example.com/outbox");

      const container = document.createElement("div");
      const bound = document.createElement("input");
      bound.setAttribute("bind-object", "actors");
      bound.value =
        "https://example.com/users/alice https://example.com/users/bob";
      container.appendChild(bound);
      container.appendChild(elem);
      document.body.appendChild(container);

      const mockOs = createMockOsWithLabel();
      await elem.setOs(mockOs);

      const select = elem.shadowRoot.querySelector("select");
      expect(select).not.toBeNull();
      const options = select.querySelectorAll("option");
      expect(options.length).toBe(2);
      expect(options[0].value).toBe("https://example.com/users/alice");
      expect(options[1].value).toBe("https://example.com/users/bob");
    });
  });
});
