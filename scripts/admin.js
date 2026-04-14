import {
  CONTENT_URL,
  DRAFT_CONTENT_KEY,
  DRAFT_META_KEY,
  THEME_KEY,
  LANG_KEY,
  ADMIN_CONFIG,
  defaultData,
  normalizeContent,
  validateContent,
  textFor,
  createDraftMeta,
  createEmptyReel,
  createEmptyCredential,
  createEmptyContact,
  createId,
  fileStem,
  validateUploadFile,
  escapeHtml,
  escapeAttr,
  slugify,
  typeFromMime
} from "../shared/content-utils.js";

const GITHUB_TOKEN_KEY = "portfolioGithubToken";
const DEFAULT_WORKFLOW_ID = "publish-content.yml";
const GITHUB_API = "https://api.github.com";

const state = {
  publishedContent: normalizeContent(defaultData),
  publishedSha: "",
  draftContent: normalizeContent(defaultData),
  draftMeta: createDraftMeta(""),
  recoveredDraft: null,
  recoveredMeta: null,
  lang: localStorage.getItem(LANG_KEY) || "en",
  theme: localStorage.getItem(THEME_KEY) || "dark",
  githubToken: sessionStorage.getItem(GITHUB_TOKEN_KEY) || "",
  workflowId: ADMIN_CONFIG.workflowId || DEFAULT_WORKFLOW_ID,
  repo: inferRepoContext(),
  uploadQueues: {},
  previewUrls: {},
  status: { tone: "muted", text: "Loading published content..." }
};

const elements = {
  topBar: document.getElementById("topBar"),
  langToggle: document.getElementById("langToggle"),
  themeToggle: document.getElementById("themeToggle"),
  brandMark: document.getElementById("brandMark"),
  brandLogoPreview: document.getElementById("brandLogoPreview"),
  brandLogoFile: document.getElementById("brandLogoFile"),
  heroMediaPreview: document.getElementById("heroMediaPreview"),
  heroMediaFile: document.getElementById("heroMediaFile"),
  restoreBanner: document.getElementById("restoreBanner"),
  restoreText: document.getElementById("restoreText"),
  statusMessage: document.getElementById("statusMessage"),
  summaryContent: document.getElementById("summaryContent"),
  chipDraft: document.getElementById("chipDraft"),
  chipUpload: document.getElementById("chipUpload"),
  chipPublish: document.getElementById("chipPublish"),
  githubTokenInput: document.getElementById("githubTokenInput"),
  connectBtn: document.getElementById("connectGitHub"),
  publishedSha: document.getElementById("publishedSha"),
  saveDraft: document.getElementById("saveDraft"),
  publish: document.getElementById("publishContent"),
  refresh: document.getElementById("refreshPublished"),
  reelsContainer: document.getElementById("reelsContainer"),
  credentialsContainer: document.getElementById("credentialsContainer"),
  contactsContainer: document.getElementById("contactsContainer"),
  validationList: document.getElementById("validationList"),
  publishMeta: document.getElementById("publishMeta")
};

function inferRepoContext() {
  const repo = {
    owner: ADMIN_CONFIG.repoOwner || "",
    name: ADMIN_CONFIG.repoName || "",
    branch: ADMIN_CONFIG.repoBranch || "main"
  };

  if (!repo.owner || !repo.name) {
    const host = globalThis.location?.hostname || "";
    const pathParts = (globalThis.location?.pathname || "/").split("/").filter(Boolean);
    if (host.endsWith(".github.io")) {
      if (!repo.owner) repo.owner = host.split(".")[0] || "";
      if (!repo.name && pathParts.length) repo.name = pathParts[0];
    }
  }

  return repo;
}

function t(value) {
  return textFor(value, state.lang);
}

function pathGet(target, path) {
  return path.split(".").reduce((cursor, key) => cursor?.[key], target);
}

function pathSet(target, path, value) {
  const keys = path.split(".");
  let cursor = target;
  for (let index = 0; index < keys.length - 1; index += 1) {
    cursor = cursor[keys[index]];
  }
  cursor[keys.at(-1)] = value;
}

function setStatus(text, tone = "muted") {
  state.status = { text, tone };
  elements.statusMessage.textContent = text;
  elements.statusMessage.dataset.tone = tone;
}

function saveDraftToStorage() {
  localStorage.setItem(DRAFT_CONTENT_KEY, JSON.stringify(state.draftContent));
  localStorage.setItem(DRAFT_META_KEY, JSON.stringify(state.draftMeta));
}

function clearDraftStorage() {
  localStorage.removeItem(DRAFT_CONTENT_KEY);
  localStorage.removeItem(DRAFT_META_KEY);
}

function markDirty(note = "") {
  state.draftMeta.updatedAt = new Date().toISOString();
  state.draftMeta.dirty = true;
  saveDraftToStorage();
  renderStatus();
  if (note) setStatus(note, "info");
}

