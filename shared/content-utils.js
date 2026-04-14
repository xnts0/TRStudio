export const CONTENT_VERSION = 1;
export const CONTENT_URL = "./content.json";
export const DRAFT_CONTENT_KEY = "portfolioDraftContent";
export const DRAFT_META_KEY = "portfolioDraftMeta";
export const THEME_KEY = "turkiPortfolioTheme";
export const LANG_KEY = "turkiPortfolioLang";
export const ADMIN_CONFIG = globalThis.TR_ADMIN_CONFIG || {};

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
export const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
export const ALLOWED_MEDIA_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];
export const IMAGE_MAX_SIZE = 10 * 1024 * 1024;
export const VIDEO_MAX_SIZE = 100 * 1024 * 1024;

export const defaultData = {
  brand: {
    mark: "TB VISUALS",
    logo: "assets/uploads/brand/default-logo.svg"
  },
  hero: {
    name: "TURKI",
    role: { en: "DIRECTOR OF PHOTOGRAPHY", ar: "مدير التصوير السينمائي" },
    summary: {
      en: "Capturing raw reality and transforming it into cinematic art. Specializing in high-end editorial photography and kinetic videography.",
      ar: "أحوّل المشاهد الواقعية إلى لغة بصرية سينمائية، مع تركيز على التصوير التحريري الراقي والفيديو الحركي."
    },
    subtitle: {
      en: "Commercials / Editorial / Motion / Creative Direction",
      ar: "إعلانات / تصوير تحريري / فيديو حركي / إخراج إبداعي"
    },
    mediaType: "image",
    mediaUrl: "https://images.unsplash.com/photo-1554046920-90dcac824707?w=1200&q=80&auto=format&fit=crop",
    specs: ["SONY α7S III", "24-70mm G-MASTER", "S-LOG3", "120FPS"]
  },
  portfolio: {
    title: { en: "THE REEL", ar: "المعرض" },
    description: { en: "Selected motion and still work", ar: "مختارات من أعمال الصورة والفيديو" }
  },
  cta: {
    portfolio: { en: "Access Portfolio ↓", ar: "تصفح المعرض ↓" },
    book: { en: "Book Now", ar: "احجز الآن" }
  },
  reels: [
    {
      id: createId(),
      title: { en: "Editorial Motion", ar: "سرد بصري تحريري" },
      description: {
        en: "A curated strip of visual direction, portrait work, atmosphere, and branded storytelling.",
        ar: "شريط مختار يجمع الإخراج البصري والبورتريه وبناء المزاج والسرد الإعلاني."
      },
      items: [
        {
          id: createId(),
          type: "image",
          title: { en: "Shot 1", ar: "لقطة أولى" },
          description: { en: "Editorial portrait framing", ar: "تكوين بورتريه تحريري" },
          src: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=1200&q=80&auto=format&fit=crop",
          thumb: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=700&q=80&auto=format&fit=crop"
        },
        {
          id: createId(),
          type: "video",
          title: { en: "Shot 2", ar: "لقطة ثانية" },
          description: { en: "Raw video showcase", ar: "عرض فيديو خام" },
          src: "https://www.w3schools.com/html/mov_bbb.mp4",
          thumb: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=700&q=80&auto=format&fit=crop"
        }
      ]
    }
  ],
  credentialsTitle: { en: "Credentials", ar: "الاعتمادات" },
  credentials: [
    {
      id: createId(),
      title: { en: "Sony Alpha Cinema Master", ar: "اعتماد سوني ألفا للسينما" },
      year: "2023",
      image: ""
    }
  ],
  contactTitle: { en: "Direct Line", ar: "تواصل مباشر" },
  contacts: [
    {
      id: createId(),
      label: { en: "Instagram", ar: "إنستغرام" },
      value: "@turki_visuals",
      href: "https://instagram.com"
    },
    {
      id: createId(),
      label: { en: "Email", ar: "بريد إلكتروني" },
      value: "booking@turki.com",
      href: "mailto:booking@turki.com"
    }
  ]
};

export function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

export function toLangObject(value) {
  if (isObject(value)) {
    return {
      en: typeof value.en === "string" ? value.en : "",
      ar: typeof value.ar === "string" ? value.ar : ""
    };
  }
  const text = typeof value === "string" ? value : "";
  return { en: text, ar: text };
}

export function textFor(obj, lang = "en") {
  if (!obj) return "";
  if (typeof obj === "string") return obj;
  return obj[lang] || obj.en || obj.ar || "";
}

export function escapeHtml(value = "") {
  return String(value).replace(/[&<>"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;"
  }[char]));
}

