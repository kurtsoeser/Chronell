/**
 * Chronell /demo page — i18n, downloads, tour, sandbox bootstrap.
 */

import { createSandbox } from './sandbox.js'

const STORAGE_LANG = 'chronell.landing.lang'
const DEFAULT_LANG = 'de'
const RELEASE_MANIFEST = '../release/latest.json'
const GITHUB_RELEASES = 'https://github.com/kurtsoeser/Chronell/releases/latest'

let strings = {}
let currentLang = DEFAULT_LANG
let sandboxApi = null

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
    } else {
      el.textContent = value
    }
  })
  const title = get(strings, 'meta.title')
  if (title) document.title = title
  document.querySelectorAll('.lang-toggle button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === currentLang)
  })
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
      if (lang && lang !== currentLang) {
        void loadLang(lang).then(() => initSandbox())
      }
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

async function loadReleaseManifest() {
  try {
    const res = await fetch(RELEASE_MANIFEST, { cache: 'no-store' })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

function applyDownloadLinks(manifest) {
  const installer =
    manifest?.githubDownloadUrl || manifest?.downloadUrl || GITHUB_RELEASES
  const portable =
    manifest?.demoPortableDownloadUrl ||
    manifest?.githubDemoPortableUrl ||
    (manifest?.version
      ? `https://github.com/kurtsoeser/Chronell/releases/download/v${manifest.version}/Chronell-${manifest.version}-Demo-Portable.zip`
      : null)

  document.querySelectorAll('[data-download]').forEach((el) => {
    el.setAttribute('href', installer)
    el.setAttribute('target', '_blank')
    el.setAttribute('rel', 'noopener noreferrer')
  })

  document.querySelectorAll('[data-demo-portable]').forEach((el) => {
    if (portable) {
      el.setAttribute('href', portable)
      el.setAttribute('target', '_blank')
      el.setAttribute('rel', 'noopener noreferrer')
      el.hidden = false
    } else {
      el.setAttribute('href', GITHUB_RELEASES)
      el.setAttribute('target', '_blank')
      el.setAttribute('rel', 'noopener noreferrer')
    }
  })
}

function setupTour() {
  const steps = [
    { tab: 'mail', el: '[data-tour-step="mail"]' },
    { tab: 'calendar', el: '[data-tour-step="calendar"]' },
    { tab: 'tasks', el: '[data-tour-step="tasks"]' },
    { tab: 'connections', el: '[data-tour-step="connections"]' }
  ]

  const poster = document.querySelector('[data-demo-tour-start]')
  const playBtn = document.querySelector('[data-demo-tour-play]')
  const sandbox = document.getElementById('demo-sandbox')

  async function runTour(fromStep = 0) {
    if (sandbox) {
      sandbox.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    await delay(400)
    for (let i = fromStep; i < steps.length; i++) {
      const step = steps[i]
      document.querySelectorAll('.demo-tour-step').forEach((s, idx) => {
        s.classList.toggle('active', idx === i)
      })
      if (sandboxApi) sandboxApi.activateTab(step.tab)
      await delay(i === fromStep ? 600 : 1400)
    }
  }

  poster?.addEventListener('click', () => void runTour(0))
  playBtn?.addEventListener('click', (e) => {
    e.stopPropagation()
    void runTour(0)
  })

  document.querySelectorAll('.demo-tour-step').forEach((el, idx) => {
    el.addEventListener('click', () => void runTour(idx))
  })

  document.querySelectorAll('[href="#demo-sandbox"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault()
      sandbox?.scrollIntoView({ behavior: 'smooth' })
    })
  })
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function initSandbox() {
  const root = document.getElementById('demo-sandbox-root')
  if (!root) return
  try {
    const res = await fetch('data/demo-snapshot.json', { cache: 'no-store' })
    if (!res.ok) throw new Error('snapshot load failed')
    const snapshot = await res.json()
    sandboxApi = createSandbox(root, snapshot, strings, currentLang)
  } catch (e) {
    console.error('[demo sandbox]', e)
    root.innerHTML = '<p style="padding:1rem;color:hsl(var(--muted))">Demo-Daten konnten nicht geladen werden.</p>'
  }
}

async function init() {
  currentLang = detectLang()
  setupLangToggle()
  setupMobileNav()
  setupTour()
  try {
    await loadLang(currentLang)
  } catch (e) {
    console.warn('[demo page]', e)
    if (currentLang !== 'en') await loadLang('en')
  }
  const manifest = await loadReleaseManifest()
  applyDownloadLinks(manifest)
  await initSandbox()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void init())
} else {
  void init()
}