function setTheme(theme) {
  state.theme = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", state.theme);
  localStorage.setItem(THEME_KEY, state.theme);
  elements.themeToggle.textContent = state.theme === "dark" ? "☀️" : "🌙";
}

function setLanguage(lang) {
  state.lang = lang === "ar" ? "ar" : "en";
  document.documentElement.setAttribute("data-lang", state.lang);
  document.documentElement.setAttribute("dir", state.lang === "ar" ? "rtl" : "ltr");
  document.documentElement.setAttribute("lang", state.lang);
  localStorage.setItem(LANG_KEY, state.lang);
  elements.langToggle.textContent = state.lang === "en" ? "AR" : "EN";
  document.querySelectorAll("[data-en]").forEach((node) => {
    node.textContent = node.getAttribute(`data-${state.lang}`) || node.getAttribute("data-en") || "";
  });
  renderAll();
}

function countDifferences(left, right) {
  if (typeof left !== typeof right) return 1;
  if (left === null || right === null) return left === right ? 0 : 1;
  if (typeof left !== "object") return left === right ? 0 : 1;
  if (Array.isArray(left) || Array.isArray(right)) {
    const l = Array.isArray(left) ? left : [];
    const r = Array.isArray(right) ? right : [];
    let total = Math.abs(l.length - r.length);
    const size = Math.min(l.length, r.length);
    for (let index = 0; index < size; index += 1) total += countDifferences(l[index], r[index]);
    return total;
  }
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  let total = 0;
  keys.forEach((key) => {
    total += countDifferences(left[key], right[key]);
  });
  return total;
}

function pendingUploadCount() {
  return Object.values(state.uploadQueues).reduce((sum, files) => sum + files.length, 0);
}

function workflowHtmlUrl() {
  if (!state.repo.owner || !state.repo.name) return "";
  return `https://github.com/${state.repo.owner}/${state.repo.name}/actions/workflows/${state.workflowId}`;
}

function renderStatus() {
  const diffCount = countDifferences(state.publishedContent, state.draftContent);
  const draftDirty = state.draftMeta.dirty || diffCount > 0;
  const queuedUploads = pendingUploadCount();
  const publishedAt = state.draftMeta.lastPublishedAt || "Never";
  const publishRequestedAt = state.draftMeta.lastPublishRequestedAt || "";

  elements.chipDraft.textContent = draftDirty
    ? (state.lang === "ar" ? "مسودة" : "Draft")
    : (state.lang === "ar" ? "متزامن" : "Synced");
  elements.chipDraft.dataset.active = draftDirty ? "true" : "false";

  elements.chipUpload.textContent = queuedUploads
    ? `${state.lang === "ar" ? "ملفات محضرة" : "Prepared media"} ${queuedUploads}`
    : (state.lang === "ar" ? "لا توجد ملفات محضرة" : "No prepared media");
  elements.chipUpload.dataset.active = queuedUploads ? "true" : "false";

  elements.chipPublish.textContent = publishRequestedAt && draftDirty
    ? (state.lang === "ar" ? "النشر قيد الانتظار" : "Publish queued")
    : state.publishedSha
      ? (state.lang === "ar" ? "آخر نسخة منشورة" : "Published state")
      : (state.lang === "ar" ? "غير متصل" : "Not connected");
  elements.chipPublish.dataset.active = publishRequestedAt ? "true" : "false";

  elements.summaryContent.innerHTML = `
    <strong>${state.lang === "ar" ? "ملخص الحالة" : "Status Summary"}</strong>
    <span>${state.lang === "ar" ? "المستودع:" : "Repository:"} ${escapeHtml(`${state.repo.owner || "?"}/${state.repo.name || "?"}@${state.repo.branch}`)}</span>
    <span>${state.lang === "ar" ? "التغييرات مقارنة بالمنشور:" : "Differences vs published:"} ${diffCount}</span>
    <span>${state.lang === "ar" ? "آخر تحديث للمسودة:" : "Draft updated:"} ${new Date(state.draftMeta.updatedAt).toLocaleString()}</span>
    <span>${state.lang === "ar" ? "آخر نشر مكتمل:" : "Last completed publish:"} ${publishedAt === "Never" ? publishedAt : new Date(publishedAt).toLocaleString()}</span>
    ${publishRequestedAt ? `<span>${state.lang === "ar" ? "آخر طلب نشر:" : "Last publish request:"} ${new Date(publishRequestedAt).toLocaleString()}</span>` : ""}
  `;

  const workflowUrl = workflowHtmlUrl();
  elements.publishMeta.innerHTML = state.publishedSha
    ? `content.json @ ${escapeHtml(state.publishedSha.slice(0, 7))}${workflowUrl ? ` · <a href="${workflowUrl}" target="_blank" rel="noopener noreferrer">workflow</a>` : ""}`
    : (workflowUrl ? `<a href="${workflowUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(state.workflowId)}</a>` : "content.json sha unavailable");
  elements.publishedSha.textContent = state.publishedSha || "Unavailable";
}

