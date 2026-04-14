import { getRepoConfig, jsonResponse, assertAuthorized, uploadBinaryFile } from "./github-client.js";
import { ALLOWED_MEDIA_TYPES, validateUploadFile, slugify, typeFromMime } from "../shared/content-utils.js";

export const config = { runtime: "nodejs" };

function buildStoredPath(targetFolder, reelId, filename) {
  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const cleanName = slugify(filename);
  if (targetFolder === "reels") {
    return `assets/uploads/reels/${slugify(reelId || "general")}/${timestamp}-${cleanName}`;
  }
  return `assets/uploads/${slugify(targetFolder || "misc")}/${timestamp}-${cleanName}`;
}

function toPublicUrl(storedPath) {
  const { publicBasePath } = getRepoConfig();
  const cleanBase = publicBasePath === "/" ? "" : publicBasePath.replace(/\/$/, "");
  return `${cleanBase}/${storedPath}`.replace(/\/{2,}/g, "/");
}

export default async function handler(request) {
  try {
    const repoConfig = getRepoConfig();
    assertAuthorized(request, repoConfig.adminSecret);

    if (request.method !== "POST") {
      return jsonResponse({ ok: false, error: "Method not allowed." }, { status: 405 });
    }

    const formData = await request.formData();
    const targetFolder = String(formData.get("targetFolder") || "").trim();
    const reelId = String(formData.get("reelId") || "").trim();
    const files = formData.getAll("files").filter(Boolean);

    if (!targetFolder) {
      return jsonResponse({ ok: false, error: "targetFolder is required." }, { status: 400 });
    }
    if (!files.length) {
      return jsonResponse({ ok: false, error: "At least one file is required." }, { status: 400 });
    }

    const uploaded = [];
    for (const file of files) {
      if (!ALLOWED_MEDIA_TYPES.includes(file.type)) {
        return jsonResponse({ ok: false, error: `Unsupported type: ${file.type}` }, { status: 400 });
      }
      const error = validateUploadFile(file);
      if (error) {
        return jsonResponse({ ok: false, error }, { status: 400 });
      }

      const storedPath = buildStoredPath(targetFolder, reelId, file.name);
      const arrayBuffer = await file.arrayBuffer();
      await uploadBinaryFile(storedPath, arrayBuffer, `Upload ${storedPath}`);

      uploaded.push({
        originalName: file.name,
        storedPath,
        publicUrl: toPublicUrl(storedPath),
        type: typeFromMime(file.type)
      });
    }

    return jsonResponse({ ok: true, files: uploaded });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    console.error(error);
    return jsonResponse({ ok: false, error: error.message || "Upload failed." }, { status: 500 });
  }
}
