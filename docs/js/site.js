const STORAGE_LANG = 'chronell.landing.lang'
const DEFAULT_LANG = 'de'
const RELEASE_MANIFEST = 'release/latest.json'
const RELEASE_VERSIONS = 'release/versions.json'
const GITHUB_RELEASES_PAGE = 'https://github.com/kurtsoeser/Chronell/releases/latest'
const STABLE_DOWNLOAD = GITHUB_RELEASES_PAGE

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

function setupHeroDemo() {
  const root = document.getElementById('hero-demo')
  if (!root) return

  const tabs = root.querySelectorAll('[data-demo-tab]')
  const panels = root.querySelectorAll('[data-demo-panel]')
  const captions = root.querySelectorAll('[data-demo-caption]')

  function activate(id) {
    tabs.forEach((tab) => {
      const on = tab.dataset.demoTab === id
      tab.classList.toggle('active', on)
      tab.setAttribute('aria-selected', on ? 'true' : 'false')
    })
    panels.forEach((panel) => {
      const on = panel.dataset.demoPanel === id
      panel.classList.toggle('active', on)
      panel.hidden = !on
    })
    captions.forEach((cap) => {
      const on = cap.dataset.demoCaption === id
      cap.classList.toggle('active', on)
      cap.hidden = !on
    })
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const id = tab.dataset.demoTab
      if (id) activate(id)
    })
  })

  const initial = root.querySelector('[data-demo-tab].active')?.dataset.demoTab ?? 'mail'
  activate(initial)
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
  const useSameTab = !isAbsoluteUrl(href)
  document.querySelectorAll('[data-download]').forEach((el) => {
    el.setAttribute('href', href)
    if (useSameTab) {
      el.removeAttribute('target')
      el.removeAttribute('rel')
    } else {
      el.removeAttribute('download')
      el.setAttribute('target', '_blank')
      el.setAttribute('rel', 'noopener noreferrer')
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

function isAbsoluteUrl(url) {
  return /^https?:\/\//i.test(url)
}

/** @param {string} url */
async function releaseAssetExists(url) {
  if (isAbsoluteUrl(url)) return true
  try {
    const res = await fetch(url, { method: 'HEAD', cache: 'no-store' })
    return res.ok
  } catch {
    return false
  }
}

function isGitHubReleaseUrl(url) {
  return /github\.com\/[^/]+\/[^/]+\/releases\/download\//i.test(url)
}

function collectDownloadCandidates(manifest, versionsIndex) {
  const seen = new Set()
  const pages = []
  const github = []

  function bucket(url) {
    if (!url || seen.has(url)) return
    seen.add(url)
    if (isAbsoluteUrl(url) && isGitHubReleaseUrl(url)) {
      github.push(url)
    } else {
      pages.push(url)
    }
  }

  // GitHub Releases zuerst — funktioniert auch bei Installer >100 MB (Git LFS im Repo)
  if (manifest?.githubDownloadUrl) bucket(manifest.githubDownloadUrl)
  if (versionsIndex?.githubDownloadUrl) bucket(versionsIndex.githubDownloadUrl)

  const entries = versionsIndex?.versions
  if (Array.isArray(entries)) {
    for (const entry of entries) {
      if (entry && typeof entry === 'object' && entry.githubDownloadUrl) {
        bucket(entry.githubDownloadUrl)
      }
    }
  }

  bucket(GITHUB_RELEASES_PAGE)

  if (manifest?.downloadUrl) bucket(manifest.downloadUrl)
  if (versionsIndex?.downloadUrl) bucket(versionsIndex.downloadUrl)

  if (Array.isArray(entries)) {
    for (const entry of entries) {
      if (entry && typeof entry === 'object' && entry.downloadUrl) bucket(entry.downloadUrl)
    }
  }

  // GitHub Pages nur als Fallback (LFS-Pointer, nicht der echte Installer)
  if (manifest?.stableUrl) bucket(manifest.stableUrl)
  if (manifest?.versionedUrl) bucket(manifest.versionedUrl)
  if (manifest?.version) bucket(versionedSetupPath(manifest.version))
  if (versionsIndex?.stableUrl) bucket(versionsIndex.stableUrl)
  if (versionsIndex?.latest) bucket(versionedSetupPath(versionsIndex.latest))

  if (Array.isArray(entries)) {
    for (const entry of entries) {
      if (typeof entry === 'string') {
        bucket(versionedSetupPath(entry))
        continue
      }
      if (entry?.setupUrl) bucket(entry.setupUrl)
      if (entry?.version) bucket(versionedSetupPath(entry.version))
    }
  }

  return [...github, ...pages]
}

async function resolveDownloadHref(manifest, versionsIndex) {
  const candidates = collectDownloadCandidates(manifest, versionsIndex)
  for (const url of candidates) {
    if (isAbsoluteUrl(url) && isGitHubReleaseUrl(url)) {
      return { href: url, manifest }
    }
  }
  for (const url of candidates) {
    if (isAbsoluteUrl(url)) {
      return { href: url, manifest }
    }
  }
  for (const url of candidates) {
    if (await releaseAssetExists(url)) {
      return { href: url, manifest }
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
          filename: 'Chronell-setup.exe',
          downloadUrl: versionsIndex.downloadUrl
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
  setupHeroDemo()
  setupReveal()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  void init()
}