function renderRecoveryBanner() {
  const visible = Boolean(state.recoveredDraft && state.recoveredMeta?.dirty);
  elements.restoreBanner.hidden = !visible;
  if (visible) {
    elements.restoreText.textContent = state.lang === "ar"
      ? `تم العثور على مسودة محلية من ${new Date(state.recoveredMeta.updatedAt).toLocaleString()}.`
      : `A local draft from ${new Date(state.recoveredMeta.updatedAt).toLocaleString()} was found.`;
  }
}

function fillInput(id, value) {
  const node = document.getElementById(id);
  if (node) node.value = value;
}

function renderStaticFields() {
  fillInput("brandMarkInput", state.draftContent.brand.mark);
  fillInput("brandLogoInput", state.draftContent.brand.logo);
  fillInput("heroNameInput", state.draftContent.hero.name);
  fillInput("heroRoleEn", state.draftContent.hero.role.en);
  fillInput("heroRoleAr", state.draftContent.hero.role.ar);
  fillInput("heroSummaryEn", state.draftContent.hero.summary.en);
  fillInput("heroSummaryAr", state.draftContent.hero.summary.ar);
  fillInput("heroSubtitleEn", state.draftContent.hero.subtitle.en);
  fillInput("heroSubtitleAr", state.draftContent.hero.subtitle.ar);
  fillInput("heroMediaUrl", state.draftContent.hero.mediaUrl);
  fillInput("heroSpecsInput", state.draftContent.hero.specs.join(", "));
  fillInput("portfolioTitleEn", state.draftContent.portfolio.title.en);
  fillInput("portfolioTitleAr", state.draftContent.portfolio.title.ar);
  fillInput("portfolioDescEn", state.draftContent.portfolio.description.en);
  fillInput("portfolioDescAr", state.draftContent.portfolio.description.ar);
  fillInput("ctaPortfolioEn", state.draftContent.cta.portfolio.en);
  fillInput("ctaPortfolioAr", state.draftContent.cta.portfolio.ar);
  fillInput("ctaBookEn", state.draftContent.cta.book.en);
  fillInput("ctaBookAr", state.draftContent.cta.book.ar);
  fillInput("credentialsTitleEn", state.draftContent.credentialsTitle.en);
  fillInput("credentialsTitleAr", state.draftContent.credentialsTitle.ar);
  fillInput("contactTitleEn", state.draftContent.contactTitle.en);
  fillInput("contactTitleAr", state.draftContent.contactTitle.ar);
  document.getElementById("heroMediaType").value = state.draftContent.hero.mediaType;

  elements.brandMark.textContent = state.draftContent.brand.mark;
  elements.brandLogoPreview.src = state.previewUrls.brandLogo || state.draftContent.brand.logo;
  renderHeroPreview();
}

function renderHeroPreview() {
  const src = state.previewUrls.heroMedia || state.draftContent.hero.mediaUrl;
  const media = state.draftContent.hero.mediaType === "video"
    ? `<video src="${escapeAttr(src)}" controls muted playsinline></video>`
    : `<img src="${escapeAttr(src)}" alt="${escapeAttr(state.draftContent.hero.name)}">`;
  elements.heroMediaPreview.innerHTML = media;
}

function updatePreviewUrl(key, file) {
  const oldUrl = state.previewUrls[key];
  if (oldUrl) URL.revokeObjectURL(oldUrl);
  state.previewUrls[key] = file ? URL.createObjectURL(file) : "";
}

function suggestedAssetPath(folder, filename, reelId = "") {
  const cleanName = slugify(filename);
  if (folder === "reels") {
    return `assets/uploads/reels/${slugify(reelId || "general")}/${cleanName}`;
  }
  return `assets/uploads/${slugify(folder)}/${cleanName}`;
}

function useLocalFileForPath(folder, input, apply) {
  const file = input?.files?.[0];
  if (!file) {
    setStatus("Choose a local file first.", "warning");
    return;
  }
  const issue = validateUploadFile(file);
  if (issue) {
    setStatus(issue, "error");
    return;
  }
  apply(file, suggestedAssetPath(folder, file.name));
}

function reelQueueMarkup(reelId) {
  const queue = state.uploadQueues[reelId] || [];
  if (!queue.length) {
    return `<p class="hint">${state.lang === "ar" ? "لا توجد ملفات محضرة بعد." : "No prepared local files yet."}</p>`;
  }
  return `
    <ul class="queue-list">
      ${queue.map((file, index) => `<li>${escapeHtml(file.name)}<button type="button" data-action="remove-queued-file" data-reel-id="${escapeAttr(reelId)}" data-index="${index}">Remove</button></li>`).join("")}
    </ul>
  `;
}

