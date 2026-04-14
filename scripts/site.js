import {
  CONTENT_URL,
  THEME_KEY,
  LANG_KEY,
  defaultData,
  normalizeContent,
  textFor,
  escapeHtml,
  escapeAttr
} from "../shared/content-utils.js";

const state = {
  data: normalizeContent(defaultData),
  lang: localStorage.getItem(LANG_KEY) || "en",
  theme: localStorage.getItem(THEME_KEY) || "dark"
};

const elements = {
  topBar: document.getElementById("topBar"),
  langToggle: document.getElementById("langToggle"),
  themeToggle: document.getElementById("themeToggle"),
  brandLogo: document.getElementById("brandLogo"),
  brandMark: document.getElementById("brandMark"),
  heroRole: document.getElementById("heroRole"),
  heroName: document.getElementById("heroName"),
  heroSummary: document.getElementById("heroSummary"),
  heroSubtitle: document.getElementById("heroSubtitle"),
  heroSpecs: document.getElementById("heroSpecs"),
  heroMediaWrap: document.getElementById("heroMediaWrap"),
  portfolioTitle: document.getElementById("portfolioTitle"),
  portfolioDesc: document.getElementById("portfolioDesc"),
  reelsContainer: document.getElementById("reelsContainer"),
  credentialsTitle: document.getElementById("credentialsTitle"),
  credentialsList: document.getElementById("credentialsList"),
  contactTitle: document.getElementById("contactTitle"),
  contactLinks: document.getElementById("contactLinks"),
  ctaPortfolio: document.getElementById("ctaPortfolio"),
  ctaBook: document.getElementById("ctaBook"),
  copyright: document.getElementById("copyright"),
  loadState: document.getElementById("loadState"),
  lightbox: document.getElementById("lightbox"),
  lightboxContent: document.getElementById("lightbox-content"),
  lbTitle: document.getElementById("lbTitle"),
  lbDesc: document.getElementById("lbDesc")
};

function t(value) {
  return textFor(value, state.lang);
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
  render();
}

function renderHeroMedia() {
  const media = state.data.hero.mediaType === "video"
    ? `<video src="${escapeAttr(state.data.hero.mediaUrl)}" autoplay muted loop playsinline></video>`
    : `<img src="${escapeAttr(state.data.hero.mediaUrl)}" alt="${escapeAttr(state.data.hero.name)}">`;

  elements.heroMediaWrap.innerHTML = `
    ${media}
    <div class="hud hud-tl"><div class="rec-dot"></div><span>REC</span></div>
    <div class="hud hud-tr"><span id="timecode">00:00:00:00</span></div>
    <div class="hud hud-bl"><span>ISO 800</span></div>
    <div class="hud hud-br"><span>5600K</span></div>
    <div class="crosshair"></div>
  `;
}

function renderReels() {
  const reels = Array.isArray(state.data.reels) ? state.data.reels : [];
  if (!reels.length) {
    elements.reelsContainer.innerHTML = `<div class="empty-card">${state.lang === "ar" ? "لا توجد أعمال منشورة بعد." : "No published reel items yet."}</div>`;
    return;
  }

  elements.reelsContainer.innerHTML = reels.map((reel) => {
    const items = reel.items || [];
    const repeated = items.length > 1 ? [...items, ...items] : items;
    const duration = Math.max(16, items.length * 6);
    return `
      <article class="reel-block">
        <div class="reel-head">
          <div>
            <h3 class="reel-title">${escapeHtml(t(reel.title))}</h3>
            <p class="reel-desc">${escapeHtml(t(reel.description))}</p>
          </div>
        </div>
        ${
          items.length
            ? `<div class="film-strip"><div class="reel-track" style="animation-duration:${duration}s">${repeated.map((item) => renderFrame(reel.id, item)).join("")}</div></div>`
            : `<div class="empty-card">${state.lang === "ar" ? "هذا المعرض فارغ حاليًا." : "This reel is empty right now."}</div>`
        }
      </article>
    `;
  }).join("");
}

function renderFrame(reelId, item) {
  const click = `openLightbox('${escapeAttr(reelId)}','${escapeAttr(item.id)}')`;
  return `
    <button class="frame" type="button" onclick="${click}">
      ${
        item.type === "video"
          ? `<video ${item.thumb ? `poster="${escapeAttr(item.thumb)}"` : ""} muted playsinline><source src="${escapeAttr(item.src)}"></video>`
          : `<img src="${escapeAttr(item.thumb || item.src)}" alt="${escapeAttr(t(item.title))}">`
      }
      <span class="media-type">${item.type === "video" ? "VIDEO" : "IMAGE"}</span>
      <span class="frame-caption"><strong>${escapeHtml(t(item.title) || "Untitled")}</strong><span>${escapeHtml(t(item.description) || "")}</span></span>
    </button>
  `;
}

function renderCredentials() {
  const items = Array.isArray(state.data.credentials) ? state.data.credentials : [];
  if (!items.length) {
    elements.credentialsList.innerHTML = `<li class="empty-row">${state.lang === "ar" ? "لا توجد اعتمادات بعد." : "No credentials added yet."}</li>`;
    return;
  }

  elements.credentialsList.innerHTML = items.map((item) => `
    <li>
      <span class="cred-title${item.image ? " has-image" : ""}" ${item.image ? `onclick="openCredentialImage('${escapeAttr(item.image)}','${escapeAttr(t(item.title))}')"` : ""}>
        ${escapeHtml(t(item.title))}
      </span>
      <span class="cred-year">${escapeHtml(item.year)}</span>
    </li>
  `).join("");
}

