import { getRepoConfig, jsonResponse, assertAuthorized, getFileMetadata } from "./github-client.js";

export const config = { runtime: "nodejs" };

export default async function handler(request) {
  try {
    const repoConfig = getRepoConfig();
    assertAuthorized(request, repoConfig.adminSecret);

    if (request.method !== "GET") {
      return jsonResponse({ ok: false, error: "Method not allowed." }, { status: 405 });
    }

    const metadata = await getFileMetadata("content.json");
    return jsonResponse({
      ok: true,
      sha: metadata?.sha || "",
      path: metadata?.path || "content.json"
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    console.error(error);
    return jsonResponse({ ok: false, error: error.message || "Unable to load content metadata." }, { status: 500 });
  }
}
