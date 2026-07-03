import { isGoogleMapsShortUrl } from './note-google-maps-embed'
import { isM365VideoShortUrl } from './note-m365-video-embed'

/** URLs, die im Main-Prozess per Redirect aufgelöst werden müssen, bevor ein Embed erkannt wird. */
export function isResolvableNoteEmbedUrl(input: string): boolean {
  return isGoogleMapsShortUrl(input) || isM365VideoShortUrl(input)
}
