const STORAGE_LANG = 'chronell.landing.lang'
const DEFAULT_LANG = 'de'
const RELEASE_MANIFEST = 'release/latest.json'
const STABLE_DOWNLOAD = 'release/latest/Chronell-setup.exe'

let strings = {}
let currentLang = DEFAULT_LANG
let releaseManifest = null
let releaseDownloadHref = STABLE_DOWNLOAD

function detectLang() {
  const stored = localStorage.getItem(STORAGE_LANG)
  if (stored === 'de' || stored === 'en') return stored
  const nav = navigator.language || ''
  return nav.startsWith('de') ? 'de' : 'en'
}

function get(obj, path) {
  return path.split('.').reduce((acc, key) => (acc && acc[key] != null ? acc[key] : null), obj)
}

function applyTranslations() {
  document.documentElement.lang = currentLang
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n')
    const value = get(strings, key)
    if (value == null) return
    if (el.tagName === 'META' && el.getAttribute('name') === 'description') {
      el.setAttribute('content', value)
    } else if (el.hasAttribute('data-i18n-placeholder')) {
      el.setAttribute('placeholder', value)
    } else {
      el.textContent = value
    }
  })
  const title = get(strings, 'meta.title')
  if (title) document.title = title
  document.querySelectorAll('.lang-toggle button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === currentLang)
  })
  if (releaseManifest) {
    applyDownloadMeta(releaseManifest, releaseDownloadHref)
  }
}

async function loadLang(lang) {
  const res = await fetch(`i18n/${lang}.json`)
  if (!res.ok) throw new Error(`i18n load failed: ${lang}`)
  strings = await res.json()
  currentLang = lang
  localStorage.setItem(STORAGE_LANG, lang)
  applyTranslations()
}

function setupLangToggle() {
  document.querySelectorAll('.lang-toggle button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang
      if (lang && lang !== currentLang) void loadLang(lang)
    })
  })
}

function setupMobileNav() {
  const toggle = document.querySelector('.nav-toggle')
  const mobile = document.querySelector('.nav-mobile')
  if (!toggle || !mobile) return
  toggle.addEventListener('click', () => {
    const open = mobile.classList.toggle('open')
    toggle.setAttribute('aria-expanded', String(open))
  })
  mobile.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      mobile.classList.remove('open')
      toggle.setAttribute('aria-expanded', 'false')
    })
  })
}

function setupReveal() {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const els = document.querySelectorAll('.reveal')
  if (prefersReduced) {
    els.forEach((el) => el.classList.add('visible'))
    return
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible')
          observer.unobserve(entry.target)
        }
      })
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
  )
  els.forEach((el) => observer.observe(el))
}

function formatVersionLabel(manifest) {
  const tpl = get(strings, 'download.versionLabel')
  if (!tpl || !manifest?.version) return manifest?.version ?? ''
  return tpl.replace('{version}', manifest.version)
}

function applyDownloadMeta(manifest, href) {
  document.querySelectorAll('[data-download]').forEach((el) => {
    el.setAttribute('href', href)
    el.setAttribute('download', manifest?.filename || '')
  })

  const versionEl = document.querySelector('[data-download-version]')
  if (versionEl && manifest?.version) {
    versionEl.textContent = formatVersionLabel(manifest)
    versionEl.hidden = false
  }

  const noteEl = document.querySelector('[data-download-note]')
  if (noteEl) {
    const key = manifest?.beta ? 'download.betaNote' : 'download.note'
    const text = get(strings, key)
    if (text) noteEl.textContent = text
  }
}

async function setupDownloadLinks() {
  const fallbackHref = STABLE_DOWNLOAD
  let manifest = null

  try {
    const res = await fetch(RELEASE_MANIFEST, { cache: 'no-store' })
    if (res.ok) manifest = await res.json()
  } catch {
    /* manifest optional */
  }

  const href = manifest?.stableUrl || manifest?.versionedUrl || fallbackHref
  releaseManifest = manifest
  releaseDownloadHref = href
  applyDownloadMeta(manifest, href)
}

async function init() {
  currentLang = detectLang()
  setupLangToggle()
  setupMobileNav()
  try {
    await loadLang(currentLang)
  } catch (e) {
    console.warn('[Chronell landing]', e)
    if (currentLang !== 'en') await loadLang('en')
  }
  await setupDownloadLinks()
  setupReveal()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  void init()
}
