import {
  CONTENT_URL,
  DRAFT_CONTENT_KEY,
  DRAFT_META_KEY,
  THEME_KEY,
  LANG_KEY,
  ADMIN_SECRET_KEY,
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
  resolveApiBase,
  escapeHtml,
  escapeAttr
} from "../shared/content-utils.js";

const state = {
  publishedContent: normalizeContent(defaultData),
  publishedSha: "",
  draftContent: normalizeContent(defaultData),
  draftMeta: createDraftMeta(""),
  recoveredDraft: null,
  recoveredMeta: null,
  lang: localStorage.getItem(LANG_KEY) || "en",
  theme: localStorage.getItem(THEME_KEY) || "dark",
  adminSecret: sessionStorage.getItem(ADMIN_SECRET_KEY) || "",
  uploadQueues: {},
  status: { tone: "muted", text: "Loading published content..." },
  uploadState: {},
  lastPublishCommit: ""
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
  secretInput: document.getElementById("secretInput"),
  connectBtn: document.getElementById("connectSecret"),
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

function t(value) {
  return textFor(value, state.lang);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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

function apiUrl(path) {
  const base = resolveApiBase();
  return `${base}${path}`;
}

async function apiFetch(path, init = {}) {
  const headers = new Headers(init.headers || {});
  if (state.adminSecret) headers.set("x-admin-secret", state.adminSecret);
  return fetch(apiUrl(path), { ...init, headers });
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

function renderStatus() {
  const diffCount = countDifferences(state.publishedContent, state.draftContent);
  const draftDirty = state.draftMeta.dirty || diffCount > 0;
  const queuedUploads = pendingUploadCount();
  const publishedAt = state.draftMeta.lastPublishedAt || "Never";

  elements.chipDraft.textContent = draftDirty
    ? (state.lang === "ar" ? "مسودة" : "Draft")
    : (state.lang === "ar" ? "متزامن" : "Synced");
  elements.chipDraft.dataset.active = draftDirty ? "true" : "false";

  elements.chipUpload.textContent = queuedUploads
    ? `${state.lang === "ar" ? "قيد الانتظار" : "Queued"} ${queuedUploads}`
    : (state.lang === "ar" ? "لا توجد ملفات معلقة" : "No pending uploads");
  elements.chipUpload.dataset.active = queuedUploads ? "true" : "false";

  elements.chipPublish.textContent = state.lastPublishCommit
    ? `${state.lang === "ar" ? "منشور" : "Published"} ${state.lastPublishCommit.slice(0, 7)}`
    : (state.lang === "ar" ? "غير منشور" : "Not published");
  elements.chipPublish.dataset.active = state.lastPublishCommit ? "true" : "false";

  elements.summaryContent.innerHTML = `
    <strong>${state.lang === "ar" ? "ملخص الحالة" : "Status Summary"}</strong>
    <span>${state.lang === "ar" ? "التغييرات مقارنة بالمنشور:" : "Differences vs published:"} ${diffCount}</span>
    <span>${state.lang === "ar" ? "آخر تحديث للمسودة:" : "Draft updated:"} ${new Date(state.draftMeta.updatedAt).toLocaleString()}</span>
    <span>${state.lang === "ar" ? "آخر نشر:" : "Last published:"} ${publishedAt === "Never" ? publishedAt : new Date(publishedAt).toLocaleString()}</span>
  `;

  elements.publishMeta.textContent = state.publishedSha
    ? `content.json @ ${state.publishedSha.slice(0, 7)}`
    : "content.json sha unavailable";
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
  elements.brandLogoPreview.src = state.draftContent.brand.logo;
  renderHeroPreview();
}

function renderHeroPreview() {
  const media = state.draftContent.hero.mediaType === "video"
    ? `<video src="${state.draftContent.hero.mediaUrl}" controls muted playsinline></video>`
    : `<img src="${state.draftContent.hero.mediaUrl}" alt="${state.draftContent.hero.name}">`;
  elements.heroMediaPreview.innerHTML = media;
}

function reelQueueMarkup(reelId) {
  const queue = state.uploadQueues[reelId] || [];
  if (!queue.length) {
    return `<p class="hint">${state.lang === "ar" ? "لا توجد ملفات في طابور الرفع." : "No queued files."}</p>`;
  }
  return `
    <ul class="queue-list">
      ${queue.map((file, index) => `<li>${file.name}<button type="button" data-action="remove-queued-file" data-reel-id="${reelId}" data-index="${index}">Remove</button></li>`).join("")}
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
          <strong>${state.lang === "ar" ? "رفع متعدد لهذا المعرض" : "Multi-file upload for this reel"}</strong>
          <p>${state.lang === "ar" ? "اختر صورًا أو فيديوهات ثم ارفعها إلى GitHub." : "Select images or videos, then upload them to GitHub."}</p>
        </div>
        <input type="file" multiple data-action="queue-files" data-reel-id="${reel.id}" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime">
        ${reelQueueMarkup(reel.id)}
        <button type="button" data-action="upload-queue" data-reel-id="${reel.id}">${state.lang === "ar" ? "رفع الملفات المعلقة" : "Upload queued files"}</button>
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
        <label><span>${state.lang === "ar" ? "ملف المصدر" : "Source file"}</span><input type="file" data-item-source="${reel.id}:${item.id}" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"></label>
        <button type="button" data-action="upload-item-source" data-reel-id="${reel.id}" data-item-id="${item.id}">${state.lang === "ar" ? "رفع المصدر" : "Upload source"}</button>
        <label><span>${state.lang === "ar" ? "صورة مصغرة" : "Thumbnail file"}</span><input type="file" data-item-thumb="${reel.id}:${item.id}" accept="image/jpeg,image/png,image/webp"></label>
        <button type="button" data-action="upload-item-thumb" data-reel-id="${reel.id}" data-item-id="${item.id}">${state.lang === "ar" ? "رفع المصغرة" : "Upload thumb"}</button>
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
        <label><span>${state.lang === "ar" ? "ملف الصورة" : "Image file"}</span><input type="file" data-credential-file="${index}" accept="image/jpeg,image/png,image/webp"></label>
        <button type="button" data-action="upload-credential-image" data-index="${index}">${state.lang === "ar" ? "رفع الصورة" : "Upload image"}</button>
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
    ? issues.map((issue) => `<li>${issue}</li>`).join("")
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
    elements.brandLogoPreview.src = node.value;
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

async function refreshPublishedSha() {
  if (!state.adminSecret) {
    setStatus("Enter the admin secret to query the GitHub-backed API.", "warning");
    return;
  }
  try {
    const response = await apiFetch("/api/content-state");
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error || "Unable to fetch metadata.");
    state.publishedSha = payload.sha || "";
    state.draftMeta.basedOnPublishedSha = state.publishedSha;
    renderStatus();
    setStatus("Connected to the serverless GitHub proxy.", "success");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Unable to connect to the serverless API.", "error");
  }
}

function rememberSecret() {
  state.adminSecret = elements.secretInput.value.trim();
  sessionStorage.setItem(ADMIN_SECRET_KEY, state.adminSecret);
  refreshPublishedSha();
}

function saveDraft() {
  saveDraftToStorage();
  setStatus("Draft saved locally.", "success");
}

async function uploadFiles(targetFolder, files, reelId = "") {
  if (!state.adminSecret) {
    throw new Error("Enter the admin secret before uploading.");
  }
  if (!files.length) {
    throw new Error("No files selected.");
  }
  const formData = new FormData();
  formData.set("targetFolder", targetFolder);
  if (reelId) formData.set("reelId", reelId);
  files.forEach((file) => formData.append("files", file, file.name));

  const response = await apiFetch("/api/upload-media", {
    method: "POST",
    body: formData
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Upload failed.");
  }
  return payload.files;
}

async function uploadBrandLogo() {
  const file = elements.brandLogoFile.files[0];
  if (!file) return setStatus("Choose a logo file first.", "warning");
  const issue = validateUploadFile(file);
  if (issue) return setStatus(issue, "error");
  try {
    setStatus(`Uploading ${file.name}...`, "info");
    const [uploaded] = await uploadFiles("brand", [file]);
    state.draftContent.brand.logo = uploaded.storedPath;
    elements.brandLogoPreview.src = uploaded.storedPath;
    markDirty("Brand logo uploaded. Publish to update the live site.");
    elements.brandLogoFile.value = "";
  } catch (error) {
    console.error(error);
    setStatus(error.message, "error");
  }
}

async function uploadHeroMedia() {
  const file = elements.heroMediaFile.files[0];
  if (!file) return setStatus("Choose a hero media file first.", "warning");
  const issue = validateUploadFile(file);
  if (issue) return setStatus(issue, "error");
  try {
    setStatus(`Uploading ${file.name}...`, "info");
    const [uploaded] = await uploadFiles("hero", [file]);
    state.draftContent.hero.mediaUrl = uploaded.storedPath;
    state.draftContent.hero.mediaType = uploaded.type;
    document.getElementById("heroMediaUrl").value = uploaded.storedPath;
    document.getElementById("heroMediaType").value = uploaded.type;
    renderHeroPreview();
    markDirty("Hero media uploaded. Publish to make it live.");
    elements.heroMediaFile.value = "";
  } catch (error) {
    console.error(error);
    setStatus(error.message, "error");
  }
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

async function uploadQueuedFiles(reelId) {
  const queue = state.uploadQueues[reelId] || [];
  if (!queue.length) {
    return setStatus("No queued files to upload.", "warning");
  }
  try {
    setStatus(`Uploading ${queue.length} file(s)...`, "info");
    const uploaded = await uploadFiles("reels", queue, reelId);
    const reel = state.draftContent.reels.find((entry) => entry.id === reelId);
    uploaded.forEach((file) => {
      const base = fileStem(file.originalName);
      reel.items.push({
        id: createId(),
        type: file.type,
        title: { en: base, ar: base },
        description: { en: "", ar: "" },
        src: file.storedPath,
        thumb: file.type === "image" ? file.storedPath : file.storedPath
      });
    });
    state.uploadQueues[reelId] = [];
    markDirty("Uploaded files were added to the reel draft.");
    renderReels();
    renderValidation();
  } catch (error) {
    console.error(error);
    setStatus(error.message, "error");
  }
}

async function uploadCredentialImage(index) {
  const input = document.querySelector(`[data-credential-file="${index}"]`);
  const file = input?.files?.[0];
  if (!file) return setStatus("Choose a credential image first.", "warning");
  const issue = validateUploadFile(file);
  if (issue) return setStatus(issue, "error");
  try {
    const [uploaded] = await uploadFiles("credentials", [file]);
    state.draftContent.credentials[index].image = uploaded.storedPath;
    markDirty("Credential image uploaded.");
    renderCredentials();
  } catch (error) {
    console.error(error);
    setStatus(error.message, "error");
  }
}

async function uploadReelItemAsset(reelId, itemId, kind) {
  const selector = kind === "thumb" ? `[data-item-thumb="${reelId}:${itemId}"]` : `[data-item-source="${reelId}:${itemId}"]`;
  const input = document.querySelector(selector);
  const file = input?.files?.[0];
  if (!file) return setStatus("Choose a file first.", "warning");
  const issue = validateUploadFile(file);
  if (issue) return setStatus(issue, "error");

  try {
    const [uploaded] = await uploadFiles("reels", [file], reelId);
    const reel = state.draftContent.reels.find((entry) => entry.id === reelId);
    const item = reel?.items.find((entry) => entry.id === itemId);
    if (!item) throw new Error("Target reel item not found.");

    if (kind === "thumb") {
      item.thumb = uploaded.storedPath;
    } else {
      item.src = uploaded.storedPath;
      item.type = uploaded.type;
      if (!item.thumb) item.thumb = uploaded.storedPath;
    }
    markDirty("Reel item media uploaded.");
    renderReels();
  } catch (error) {
    console.error(error);
    setStatus(error.message, "error");
  }
}

function syncStaticTransforms() {
  state.draftContent.hero.specs = document.getElementById("heroSpecsInput").value
    .split(/\n|,/)
    .map((value) => value.trim())
    .filter(Boolean);
}

async function publishContent() {
  syncStaticTransforms();
  const issues = validateContent(state.draftContent);
  renderValidation();
  if (issues.length) {
    return setStatus("Fix validation errors before publishing.", "error");
  }
  if (!state.adminSecret) {
    return setStatus("Enter the admin secret before publishing.", "warning");
  }
  try {
    setStatus("Publishing content to GitHub...", "info");
    const response = await apiFetch("/api/save-content", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        content: state.draftContent,
        message: "Publish portfolio content"
      })
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "Publish failed.");
    }

    state.publishedContent = normalizeContent(state.draftContent);
    state.publishedSha = payload.contentSha || state.publishedSha;
    state.lastPublishCommit = payload.commitSha || "";
    state.draftMeta = {
      ...createDraftMeta(state.publishedSha),
      basedOnPublishedSha: state.publishedSha,
      dirty: false,
      lastPublishedAt: new Date().toISOString()
    };
    saveDraftToStorage();
    renderAll();
    setStatus("Published content.json to GitHub successfully.", "success");
  } catch (error) {
    console.error(error);
    setStatus(error.message, "error");
  }
}

function handleClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const { action } = button.dataset;

  if (action === "restore-draft") return restoreDraft();
  if (action === "discard-draft") return discardRecoveredDraft();
  if (action === "remove-reel") {
    state.draftContent.reels.splice(Number(button.dataset.reelIndex), 1);
    markDirty("Removed reel from draft.");
    renderReels();
    return renderValidation();
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
    return renderValidation();
  }
  if (action === "remove-item") {
    const reel = state.draftContent.reels[Number(button.dataset.reelIndex)];
    reel.items.splice(Number(button.dataset.itemIndex), 1);
    markDirty("Removed a reel item.");
    renderReels();
    return renderValidation();
  }
  if (action === "remove-credential") {
    state.draftContent.credentials.splice(Number(button.dataset.index), 1);
    markDirty("Removed a credential.");
    renderCredentials();
    return renderValidation();
  }
  if (action === "remove-contact") {
    state.draftContent.contacts.splice(Number(button.dataset.index), 1);
    markDirty("Removed a contact.");
    renderContacts();
    return renderValidation();
  }
  if (action === "remove-queued-file") {
    state.uploadQueues[button.dataset.reelId].splice(Number(button.dataset.index), 1);
    renderReels();
    return renderStatus();
  }
  if (action === "upload-queue") return uploadQueuedFiles(button.dataset.reelId);
  if (action === "upload-credential-image") return uploadCredentialImage(Number(button.dataset.index));
  if (action === "upload-item-source") return uploadReelItemAsset(button.dataset.reelId, button.dataset.itemId, "source");
  if (action === "upload-item-thumb") return uploadReelItemAsset(button.dataset.reelId, button.dataset.itemId, "thumb");
}

function handleInput(event) {
  const node = event.target;
  if (!(node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement)) return;

  if (node.id === "heroMediaType") {
    state.draftContent.hero.mediaType = node.value;
    renderHeroPreview();
    return markDirty("Updated hero media type.");
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
  elements.connectBtn.addEventListener("click", rememberSecret);
  elements.saveDraft.addEventListener("click", saveDraft);
  elements.publish.addEventListener("click", publishContent);
  elements.refresh.addEventListener("click", async () => {
    await loadPublishedContent();
    if (state.adminSecret) await refreshPublishedSha();
  });
  document.getElementById("uploadBrandLogo").addEventListener("click", uploadBrandLogo);
  document.getElementById("uploadHeroMedia").addEventListener("click", uploadHeroMedia);
}

function init() {
  elements.secretInput.value = state.adminSecret;
  bindStaticButtons();
  document.addEventListener("click", handleClick);
  document.addEventListener("input", handleInput);
  document.addEventListener("change", handleChange);
  window.addEventListener("scroll", () => {
    elements.topBar.classList.toggle("scrolled", window.scrollY > 24);
  }, { passive: true });

  setTheme(state.theme);
  setLanguage(state.lang);
  loadPublishedContent().then(() => {
    if (state.adminSecret) refreshPublishedSha();
  });
}

elements.langToggle.addEventListener("click", () => setLanguage(state.lang === "en" ? "ar" : "en"));
elements.themeToggle.addEventListener("click", () => setTheme(state.theme === "dark" ? "light" : "dark"));

init();
