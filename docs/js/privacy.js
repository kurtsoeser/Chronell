const STORAGE_LANG = 'chronell.landing.lang'
const DEFAULT_LANG = 'de'

function detectLang() {
  const stored = localStorage.getItem(STORAGE_LANG)
  if (stored === 'de' || stored === 'en') return stored
  const nav = navigator.language || ''
  return nav.startsWith('de') ? 'de' : 'en'
}

function setLang(lang) {
  document.documentElement.lang = lang
  document.querySelectorAll('[data-lang-panel]').forEach((panel) => {
    panel.classList.toggle('is-active', panel.dataset.langPanel === lang)
  })
  document.querySelectorAll('.lang-toggle button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === lang)
  })
  const titles = { de: 'Datenschutz — Chronell', en: 'Privacy Policy — Chronell' }
  document.title = titles[lang] ?? titles.de
  localStorage.setItem(STORAGE_LANG, lang)
}

function setupLangToggle() {
  document.querySelectorAll('.lang-toggle button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang
      if (lang === 'de' || lang === 'en') setLang(lang)
    })
  })
}

document.getElementById('year').textContent = String(new Date().getFullYear())
setLang(detectLang())
setupLangToggle()