export function escapeAttr(value = "") {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

export function slugify(value = "") {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "file";
}

export function inferMediaType(value = "") {
  const lower = String(value).toLowerCase();
  if (lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mov")) {
    return "video";
  }
  return "image";
}

export function typeFromMime(mime = "") {
  return mime.startsWith("video/") ? "video" : "image";
}

export function fileStem(filename = "") {
  return String(filename).replace(/\.[^.]+$/, "") || "Untitled";
}

export function validateUploadFile(file) {
  if (!file) {
    return "Missing file.";
  }
  if (!ALLOWED_MEDIA_TYPES.includes(file.type)) {
    return `Unsupported file type: ${file.type || "unknown"}.`;
  }
  const maxSize = file.type.startsWith("video/") ? VIDEO_MAX_SIZE : IMAGE_MAX_SIZE;
  if (file.size > maxSize) {
    return `${file.name} exceeds the ${Math.round(maxSize / 1024 / 1024)}MB limit.`;
  }
  return "";
}

export function normalizeContent(raw) {
  const base = clone(defaultData);
  const src = isObject(raw) ? raw : {};

  base.brand = { ...base.brand, ...(isObject(src.brand) ? src.brand : {}) };
  base.hero = { ...base.hero, ...(isObject(src.hero) ? src.hero : {}) };
  base.hero.role = toLangObject(src?.hero?.role ?? base.hero.role);
  base.hero.summary = toLangObject(src?.hero?.summary ?? base.hero.summary);
  base.hero.subtitle = toLangObject(src?.hero?.subtitle ?? base.hero.subtitle);
  base.hero.specs = Array.isArray(src?.hero?.specs)
    ? src.hero.specs.map((item) => String(item).trim()).filter(Boolean)
    : base.hero.specs;

  base.portfolio = { ...base.portfolio, ...(isObject(src.portfolio) ? src.portfolio : {}) };
  base.portfolio.title = toLangObject(src?.portfolio?.title ?? base.portfolio.title);
  base.portfolio.description = toLangObject(src?.portfolio?.description ?? base.portfolio.description);

  base.cta = { ...base.cta, ...(isObject(src.cta) ? src.cta : {}) };
  base.cta.portfolio = toLangObject(src?.cta?.portfolio ?? base.cta.portfolio);
  base.cta.book = toLangObject(src?.cta?.book ?? base.cta.book);

  base.credentialsTitle = toLangObject(src?.credentialsTitle ?? base.credentialsTitle);
  base.contactTitle = toLangObject(src?.contactTitle ?? base.contactTitle);

  base.reels = Array.isArray(src.reels) ? src.reels.map(normalizeReel) : base.reels;
  base.credentials = Array.isArray(src.credentials)
    ? src.credentials.map(normalizeCredential)
    : base.credentials;
  base.contacts = Array.isArray(src.contacts)
    ? src.contacts.map(normalizeContact)
    : base.contacts;

  return base;
}

export function normalizeReel(reel = {}) {
  return {
    id: String(reel.id || createId()),
    title: toLangObject(reel.title),
    description: toLangObject(reel.description),
    items: Array.isArray(reel.items) ? reel.items.map(normalizeReelItem) : []
  };
}

export function normalizeReelItem(item = {}) {
  const src = String(item.src || "").trim();
  const thumb = String(item.thumb || src).trim();
  return {
    id: String(item.id || createId()),
    type: item.type === "video" ? "video" : inferMediaType(src),
    title: toLangObject(item.title),
    description: toLangObject(item.description),
    src,
    thumb
  };
}

export function normalizeCredential(item = {}) {
  return {
    id: String(item.id || createId()),
    title: toLangObject(item.title),
    year: String(item.year || ""),
    image: String(item.image || "")
  };
}

export function normalizeContact(item = {}) {
  return {
    id: String(item.id || createId()),
    label: toLangObject(item.label),
    value: String(item.value || ""),
    href: String(item.href || "")
  };
}

export function createEmptyReel() {
  return {
    id: createId(),
    title: { en: "New Reel", ar: "معرض جديد" },
    description: { en: "Describe this reel", ar: "أضف وصفًا لهذا المعرض" },
    items: []
  };
}

export function createEmptyCredential() {
  return {
    id: createId(),
    title: { en: "New Credential", ar: "اعتماد جديد" },
    year: String(new Date().getFullYear()),
    image: ""
  };
}

export function createEmptyContact() {
  return {
    id: createId(),
    label: { en: "New Contact", ar: "وسيلة تواصل جديدة" },
    value: "",
    href: ""
  };
}

export function createDraftMeta(publishedSha = "") {
  return {
    updatedAt: new Date().toISOString(),
    basedOnPublishedSha: publishedSha || "",
    dirty: false,
    version: CONTENT_VERSION,
    lastPublishedAt: "",
    lastPublishRequestedAt: ""
  };
}

export function validateContent(content) {
  const issues = [];
  const data = normalizeContent(content);

  if (!data.brand.mark.trim()) issues.push("Brand mark is required.");
  if (!data.brand.logo.trim()) issues.push("Brand logo URL is required.");
  if (!data.hero.name.trim()) issues.push("Hero name is required.");
  if (!data.hero.mediaUrl.trim()) issues.push("Hero media URL is required.");
  if (!["image", "video"].includes(data.hero.mediaType)) issues.push("Hero media type must be image or video.");

  data.reels.forEach((reel, reelIndex) => {
    if (!textFor(reel.title, "en").trim()) {
      issues.push(`Reel ${reelIndex + 1} is missing an English title.`);
    }
    reel.items.forEach((item, itemIndex) => {
      if (!item.src.trim()) {
        issues.push(`Reel ${reelIndex + 1}, item ${itemIndex + 1} is missing a source URL.`);
      }
      if (!["image", "video"].includes(item.type)) {
        issues.push(`Reel ${reelIndex + 1}, item ${itemIndex + 1} has an invalid media type.`);
      }
    });
  });

  data.contacts.forEach((contact, index) => {
    if (!textFor(contact.label, "en").trim()) {
      issues.push(`Contact ${index + 1} is missing an English label.`);
    }
    if (!contact.value.trim()) {
      issues.push(`Contact ${index + 1} is missing a value.`);
    }
  });

  return issues;
}

export function getSiteBasePath(locationLike = globalThis.location) {
  if (!locationLike) return "";
  const path = locationLike.pathname || "/";
  const parts = path.split("/").filter(Boolean);
  if (!parts.length) return "";
  if (parts.at(-1).includes(".")) parts.pop();
  return parts.length ? `/${parts.join("/")}` : "";
}
