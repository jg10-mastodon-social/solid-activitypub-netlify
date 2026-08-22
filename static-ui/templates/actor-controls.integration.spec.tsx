import { vi, describe, it, expect, beforeEach } from "vitest";
import { render } from "@stencil/vitest";
import { readFileSync } from "fs";
import { join } from "path";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const TEMPLATE_PATH = join(__dirname, "actor-controls.html");
const FRAGMENT_HTML = readFileSync(TEMPLATE_PATH, "utf-8");

const WEBID = "https://alice.example/webid#me";
const TYPE_INDEX = "https://alice.example/settings/publicTypeIndex.ttl";
const BOT_URI = "https://example.test/bot";
const PERSON_URI = "https://example.test/alice";

const WEBID_TURTLE = `
@prefix solid: <http://www.w3.org/ns/solid/terms#>.
<${WEBID}> solid:publicTypeIndex <${TYPE_INDEX}>.
`;

const TYPE_INDEX_TURTLE = `
@prefix solid: <http://www.w3.org/ns/solid/terms#>.
@prefix as: <https://www.w3.org/ns/activitystreams#>.
<${TYPE_INDEX}> a solid:TypeIndex.
<#bot>
    a solid:TypeRegistration;
    solid:forClass as:Service;
    solid:instance <${BOT_URI}>.
<#alice>
    a solid:TypeRegistration;
    solid:forClass as:Person;
    solid:instance <${PERSON_URI}>.
`;

const BOT_TURTLE = `
@prefix as: <https://www.w3.org/ns/activitystreams#>.
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.
<${BOT_URI}> a as:Service; rdfs:label "Example Bot".
`;

const PERSON_TURTLE = `
@prefix as: <https://www.w3.org/ns/activitystreams#>.
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.
<${PERSON_URI}> a as:Person; rdfs:label "Alice Example".
`;

function turtleResponse(text: string): Response {
  return new Response(text, {
    status: 200,
    statusText: "OK",
    headers: new Headers({ "content-type": "text/turtle" }),
  });
}

function notFound(): Response {
  return new Response("", { status: 404, statusText: "Not Found", headers: new Headers() });
}

function withoutFragment(url: string): string {
  return url.split("#")[0];
}

function setLoaderUri(root: Element): void {
  const loader = root.querySelector("#webid-loader") as HTMLElement;
  loader.setAttribute("uri", WEBID);
}

function collectRichLinks(root: Element): { element: Element; uri: string | null; text: string }[] {
  const results: { element: Element; uri: string | null; text: string }[] = [];
  const all = root.querySelectorAll("pos-rich-link");
  for (const link of Array.from(all)) {
    const sr = (link as HTMLElement & { shadowRoot?: ShadowRoot | null }).shadowRoot;
    const anchor = sr?.querySelector("a");
    results.push({
      element: link,
      uri: anchor?.getAttribute("href") ?? null,
      text: collectAllText(link).trim(),
    });
  }
  return results;
}

function collectAllText(root: Element): string {
  let out = root.textContent ?? "";
  for (const child of Array.from(root.querySelectorAll("*"))) {
    const sr = (child as HTMLElement).shadowRoot;
    if (sr) {
      out += " " + (sr.textContent ?? "");
    }
  }
  return out;
}

describe("actor-controls.html integration", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (withoutFragment(url) === withoutFragment(WEBID)) return Promise.resolve(turtleResponse(WEBID_TURTLE));
      if (url === TYPE_INDEX) return Promise.resolve(turtleResponse(TYPE_INDEX_TURTLE));
      if (url === BOT_URI) return Promise.resolve(turtleResponse(BOT_TURTLE));
      if (url === PERSON_URI) return Promise.resolve(turtleResponse(PERSON_TURTLE));
      return Promise.resolve(notFound());
    });
  });

  it("loads the fragment template from disk", () => {
    expect(FRAGMENT_HTML.length).toBeGreaterThan(0);
  });

  it("accepts the webid URI when set directly on the loader", async () => {
    const { root, waitForChanges } = await render(`<pos-app><pos-router mode="pod">${FRAGMENT_HTML}</pos-router></pos-app>`);
    await waitForChanges();

    setLoaderUri(root);
    await waitForChanges();

    const loader = root.querySelector("#webid-loader");
    expect(loader).not.toBeNull();
    expect(loader?.getAttribute("uri")).toBe(WEBID);
  });

  it("renders a row for each registered AS Actor Type with label and type badges", async () => {
    const { root, waitForChanges } = await render(`<pos-app><pos-router mode="pod">${FRAGMENT_HTML}</pos-router></pos-app>`);
    await waitForChanges();

    setLoaderUri(root);
    await waitForChanges();
    await new Promise((r) => setTimeout(r, 300));
    await waitForChanges();

    const links = collectRichLinks(root);
    const botLink = links.find((l) => l.uri === BOT_URI);
    const personLink = links.find((l) => l.uri === PERSON_URI);

    expect(botLink, "bot row not rendered").toBeDefined();
    expect(personLink, "person row not rendered").toBeDefined();
    expect(botLink!.text).toContain("Example Bot");
    expect(personLink!.text).toContain("Alice Example");

    const badges = root.querySelectorAll("pos-type-badges");
    expect(badges.length).toBeGreaterThanOrEqual(2);
  });

  it("filters out unregistered AS Actor Types so no rows render for as:Group", async () => {
    const { root, waitForChanges } = await render(`<pos-app><pos-router mode="pod">${FRAGMENT_HTML}</pos-router></pos-app>`);
    await waitForChanges();

    setLoaderUri(root);
    await waitForChanges();
    await new Promise((r) => setTimeout(r, 300));
    await waitForChanges();

    const links = collectRichLinks(root);
    const groupLinks = links.filter((l) => {
      const parent = l.element.closest("pos-case");
      return parent?.getAttribute("every-value-eq") === "https://www.w3.org/ns/activitystreams#Group";
    });
    expect(groupLinks.length).toBe(0);
  });
});