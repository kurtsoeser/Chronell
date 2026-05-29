export function decodeXmlEntities(input: string): string {
  // EWS XML kann HTML enthalten; wir dekodieren die Standard-Entities.
  return input
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

