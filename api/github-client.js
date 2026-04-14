const GITHUB_API_URL = "https://api.github.com";

function getEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getRepoConfig() {
  return {
    token: getEnv("GITHUB_TOKEN"),
    owner: getEnv("GITHUB_OWNER"),
    repo: getEnv("GITHUB_REPO"),
    branch: getEnv("GITHUB_BRANCH"),
    adminSecret: getEnv("ADMIN_SECRET"),
    publicBasePath: process.env.PUBLIC_BASE_PATH || `/${getEnv("GITHUB_REPO")}`
  };
}

export function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status: init.status || 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(init.headers || {})
    }
  });
}

export function assertAuthorized(request, adminSecret) {
  const provided = request.headers.get("x-admin-secret");
  if (!provided || provided !== adminSecret) {
    throw new Response(JSON.stringify({ ok: false, error: "Unauthorized." }), {
      status: 401,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }
}

async function githubFetch(path, options = {}) {
  const { token } = getRepoConfig();
  const response = await fetch(`${GITHUB_API_URL}${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "user-agent": "trstudio-admin",
      ...(options.headers || {})
    }
  });
  return response;
}

function encodeGitHubPath(path) {
  return String(path)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export async function getFileMetadata(path) {
  const { owner, repo, branch } = getRepoConfig();
  const response = await githubFetch(`/repos/${owner}/${repo}/contents/${encodeGitHubPath(path)}?ref=${encodeURIComponent(branch)}`);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`GitHub metadata request failed for ${path}: ${response.status}`);
  }
  return response.json();
}

export async function putFile({ path, contentBase64, message, sha = "" }) {
  const { owner, repo, branch } = getRepoConfig();
  const response = await githubFetch(`/repos/${owner}/${repo}/contents/${encodeGitHubPath(path)}`, {
    method: "PUT",
    headers: {
      "content-type": "application/json; charset=utf-8"
    },
    body: JSON.stringify({
      message,
      branch,
      content: contentBase64,
      ...(sha ? { sha } : {})
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GitHub write failed for ${path}: ${response.status} ${detail}`);
  }

  return response.json();
}

export async function upsertTextFile(path, text, message) {
  const existing = await getFileMetadata(path);
  const contentBase64 = Buffer.from(text, "utf8").toString("base64");
  return putFile({
    path,
    contentBase64,
    message,
    sha: existing?.sha || ""
  });
}

export async function uploadBinaryFile(path, arrayBuffer, message) {
  const existing = await getFileMetadata(path);
  const contentBase64 = Buffer.from(arrayBuffer).toString("base64");
  return putFile({
    path,
    contentBase64,
    message,
    sha: existing?.sha || ""
  });
}
