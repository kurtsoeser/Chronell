const STORAGE_LANG = 'chronell.landing.lang'
const DEFAULT_LANG = 'de'
const RELEASE_MANIFEST = 'release/latest.json'
const RELEASE_VERSIONS = 'release/versions.json'
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
    if (manifest?.filename) {
      el.setAttribute('download', manifest.filename)
    } else {
      el.removeAttribute('download')
    }
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

function versionedSetupPath(version) {
  return `release/${version}/Chronell-${version}-setup.exe`
}

/** @param {string} url relative to site root */
async function releaseAssetExists(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', cache: 'no-store' })
    return res.ok
  } catch {
    return false
  }
}

function collectDownloadCandidates(manifest, versionsIndex) {
  const seen = new Set()
  const list = []

  function add(url) {
    if (!url || seen.has(url)) return
    seen.add(url)
    list.push(url)
  }

  if (manifest?.stableUrl) add(manifest.stableUrl)
  if (manifest?.versionedUrl) add(manifest.versionedUrl)
  if (manifest?.version) add(versionedSetupPath(manifest.version))

  if (versionsIndex?.latest) {
    add(versionedSetupPath(versionsIndex.latest))
    add(versionsIndex.stableUrl)
  }

  const entries = versionsIndex?.versions
  if (Array.isArray(entries)) {
    for (const entry of entries) {
      if (typeof entry === 'string') {
        add(versionedSetupPath(entry))
        continue
      }
      if (entry?.setupUrl) add(entry.setupUrl)
      if (entry?.version) add(versionedSetupPath(entry.version))
    }
  }

  add(STABLE_DOWNLOAD)
  return list
}

async function resolveDownloadHref(manifest, versionsIndex) {
  const candidates = collectDownloadCandidates(manifest, versionsIndex)
  for (const url of candidates) {
    if (await releaseAssetExists(url)) {
      return { href: url, manifest: manifest ?? { version: versionsIndex?.latest } }
    }
  }
  return { href: STABLE_DOWNLOAD, manifest }
}

async function loadVersionsIndex() {
  try {
    const res = await fetch(RELEASE_VERSIONS, { cache: 'no-store' })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function loadReleaseManifest() {
  try {
    const res = await fetch(RELEASE_MANIFEST, { cache: 'no-store' })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function setupDownloadLinks() {
  const [manifest, versionsIndex] = await Promise.all([loadReleaseManifest(), loadVersionsIndex()])

  const resolved = await resolveDownloadHref(manifest, versionsIndex)
  const href = resolved.href

  const effectiveManifest =
    manifest ??
    (versionsIndex?.latest
      ? {
          version: versionsIndex.latest,
          beta: versionsIndex.beta ?? true,
          filename: 'Chronell-setup.exe'
        }
      : null)

  if (effectiveManifest && !effectiveManifest.version && versionsIndex?.latest) {
    effectiveManifest.version = versionsIndex.latest
  }

  releaseManifest = effectiveManifest
  releaseDownloadHref = href
  applyDownloadMeta(effectiveManifest, href)
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