function renderContacts() {
  const items = Array.isArray(state.data.contacts) ? state.data.contacts : [];
  if (!items.length) {
    elements.contactLinks.innerHTML = `<p class="empty-card">${state.lang === "ar" ? "لا توجد وسائل تواصل بعد." : "No contact entries yet."}</p>`;
    return;
  }

  elements.contactLinks.innerHTML = items.map((item) => `
    <a href="${escapeAttr(item.href || "#")}" target="_blank" rel="noopener noreferrer">
      <span>${escapeHtml(t(item.label))}</span>
      <span>→ ${escapeHtml(item.value)}</span>
    </a>
  `).join("");
}

function render() {
  document.title = `${state.data.hero.name} | ${t(state.data.hero.role)}`;
  elements.brandLogo.src = state.data.brand.logo;
  elements.brandMark.textContent = state.data.brand.mark;
  elements.heroRole.textContent = t(state.data.hero.role);
  elements.heroName.textContent = state.data.hero.name;
  elements.heroSummary.textContent = t(state.data.hero.summary);
  elements.heroSubtitle.textContent = t(state.data.hero.subtitle);
  elements.heroSpecs.innerHTML = (state.data.hero.specs || []).map((spec) => `<span>${escapeHtml(spec)}</span>`).join("");
  elements.portfolioTitle.textContent = t(state.data.portfolio.title);
  elements.portfolioDesc.textContent = t(state.data.portfolio.description);
  elements.credentialsTitle.textContent = t(state.data.credentialsTitle);
  elements.contactTitle.textContent = t(state.data.contactTitle);
  elements.ctaPortfolio.textContent = t(state.data.cta.portfolio);
  elements.ctaBook.textContent = t(state.data.cta.book);
  elements.copyright.textContent = `© ${new Date().getFullYear()} ${state.data.hero.name} — All Rights Reserved`;

  renderHeroMedia();
  renderReels();
  renderCredentials();
  renderContacts();
  updateTimecode();
}

async function loadPublishedContent() {
  elements.loadState.textContent = "Loading published content...";
  try {
    const response = await fetch(CONTENT_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Unable to load ${CONTENT_URL} (${response.status}).`);
    }
    state.data = normalizeContent(await response.json());
    elements.loadState.textContent = "";
  } catch (error) {
    console.error(error);
    state.data = normalizeContent(defaultData);
    elements.loadState.textContent = "Published content could not be loaded. Showing fallback content.";
  }
  render();
}

function updateTimecode() {
  const node = document.getElementById("timecode");
  if (!node) return;
  const now = new Date();
  const parts = [now.getHours(), now.getMinutes(), now.getSeconds()].map((value) => String(value).padStart(2, "0"));
  node.textContent = `${parts.join(":")}:${String(Math.floor(Math.random() * 24)).padStart(2, "0")}`;
}

function closeLightbox(event) {
  if (event && event.target !== event.currentTarget && !event.target.classList.contains("close-lb")) return;
  elements.lightbox.classList.remove("active");
  document.body.style.overflow = "auto";
  const video = elements.lightboxContent.querySelector("video");
  if (video) video.pause();
}

function openLightbox(reelId, itemId) {
  const reel = state.data.reels.find((entry) => entry.id === reelId);
  const item = reel?.items.find((entry) => entry.id === itemId);
  if (!item) return;

  elements.lightboxContent.innerHTML = item.type === "video"
    ? `<video controls autoplay playsinline ${item.thumb ? `poster="${escapeAttr(item.thumb)}"` : ""}><source src="${escapeAttr(item.src)}"></video>`
    : `<img src="${escapeAttr(item.src)}" alt="${escapeAttr(t(item.title))}">`;

  elements.lbTitle.textContent = t(item.title);
  elements.lbDesc.textContent = t(item.description);
  elements.lightbox.classList.add("active");
  document.body.style.overflow = "hidden";
}

function openCredentialImage(src, title) {
  elements.lightboxContent.innerHTML = `<img src="${escapeAttr(src)}" alt="${escapeAttr(title)}">`;
  elements.lbTitle.textContent = title;
  elements.lbDesc.textContent = "";
  elements.lightbox.classList.add("active");
  document.body.style.overflow = "hidden";
}

window.openLightbox = openLightbox;
window.openCredentialImage = openCredentialImage;
window.closeLightbox = closeLightbox;

elements.langToggle.addEventListener("click", () => setLanguage(state.lang === "en" ? "ar" : "en"));
elements.themeToggle.addEventListener("click", () => setTheme(state.theme === "dark" ? "light" : "dark"));
window.addEventListener("scroll", () => {
  elements.topBar.classList.toggle("scrolled", window.scrollY > 80);
}, { passive: true });
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeLightbox({ target: elements.lightbox, currentTarget: elements.lightbox });
  }
});

setTheme(state.theme);
setLanguage(state.lang);
setInterval(updateTimecode, 1000 / 24);
loadPublishedContent();