function renderReels() {
  const reels = state.draftContent.reels || [];
  if (!reels.length) {
    elements.reelsContainer.innerHTML = `<div class="empty-card">${state.lang === "ar" ? "لا توجد معارض. أضف معرضًا جديدًا." : "No reels yet. Add a new reel."}</div>`;
    return;
  }

  elements.reelsContainer.innerHTML = reels.map((reel, reelIndex) => `
    <section class="editor-card">
      <div class="card-head">
        <h3>${state.lang === "ar" ? `معرض ${reelIndex + 1}` : `Reel ${reelIndex + 1}`}</h3>
        <div class="card-actions">
          <button type="button" data-action="add-item" data-reel-index="${reelIndex}">${state.lang === "ar" ? "عنصر جديد" : "Add item"}</button>
          <button type="button" data-action="remove-reel" data-reel-index="${reelIndex}">${state.lang === "ar" ? "حذف المعرض" : "Remove reel"}</button>
        </div>
      </div>
      <div class="grid two">
        <label>
          <span>Title (EN)</span>
          <input data-path="reels.${reelIndex}.title" data-lang-field="en" value="${escapeAttr(reel.title.en)}">
        </label>
        <label>
          <span>Title (AR)</span>
          <input dir="rtl" data-path="reels.${reelIndex}.title" data-lang-field="ar" value="${escapeAttr(reel.title.ar)}">
        </label>
      </div>
      <div class="grid two">
        <label>
          <span>Description (EN)</span>
          <textarea data-path="reels.${reelIndex}.description" data-lang-field="en">${escapeHtml(reel.description.en)}</textarea>
        </label>
        <label>
          <span>Description (AR)</span>
          <textarea dir="rtl" data-path="reels.${reelIndex}.description" data-lang-field="ar">${escapeHtml(reel.description.ar)}</textarea>
        </label>
      </div>

      <div class="upload-panel">
        <div>
          <strong>${state.lang === "ar" ? "تحضير ملفات محلية لهذا المعرض" : "Prepare local files for this reel"}</strong>
          <p>${state.lang === "ar" ? "اختر ملفات محلية ليتم إنشاء مساراتها داخل assets/uploads/reels/... ثم ارفع الملفات فعليًا إلى المستودع عبر Git أو واجهة GitHub." : "Select local files to generate repo-relative paths under assets/uploads/reels/..., then upload the actual files to the repo with Git or the GitHub web UI."}</p>
        </div>
        <input type="file" multiple data-action="queue-files" data-reel-id="${escapeAttr(reel.id)}" accept="image/jpeg,image/png,image/webp,image/svg+xml,video/mp4,video/webm,video/quicktime">
        ${reelQueueMarkup(reel.id)}
        <button type="button" data-action="add-queued-files" data-reel-id="${escapeAttr(reel.id)}">${state.lang === "ar" ? "إضافة المسارات إلى المسودة" : "Add queued paths to draft"}</button>
      </div>

      <div class="item-list">
        ${reel.items.length ? reel.items.map((item, itemIndex) => renderReelItem(reel, reelIndex, item, itemIndex)).join("") : `<div class="empty-card">${state.lang === "ar" ? "لا توجد عناصر داخل هذا المعرض." : "This reel has no items yet."}</div>`}
      </div>
    </section>
  `).join("");
}

function renderReelItem(reel, reelIndex, item, itemIndex) {
  return `
    <article class="nested-card">
      <div class="card-head">
        <strong>${state.lang === "ar" ? `عنصر ${itemIndex + 1}` : `Item ${itemIndex + 1}`}</strong>
        <button type="button" data-action="remove-item" data-reel-index="${reelIndex}" data-item-index="${itemIndex}">${state.lang === "ar" ? "حذف" : "Remove"}</button>
      </div>
      <div class="grid three">
        <label>
          <span>Type</span>
          <select data-path="reels.${reelIndex}.items.${itemIndex}.type">
            <option value="image"${item.type === "image" ? " selected" : ""}>Image</option>
            <option value="video"${item.type === "video" ? " selected" : ""}>Video</option>
          </select>
        </label>
        <label>
          <span>Source URL</span>
          <input data-path="reels.${reelIndex}.items.${itemIndex}.src" value="${escapeAttr(item.src)}">
        </label>
        <label>
          <span>Thumb URL</span>
          <input data-path="reels.${reelIndex}.items.${itemIndex}.thumb" value="${escapeAttr(item.thumb)}">
        </label>
      </div>
      <div class="grid two">
        <label>
          <span>Title (EN)</span>
          <input data-path="reels.${reelIndex}.items.${itemIndex}.title" data-lang-field="en" value="${escapeAttr(item.title.en)}">
        </label>
        <label>
          <span>Title (AR)</span>
          <input dir="rtl" data-path="reels.${reelIndex}.items.${itemIndex}.title" data-lang-field="ar" value="${escapeAttr(item.title.ar)}">
        </label>
      </div>
      <div class="grid two">
        <label>
          <span>Description (EN)</span>
          <textarea data-path="reels.${reelIndex}.items.${itemIndex}.description" data-lang-field="en">${escapeHtml(item.description.en)}</textarea>
        </label>
        <label>
          <span>Description (AR)</span>
          <textarea dir="rtl" data-path="reels.${reelIndex}.items.${itemIndex}.description" data-lang-field="ar">${escapeHtml(item.description.ar)}</textarea>
        </label>
      </div>
      <div class="upload-inline">
        <label><span>${state.lang === "ar" ? "اختر ملف المصدر محليًا" : "Choose local source file"}</span><input type="file" data-item-source="${escapeAttr(reel.id)}:${escapeAttr(item.id)}" accept="image/jpeg,image/png,image/webp,image/svg+xml,video/mp4,video/webm,video/quicktime"></label>
        <button type="button" data-action="use-item-source" data-reel-id="${escapeAttr(reel.id)}" data-item-id="${escapeAttr(item.id)}">${state.lang === "ar" ? "استخدم مسار المصدر" : "Use source path"}</button>
        <label><span>${state.lang === "ar" ? "اختر صورة مصغرة محليًا" : "Choose local thumbnail"}</span><input type="file" data-item-thumb="${escapeAttr(reel.id)}:${escapeAttr(item.id)}" accept="image/jpeg,image/png,image/webp,image/svg+xml"></label>
        <button type="button" data-action="use-item-thumb" data-reel-id="${escapeAttr(reel.id)}" data-item-id="${escapeAttr(item.id)}">${state.lang === "ar" ? "استخدم مسار المصغرة" : "Use thumb path"}</button>
      </div>
    </article>
  `;
}

