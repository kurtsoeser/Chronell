import { describe, expect, it } from 'vitest'
import { htmlContainsCloudTasks, htmlContainsNoteEmbeds } from './note-editor-html-detect'

describe('htmlContainsNoteEmbeds', () => {
  it('erkennt note-embed-resizable im HTML', () => {
    expect(htmlContainsNoteEmbeds('<div class="note-youtube-embed note-embed-resizable"></div>')).toBe(
      true
    )
  })

  it('erkennt gespeichertes Embed-HTML ohne note-embed-resizable', () => {
    expect(
      htmlContainsNoteEmbeds(
        '<div class="note-youtube-embed" data-note-youtube-id="dQw4w9WgXcQ"></div>'
      )
    ).toBe(true)
  })

  it('gibt false für leeren oder normalen Text zurück', () => {
    expect(htmlContainsNoteEmbeds('')).toBe(false)
    expect(htmlContainsNoteEmbeds('<p>Hallo</p>')).toBe(false)
  })
})

describe('htmlContainsCloudTasks', () => {
  it('erkennt Cloud-Task-Items', () => {
    expect(
      htmlContainsCloudTasks('<li class="note-task-item note-cloud-task-item" data-type="taskItem">')
    ).toBe(true)
  })

  it('erkennt Legacy data-chronell-cloud-task-id', () => {
    expect(htmlContainsCloudTasks('<li data-chronell-cloud-task-id="abc">')).toBe(true)
  })

  it('gibt false ohne Aufgaben zurück', () => {
    expect(htmlContainsCloudTasks('<ul data-type="taskList"><li data-type="taskItem"></li></ul>')).toBe(
      false
    )
  })
})
