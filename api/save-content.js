import { getRepoConfig, jsonResponse, assertAuthorized, upsertTextFile } from "./github-client.js";
import { normalizeContent, validateContent } from "../shared/content-utils.js";

export const config = { runtime: "nodejs" };

export default async function handler(request) {
  try {
    const repoConfig = getRepoConfig();
    assertAuthorized(request, repoConfig.adminSecret);

    if (request.method !== "POST") {
      return jsonResponse({ ok: false, error: "Method not allowed." }, { status: 405 });
    }

    const payload = await request.json();
    const content = normalizeContent(payload?.content);
    const issues = validateContent(content);
    if (issues.length) {
      return jsonResponse({ ok: false, error: "Validation failed.", issues }, { status: 400 });
    }

    const message = String(payload?.message || "Publish portfolio content").trim();
    const result = await upsertTextFile("content.json", `${JSON.stringify(content, null, 2)}\n`, message);

    return jsonResponse({
      ok: true,
      contentPath: "content.json",
      commitSha: result.commit?.sha || "",
      contentSha: result.content?.sha || ""
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    console.error(error);
    return jsonResponse({ ok: false, error: error.message || "Publish failed." }, { status: 500 });
  }
}