function renderCredentials() {
  const items = state.draftContent.credentials || [];
  if (!items.length) {
    elements.credentialsContainer.innerHTML = `<div class="empty-card">${state.lang === "ar" ? "لا توجد اعتمادات." : "No credentials yet."}</div>`;
    return;
  }
  elements.credentialsContainer.innerHTML = items.map((item, index) => `
    <article class="nested-card">
      <div class="card-head">
        <strong>${state.lang === "ar" ? `اعتماد ${index + 1}` : `Credential ${index + 1}`}</strong>
        <button type="button" data-action="remove-credential" data-index="${index}">${state.lang === "ar" ? "حذف" : "Remove"}</button>
      </div>
      <div class="grid three">
        <label><span>Title (EN)</span><input data-path="credentials.${index}.title" data-lang-field="en" value="${escapeAttr(item.title.en)}"></label>
        <label><span>Title (AR)</span><input dir="rtl" data-path="credentials.${index}.title" data-lang-field="ar" value="${escapeAttr(item.title.ar)}"></label>
        <label><span>Year</span><input data-path="credentials.${index}.year" value="${escapeAttr(item.year)}"></label>
      </div>
      <div class="upload-inline">
        <label><span>Image URL</span><input data-path="credentials.${index}.image" value="${escapeAttr(item.image)}"></label>
        <label><span>${state.lang === "ar" ? "اختر ملف الشهادة" : "Choose local image"}</span><input type="file" data-credential-file="${index}" accept="image/jpeg,image/png,image/webp,image/svg+xml"></label>
        <button type="button" data-action="use-credential-image" data-index="${index}">${state.lang === "ar" ? "استخدم مسار الصورة" : "Use image path"}</button>
      </div>
    </article>
  `).join("");
}

function renderContacts() {
  const items = state.draftContent.contacts || [];
  if (!items.length) {
    elements.contactsContainer.innerHTML = `<div class="empty-card">${state.lang === "ar" ? "لا توجد وسائل تواصل." : "No contacts yet."}</div>`;
    return;
  }
  elements.contactsContainer.innerHTML = items.map((item, index) => `
    <article class="nested-card">
      <div class="card-head">
        <strong>${state.lang === "ar" ? `وسيلة ${index + 1}` : `Contact ${index + 1}`}</strong>
        <button type="button" data-action="remove-contact" data-index="${index}">${state.lang === "ar" ? "حذف" : "Remove"}</button>
      </div>
      <div class="grid three">
        <label><span>Label (EN)</span><input data-path="contacts.${index}.label" data-lang-field="en" value="${escapeAttr(item.label.en)}"></label>
        <label><span>Label (AR)</span><input dir="rtl" data-path="contacts.${index}.label" data-lang-field="ar" value="${escapeAttr(item.label.ar)}"></label>
        <label><span>Value</span><input data-path="contacts.${index}.value" value="${escapeAttr(item.value)}"></label>
      </div>
      <label><span>Href</span><input data-path="contacts.${index}.href" value="${escapeAttr(item.href)}"></label>
    </article>
  `).join("");
}

