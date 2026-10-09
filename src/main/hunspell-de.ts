import { Buffer } from 'node:buffer'
import nspell from 'nspell'
import dictionary from 'dictionary-de'

type NSpell = ReturnType<typeof nspell>

let germanSpell: NSpell | null = null

function getGermanSpell(): NSpell {
  if (!germanSpell) {
    germanSpell = nspell({
      aff: Buffer.from(dictionary.aff),
      dic: Buffer.from(dictionary.dic)
    })
  }
  return germanSpell
}

export function germanSpellLookup(
  word: string,
  limit = 8
): { correct: boolean; suggestions: string[] } {
  const trimmed = word.trim()
  if (!trimmed) return { correct: true, suggestions: [] }
  const spell = getGermanSpell()
  if (spell.correct(trimmed)) return { correct: true, suggestions: [] }
  return { correct: false, suggestions: spell.suggest(trimmed).slice(0, limit) }
}