function renderValidation() {
  const issues = validateContent(state.draftContent);
  elements.validationList.innerHTML = issues.length
    ? issues.map((issue) => `<li>${escapeHtml(issue)}</li>`).join("")
    : `<li>${state.lang === "ar" ? "لا توجد أخطاء تحقق." : "No validation issues."}</li>`;
}

function renderAll() {
  renderRecoveryBanner();
  renderStaticFields();
  renderReels();
  renderCredentials();
  renderContacts();
  renderValidation();
  renderStatus();
}

function updatePathFromInput(node) {
  const path = node.dataset.path;
  if (!path) return;
  if (node.dataset.langField) {
    const current = pathGet(state.draftContent, path);
    current[node.dataset.langField] = node.value;
  } else if (node.dataset.transform === "list") {
    pathSet(state.draftContent, path, node.value.split(/\n|,/).map((value) => value.trim()).filter(Boolean));
  } else {
    pathSet(state.draftContent, path, node.value);
  }

  if (path === "brand.mark") {
    elements.brandMark.textContent = node.value;
  }
  if (path === "brand.logo") {
    elements.brandLogoPreview.src = state.previewUrls.brandLogo || node.value;
  }
  if (path === "hero.mediaUrl" || path === "hero.mediaType") {
    renderHeroPreview();
  }

  markDirty("Draft updated locally.");
  renderValidation();
}

function restoreDraft() {
  if (!state.recoveredDraft) return;
  state.draftContent = normalizeContent(state.recoveredDraft);
  state.draftMeta = { ...createDraftMeta(state.publishedSha), ...state.recoveredMeta, dirty: true };
  state.recoveredDraft = null;
  state.recoveredMeta = null;
  saveDraftToStorage();
  renderAll();
  setStatus("Recovered local draft.", "info");
}

function discardRecoveredDraft() {
  state.recoveredDraft = null;
  state.recoveredMeta = null;
  clearDraftStorage();
  state.draftContent = normalizeContent(state.publishedContent);
  state.draftMeta = createDraftMeta(state.publishedSha);
  renderAll();
  setStatus("Discarded local draft and reset to published content.", "muted");
}

async function loadPublishedContent() {
  try {
    const response = await fetch(CONTENT_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`Failed to fetch ${CONTENT_URL}`);
    const content = normalizeContent(await response.json());
    state.publishedContent = content;
    state.draftContent = normalizeContent(content);
    state.draftMeta = createDraftMeta(state.publishedSha);

    const rawDraft = localStorage.getItem(DRAFT_CONTENT_KEY);
    const rawMeta = localStorage.getItem(DRAFT_META_KEY);
    if (rawDraft && rawMeta) {
      try {
        const parsedMeta = JSON.parse(rawMeta);
        if (parsedMeta?.dirty) {
          state.recoveredDraft = normalizeContent(JSON.parse(rawDraft));
          state.recoveredMeta = parsedMeta;
        }
      } catch (error) {
        console.warn("Ignoring invalid draft", error);
      }
    }

    renderAll();
    setStatus("Published content loaded.", "success");
  } catch (error) {
    console.error(error);
    state.publishedContent = normalizeContent(defaultData);
    state.draftContent = normalizeContent(defaultData);
    state.draftMeta = createDraftMeta(state.publishedSha);
    renderAll();
    setStatus("Published content could not be loaded. Fallback content is active.", "error");
  }
}

async function githubApi(path, init = {}, requireToken = false) {
  const headers = new Headers(init.headers || {});
  headers.set("accept", "application/vnd.github+json");
  headers.set("x-github-api-version", "2022-11-28");
  if (state.githubToken) {
    headers.set("authorization", `Bearer ${state.githubToken}`);
  } else if (requireToken) {
    throw new Error("Enter a GitHub token first.");
  }

  return fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers
  });
}

async function refreshPublishedSha() {
  if (!state.repo.owner || !state.repo.name) {
    setStatus("Could not infer the GitHub repository from this Pages URL.", "error");
    return;
  }
  try {
    const response = await githubApi(`/repos/${state.repo.owner}/${state.repo.name}/contents/content.json?ref=${encodeURIComponent(state.repo.branch)}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || "Unable to fetch content.json metadata.");
    state.publishedSha = payload.sha || "";
    state.draftMeta.basedOnPublishedSha = state.publishedSha;
    if (countDifferences(state.publishedContent, state.draftContent) === 0) {
      state.draftMeta.dirty = false;
      if (state.draftMeta.lastPublishRequestedAt) {
        state.draftMeta.lastPublishedAt = new Date().toISOString();
        state.draftMeta.lastPublishRequestedAt = "";
      }
      saveDraftToStorage();
    }
    renderStatus();
    setStatus("Connected to GitHub repository metadata.", "success");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Unable to connect to GitHub.", "error");
  }
}

function rememberGitHubToken() {
  state.githubToken = elements.githubTokenInput.value.trim();
  sessionStorage.setItem(GITHUB_TOKEN_KEY, state.githubToken);
  refreshPublishedSha();
}

function saveDraft() {
  saveDraftToStorage();
  setStatus("Draft saved locally.", "success");
}

function queueFilesForReel(reelId, files) {
  const valid = [];
  for (const file of files) {
    const issue = validateUploadFile(file);
    if (issue) {
      setStatus(issue, "error");
      continue;
    }
    valid.push(file);
  }
  state.uploadQueues[reelId] = [...(state.uploadQueues[reelId] || []), ...valid];
  renderReels();
  renderStatus();
}

function addQueuedFilesToDraft(reelId) {
  const queue = state.uploadQueues[reelId] || [];
  if (!queue.length) {
    setStatus("No queued files to add.", "warning");
    return;
  }
  const reel = state.draftContent.reels.find((entry) => entry.id === reelId);
  if (!reel) {
    setStatus("Target reel not found.", "error");
    return;
  }

  queue.forEach((file) => {
    const type = typeFromMime(file.type);
    const src = suggestedAssetPath("reels", file.name, reelId);
    reel.items.push({
      id: createId(),
      type,
      title: { en: fileStem(file.name), ar: fileStem(file.name) },
      description: { en: "", ar: "" },
      src,
      thumb: type === "image" ? src : src
    });
  });

  state.uploadQueues[reelId] = [];
  markDirty("Prepared repo-relative media paths for the reel. Upload the matching files to the repo before publishing.");
  renderReels();
  renderValidation();
}

function useBrandLogoPath() {
  useLocalFileForPath("brand", elements.brandLogoFile, (file, path) => {
    state.draftContent.brand.logo = path;
    fillInput("brandLogoInput", path);
    updatePreviewUrl("brandLogo", file);
    elements.brandLogoPreview.src = state.previewUrls.brandLogo;
    markDirty("Brand logo path prepared. Upload the same file to the repository.");
  });
}

function useHeroMediaPath() {
  useLocalFileForPath("hero", elements.heroMediaFile, (file, path) => {
    state.draftContent.hero.mediaUrl = path;
    state.draftContent.hero.mediaType = typeFromMime(file.type);
    fillInput("heroMediaUrl", path);
    document.getElementById("heroMediaType").value = state.draftContent.hero.mediaType;
    updatePreviewUrl("heroMedia", file);
    renderHeroPreview();
    markDirty("Hero media path prepared. Upload the same file to the repository.");
  });
}

function useCredentialImagePath(index) {
  const input = document.querySelector(`[data-credential-file="${index}"]`);
  useLocalFileForPath("credentials", input, (_, path) => {
    state.draftContent.credentials[index].image = path;
    markDirty("Credential image path prepared.");
    renderCredentials();
    renderValidation();
  });
}

function useReelItemAssetPath(reelId, itemId, kind) {
  const selector = kind === "thumb" ? `[data-item-thumb="${reelId}:${itemId}"]` : `[data-item-source="${reelId}:${itemId}"]`;
  const input = document.querySelector(selector);
  useLocalFileForPath("reels", input, (file, path) => {
    const reel = state.draftContent.reels.find((entry) => entry.id === reelId);
    const item = reel?.items.find((entry) => entry.id === itemId);
    if (!item) {
      setStatus("Target reel item not found.", "error");
      return;
    }
    if (kind === "thumb") {
      item.thumb = path;
    } else {
      item.src = path;
      item.type = typeFromMime(file.type);
      if (!item.thumb) item.thumb = path;
    }
    markDirty("Reel item media path prepared.");
    renderReels();
    renderValidation();
  });
}

function syncStaticTransforms() {
  state.draftContent.hero.specs = document.getElementById("heroSpecsInput").value
    .split(/\n|,/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function encodeUtf8Base64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

async function publishContent() {
  syncStaticTransforms();
  const issues = validateContent(state.draftContent);
  renderValidation();
  if (issues.length) {
    setStatus("Fix validation errors before publishing.", "error");
    return;
  }
  if (!state.githubToken) {
    setStatus("Enter a GitHub token before publishing.", "warning");
    return;
  }
  if (!state.repo.owner || !state.repo.name) {
    setStatus("Could not infer the target repository from the current Pages URL.", "error");
    return;
  }

  try {
    const commitMessage = `Publish portfolio content (${new Date().toISOString()})`;
    const contentBase64 = encodeUtf8Base64(`${JSON.stringify(state.draftContent, null, 2)}\n`);
    setStatus("Triggering the GitHub Actions publish workflow...", "info");

    const response = await githubApi(
      `/repos/${state.repo.owner}/${state.repo.name}/actions/workflows/${encodeURIComponent(state.workflowId)}/dispatches`,
      {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          ref: state.repo.branch,
          inputs: {
            content_base64: contentBase64,
            commit_message: commitMessage
          }
        })
      },
      true
    );

    if (response.status !== 204) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.message || "Failed to trigger workflow_dispatch.");
    }

    state.draftMeta.lastPublishRequestedAt = new Date().toISOString();
    saveDraftToStorage();
    renderStatus();
    setStatus("Publish workflow queued on GitHub. Wait for Actions to finish, then refresh this page to confirm the new SHA.", "success");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Publish failed.", "error");
  }
}

function handleClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const { action } = button.dataset;

  if (action === "remove-reel") {
    state.draftContent.reels.splice(Number(button.dataset.reelIndex), 1);
    markDirty("Removed reel from draft.");
    renderReels();
    renderValidation();
    return;
  }
  if (action === "add-item") {
    const reel = state.draftContent.reels[Number(button.dataset.reelIndex)];
    reel.items.push({
      id: createId(),
      type: "image",
      title: { en: "New Item", ar: "عنصر جديد" },
      description: { en: "", ar: "" },
      src: "",
      thumb: ""
    });
    markDirty("Added a reel item.");
    renderReels();
    renderValidation();
    return;
  }
  if (action === "remove-item") {
    const reel = state.draftContent.reels[Number(button.dataset.reelIndex)];
    reel.items.splice(Number(button.dataset.itemIndex), 1);
    markDirty("Removed a reel item.");
    renderReels();
    renderValidation();
    return;
  }
  if (action === "remove-credential") {
    state.draftContent.credentials.splice(Number(button.dataset.index), 1);
    markDirty("Removed a credential.");
    renderCredentials();
    renderValidation();
    return;
  }
  if (action === "remove-contact") {
    state.draftContent.contacts.splice(Number(button.dataset.index), 1);
    markDirty("Removed a contact.");
    renderContacts();
    renderValidation();
    return;
  }
  if (action === "remove-queued-file") {
    state.uploadQueues[button.dataset.reelId].splice(Number(button.dataset.index), 1);
    renderReels();
    renderStatus();
    return;
  }
  if (action === "add-queued-files") return addQueuedFilesToDraft(button.dataset.reelId);
  if (action === "use-credential-image") return useCredentialImagePath(Number(button.dataset.index));
  if (action === "use-item-source") return useReelItemAssetPath(button.dataset.reelId, button.dataset.itemId, "source");
  if (action === "use-item-thumb") return useReelItemAssetPath(button.dataset.reelId, button.dataset.itemId, "thumb");
}

function handleInput(event) {
  const node = event.target;
  if (!(node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement)) return;

  if (node.id === "heroMediaType") {
    state.draftContent.hero.mediaType = node.value;
    renderHeroPreview();
    markDirty("Updated hero media type.");
    return;
  }

  if (node.dataset.path) {
    updatePathFromInput(node);
  }
}

function handleChange(event) {
  const node = event.target;
  if (!(node instanceof HTMLInputElement)) return;
  if (node.dataset.action === "queue-files") {
    queueFilesForReel(node.dataset.reelId, Array.from(node.files || []));
    node.value = "";
  }
}

function bindStaticButtons() {
  document.getElementById("restoreDraft").addEventListener("click", restoreDraft);
  document.getElementById("discardDraft").addEventListener("click", discardRecoveredDraft);
  document.getElementById("addReel").addEventListener("click", () => {
    state.draftContent.reels.push(createEmptyReel());
    markDirty("Added a reel.");
    renderReels();
    renderValidation();
  });
  document.getElementById("addCredential").addEventListener("click", () => {
    state.draftContent.credentials.push(createEmptyCredential());
    markDirty("Added a credential.");
    renderCredentials();
    renderValidation();
  });
  document.getElementById("addContact").addEventListener("click", () => {
    state.draftContent.contacts.push(createEmptyContact());
    markDirty("Added a contact.");
    renderContacts();
    renderValidation();
  });
  elements.connectBtn.addEventListener("click", rememberGitHubToken);
  elements.saveDraft.addEventListener("click", saveDraft);
  elements.publish.addEventListener("click", publishContent);
  elements.refresh.addEventListener("click", async () => {
    await loadPublishedContent();
    await refreshPublishedSha();
  });
  document.getElementById("useBrandLogoPath").addEventListener("click", useBrandLogoPath);
  document.getElementById("useHeroMediaPath").addEventListener("click", useHeroMediaPath);
}

function init() {
  elements.githubTokenInput.value = state.githubToken;
  bindStaticButtons();
  document.addEventListener("click", handleClick);
  document.addEventListener("input", handleInput);
  document.addEventListener("change", handleChange);
  window.addEventListener("scroll", () => {
    elements.topBar.classList.toggle("scrolled", window.scrollY > 24);
  }, { passive: true });

  setTheme(state.theme);
  setLanguage(state.lang);
  loadPublishedContent().then(() => refreshPublishedSha());
}

elements.langToggle.addEventListener("click", () => setLanguage(state.lang === "en" ? "ar" : "en"));
elements.themeToggle.addEventListener("click", () => setTheme(state.theme === "dark" ? "light" : "dark"));

init();
