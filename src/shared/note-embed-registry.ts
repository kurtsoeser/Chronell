import {
  NOTE_CALENDLY_EMBED_ATTR,
  NOTE_CALENDLY_EMBED_CLASS,
  buildCalendlyEmbedUrl,
  isAllowedCalendlyEmbedSrc,
  isCalendlyUrl,
  parseCalendlyPath
} from './note-calendly-embed'
import {
  NOTE_CODEPEN_EMBED_ATTR,
  NOTE_CODEPEN_EMBED_CLASS,
  buildCodePenEmbedUrl,
  isAllowedCodePenEmbedSrc,
  isCodePenUrl,
  parseCodePenEmbedRef,
  serializeCodePenEmbedRef
} from './note-codepen-embed'
import {
  NOTE_DESMOS_EMBED_ATTR,
  NOTE_DESMOS_EMBED_CLASS,
  buildDesmosEmbedUrl,
  isAllowedDesmosEmbedSrc,
  isDesmosUrl,
  parseDesmosEmbedRef,
  serializeDesmosEmbedRef
} from './note-desmos-embed'
import {
  NOTE_FIGMA_EMBED_ATTR,
  NOTE_FIGMA_EMBED_CLASS,
  buildFigmaEmbedUrl,
  isAllowedFigmaEmbedSrc,
  parseFigmaPageUrl
} from './note-figma-embed'
import {
  NOTE_GIST_EMBED_ATTR,
  NOTE_GIST_EMBED_CLASS,
  buildGistEmbedUrl,
  isAllowedGistEmbedSrc,
  isGistUrl,
  parseGistEmbedRef,
  serializeGistEmbedRef
} from './note-gist-embed'
import {
  NOTE_GEOGEBRA_EMBED_ATTR,
  NOTE_GEOGEBRA_EMBED_CLASS,
  buildGeoGebraEmbedUrl,
  isAllowedGeoGebraEmbedSrc,
  parseGeoGebraMaterialId
} from './note-geogebra-embed'
import {
  NOTE_LOOM_EMBED_ATTR,
  NOTE_LOOM_EMBED_CLASS,
  buildLoomEmbedUrl,
  isAllowedLoomEmbedSrc,
  parseLoomVideoId
} from './note-loom-embed'
import {
  NOTE_M365_VIDEO_EMBED_ATTR,
  NOTE_M365_VIDEO_EMBED_CLASS,
  isM365VideoShareUrl
} from './note-m365-video-embed'
import {
  NOTE_MIRO_EMBED_ATTR,
  NOTE_MIRO_EMBED_CLASS,
  buildMiroEmbedUrl,
  isAllowedMiroEmbedSrc,
  parseMiroBoardId
} from './note-miro-embed'
import {
  NOTE_OPENSTREETMAP_EMBED_ATTR,
  NOTE_OPENSTREETMAP_EMBED_CLASS,
  buildOpenStreetMapEmbedUrl,
  isAllowedOpenStreetMapEmbedSrc,
  isOpenStreetMapUrl,
  parseOpenStreetMapEmbedSrc
} from './note-openstreetmap-embed'
import {
  NOTE_GOOGLE_MAPS_EMBED_ATTR,
  NOTE_GOOGLE_MAPS_EMBED_CLASS,
  buildGoogleMapsEmbedUrl,
  isAllowedGoogleMapsEmbedSrc,
  isGoogleMapsUrl,
  parseGoogleMapsEmbedSrc
} from './note-google-maps-embed'
import { isResolvableNoteEmbedUrl } from './note-embed-url-resolve'
import type { NoteEmbedThemeOptions } from './note-embed-theme'
import {
  NOTE_MSFORMS_EMBED_ATTR,
  NOTE_MSFORMS_EMBED_CLASS,
  NOTE_MSFORMS_EMBED_HOST_ATTR,
  isAllowedMsFormsEmbedSrc,
  isMsFormsResponseUrl
} from './note-msforms-embed'
import {
  NOTE_TEAMS_RECORDING_EMBED_ATTR,
  NOTE_TEAMS_RECORDING_EMBED_CLASS,
  buildTeamsRecordingEmbedUrl,
  isAllowedTeamsRecordingEmbedSrc,
  parseTeamsRecordingEmbedSrc
} from './note-teams-recording-embed'
import {
  NOTE_TWITTER_EMBED_ATTR,
  NOTE_TWITTER_EMBED_CLASS,
  buildTwitterEmbedUrl,
  isAllowedTwitterEmbedSrc,
  parseTwitterTweetId
} from './note-twitter-embed'
import {
  NOTE_TYPEFORM_EMBED_ATTR,
  NOTE_TYPEFORM_EMBED_CLASS,
  buildTypeformEmbedUrl,
  isAllowedTypeformEmbedSrc,
  parseTypeformId
} from './note-typeform-embed'
import {
  NOTE_SOUNDCLOUD_EMBED_ATTR,
  NOTE_SOUNDCLOUD_EMBED_CLASS,
  buildSoundCloudEmbedUrl,
  isAllowedSoundCloudEmbedSrc,
  parseSoundCloudPageUrl
} from './note-soundcloud-embed'
import {
  NOTE_SPOTIFY_EMBED_ATTR,
  NOTE_SPOTIFY_EMBED_CLASS,
  buildSpotifyEmbedUrl,
  isAllowedSpotifyEmbedSrc,
  isSpotifyUrl,
  parseSpotifyEmbedRef,
  serializeSpotifyEmbedRef
} from './note-spotify-embed'
import {
  NOTE_TIKTOK_EMBED_ATTR,
  NOTE_TIKTOK_EMBED_CLASS,
  buildTikTokEmbedUrl,
  isAllowedTikTokEmbedSrc,
  parseTikTokVideoId
} from './note-tiktok-embed'
import {
  NOTE_VIMEO_EMBED_ATTR,
  NOTE_VIMEO_EMBED_CLASS,
  buildVimeoEmbedUrl,
  isAllowedVimeoEmbedSrc,
  parseVimeoVideoId
} from './note-vimeo-embed'
import {
  NOTE_YOUTUBE_EMBED_ATTR,
  NOTE_YOUTUBE_EMBED_CLASS,
  buildYouTubeEmbedUrl,
  isAllowedYouTubeEmbedSrc,
  parseYouTubeVideoId
} from './note-youtube-embed'

function parseSpotifyStoredValue(input: string): string | null {
  const ref = parseSpotifyEmbedRef(input)
  return ref ? serializeSpotifyEmbedRef(ref) : null
}

function parseDesmosStoredValue(input: string): string | null {
  const ref = parseDesmosEmbedRef(input)
  return ref ? serializeDesmosEmbedRef(ref) : null
}

function parseCodePenStoredValue(input: string): string | null {
  const ref = parseCodePenEmbedRef(input)
  return ref ? serializeCodePenEmbedRef(ref) : null
}

function parseGistStoredValue(input: string): string | null {
  const ref = parseGistEmbedRef(input)
  return ref ? serializeGistEmbedRef(ref) : null
}

export type NoteEmbedProviderId =
  | 'youtube'
  | 'msForms'
  | 'geogebra'
  | 'googleMaps'
  | 'typeform'
  | 'twitter'
  | 'teamsRecording'
  | 'm365Video'
  | 'spotify'
  | 'vimeo'
  | 'soundcloud'
  | 'tiktok'
  | 'desmos'
  | 'codepen'
  | 'gist'
  | 'loom'
  | 'figma'
  | 'miro'
  | 'openstreetmap'
  | 'calendly'

/** TipTap-/Renderer-Konfiguration für Standard-iframe-Embeds (Factory). */
export interface NoteEmbedTiptapConfig {
  extensionName: string
  title: string
  parseStoredValue: (input: string) => string | null
  buildIframeSrc: (storedValue: string, options?: NoteEmbedThemeOptions) => string
  parseIframeSrc: (src: string) => string | null
  pasteRegex: RegExp
  iframeSelector?: string
  iframeAllow?: string
  iframeExtras?: Record<string, string>
  /** iframe-src reagiert auf `data-compose-theme` (nicht im gespeicherten HTML). */
  usesEditorTheme?: boolean
}

export interface NoteEmbedRegistryEntry {
  id: NoteEmbedProviderId
  label: string
  dataAttrs: readonly string[]
  embedClass: string
  canParseInput: (input: string) => boolean
  isAllowedEmbedSrc: (src: string) => boolean
  /** Gesetzt = Extension via iframe-Factory; fehlt = eigene TipTap-Extension. */
  tiptap?: NoteEmbedTiptapConfig
}

const YOUTUBE_URL_PASTE_RE =
  /https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?(?:[^\s]*&)?v=|shorts\/|embed\/)|youtu\.be\/)[\w-]{11}(?:[^\s]*)?/gi

const GEOGEBRA_URL_PASTE_RE =
  /https?:\/\/(?:www\.|tube\.)?geogebra\.org\/(?:m\/[A-Za-z0-9]+|material\/(?:show|iframe)\/id\/[A-Za-z0-9]+(?:\/[^\s]*)?|(?:calculator|geometry|graphing|classic|3d)\?[^\s]*\bmaterial=[A-Za-z0-9]+[^\s]*)/gi

const GOOGLE_MAPS_URL_PASTE_RE =
  /https?:\/\/(?:www\.|maps\.)?google\.com\/maps[^\s]*/gi

const TYPEFORM_URL_PASTE_RE =
  /https?:\/\/(?:[a-z0-9-]+\.)?typeform\.com\/to\/[A-Za-z0-9]+[^\s]*/gi

const TWITTER_URL_PASTE_RE =
  /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[^/\s]+\/status\/\d+[^\s]*/gi

const TEAMS_RECORDING_URL_PASTE_RE =
  /https?:\/\/(?:(?:web\.)?microsoftstream\.com\/(?:embed\/)?video\/[0-9a-f-]{36}[^\s]*|[^\s]*\.sharepoint\.com\/[^\s]*(?:embed\.aspx|Stream\.aspx)[^\s]*|teams\.microsoft\.com\/l\/meetingrecap\?[^\s]*)/gi

const SPOTIFY_URL_PASTE_RE =
  /https?:\/\/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(?:track|album|playlist|episode|show|artist)\/[A-Za-z0-9]+[^\s]*/gi

const VIMEO_URL_PASTE_RE =
  /https?:\/\/(?:www\.)?(?:vimeo\.com\/(?:\d+|[^/\s]+\/[^/\s]+\/\d+)|player\.vimeo\.com\/video\/\d+)[^\s]*/gi

const SOUNDCLOUD_URL_PASTE_RE =
  /https?:\/\/(?:www\.)?soundcloud\.com\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+[^\s]*/gi

const TIKTOK_URL_PASTE_RE =
  /https?:\/\/(?:www\.)?tiktok\.com\/@[^/\s]+\/video\/\d+[^\s]*/gi

const DESMOS_URL_PASTE_RE =
  /https?:\/\/(?:www\.)?desmos\.com\/(?:calculator|geometry|3d|scientific|fourfunction|matrix|regression|testmode)\/[A-Za-z0-9]+[^\s]*/gi

const CODEPEN_URL_PASTE_RE =
  /https?:\/\/(?:www\.)?codepen\.io\/(?:team\/[^/\s]+\/|[^/\s]+\/)(?:pen|embed|details|full)\/[A-Za-z0-9]+[^\s]*/gi

const GIST_URL_PASTE_RE =
  /https?:\/\/gist\.github\.com\/[A-Za-z0-9_-]+\/[a-f0-9]+[^\s]*/gi

const LOOM_URL_PASTE_RE =
  /https?:\/\/(?:www\.)?loom\.com\/(?:share|embed)\/[0-9a-f-]{36}[^\s]*/gi

const FIGMA_URL_PASTE_RE =
  /https?:\/\/(?:www\.)?figma\.com\/(?:file|design|proto|board|slides|deck)\/[A-Za-z0-9]+[^\s]*/gi

const MIRO_URL_PASTE_RE =
  /https?:\/\/(?:www\.)?miro\.com\/app\/(?:board|live-embed)\/[^\s]+/gi

const OPENSTREETMAP_URL_PASTE_RE =
  /https?:\/\/(?:www\.)?openstreetmap\.org\/(?:export\/embed\.html[^\s]*|[^\s#]*#map=\d+(?:\.\d+)?\/-?\d+(?:\.\d+)?\/-?\d+(?:\.\d+)?[^\s]*|[^\s?]*\?[^\s]*\bmlat=[^\s]+)/gi

const CALENDLY_URL_PASTE_RE =
  /https?:\/\/(?:www\.)?calendly\.com\/[a-z0-9][a-z0-9_-]*(?:\/[a-z0-9][a-z0-9_-]*)?[^\s]*/gi

/** Zentrale Registry aller Notiz-Embed-Provider. */
export const NOTE_EMBED_REGISTRY: readonly NoteEmbedRegistryEntry[] = [
  {
    id: 'youtube',
    label: 'YouTube',
    dataAttrs: [NOTE_YOUTUBE_EMBED_ATTR],
    embedClass: NOTE_YOUTUBE_EMBED_CLASS,
    canParseInput: (input) => parseYouTubeVideoId(input) != null,
    isAllowedEmbedSrc: isAllowedYouTubeEmbedSrc,
    tiptap: {
      extensionName: 'noteYoutubeEmbed',
      title: 'YouTube video',
      parseStoredValue: parseYouTubeVideoId,
      buildIframeSrc: buildYouTubeEmbedUrl,
      parseIframeSrc: (src) => parseYouTubeVideoId(src),
      pasteRegex: YOUTUBE_URL_PASTE_RE,
      iframeSelector:
        'iframe[src*="youtube.com/embed"], iframe[src*="youtube-nocookie.com/embed"]',
      iframeAllow:
        'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
    }
  },
  {
    id: 'msForms',
    label: 'Microsoft Forms',
    dataAttrs: [NOTE_MSFORMS_EMBED_ATTR, NOTE_MSFORMS_EMBED_HOST_ATTR],
    embedClass: NOTE_MSFORMS_EMBED_CLASS,
    canParseInput: isMsFormsResponseUrl,
    isAllowedEmbedSrc: isAllowedMsFormsEmbedSrc
  },
  {
    id: 'geogebra',
    label: 'GeoGebra',
    dataAttrs: [NOTE_GEOGEBRA_EMBED_ATTR],
    embedClass: NOTE_GEOGEBRA_EMBED_CLASS,
    canParseInput: (input) => parseGeoGebraMaterialId(input) != null,
    isAllowedEmbedSrc: isAllowedGeoGebraEmbedSrc,
    tiptap: {
      extensionName: 'noteGeogebraEmbed',
      title: 'GeoGebra',
      parseStoredValue: parseGeoGebraMaterialId,
      buildIframeSrc: buildGeoGebraEmbedUrl,
      parseIframeSrc: (src) => parseGeoGebraMaterialId(src),
      pasteRegex: GEOGEBRA_URL_PASTE_RE,
      iframeSelector: 'iframe[src*="geogebra.org/material/iframe/id/"]',
      iframeExtras: { scrolling: 'no' }
    }
  },
  {
    id: 'googleMaps',
    label: 'Google Maps',
    dataAttrs: [NOTE_GOOGLE_MAPS_EMBED_ATTR],
    embedClass: NOTE_GOOGLE_MAPS_EMBED_CLASS,
    canParseInput: isGoogleMapsUrl,
    isAllowedEmbedSrc: isAllowedGoogleMapsEmbedSrc,
    tiptap: {
      extensionName: 'noteGoogleMapsEmbed',
      title: 'Google Maps',
      parseStoredValue: parseGoogleMapsEmbedSrc,
      buildIframeSrc: buildGoogleMapsEmbedUrl,
      parseIframeSrc: (src) =>
        isAllowedGoogleMapsEmbedSrc(src) ? parseGoogleMapsEmbedSrc(src) : null,
      pasteRegex: GOOGLE_MAPS_URL_PASTE_RE,
      iframeSelector: 'iframe[src*="google.com/maps"]'
    }
  },
  {
    id: 'typeform',
    label: 'Typeform',
    dataAttrs: [NOTE_TYPEFORM_EMBED_ATTR],
    embedClass: NOTE_TYPEFORM_EMBED_CLASS,
    canParseInput: (input) => parseTypeformId(input) != null,
    isAllowedEmbedSrc: isAllowedTypeformEmbedSrc,
    tiptap: {
      extensionName: 'noteTypeformEmbed',
      title: 'Typeform',
      parseStoredValue: parseTypeformId,
      buildIframeSrc: buildTypeformEmbedUrl,
      parseIframeSrc: (src) => parseTypeformId(src),
      pasteRegex: TYPEFORM_URL_PASTE_RE,
      iframeSelector: 'iframe[src*="typeform.com/to/"]'
    }
  },
  {
    id: 'twitter',
    label: 'X (Twitter)',
    dataAttrs: [NOTE_TWITTER_EMBED_ATTR],
    embedClass: NOTE_TWITTER_EMBED_CLASS,
    canParseInput: (input) => parseTwitterTweetId(input) != null,
    isAllowedEmbedSrc: isAllowedTwitterEmbedSrc,
    tiptap: {
      extensionName: 'noteTwitterEmbed',
      title: 'X (Twitter)',
      parseStoredValue: parseTwitterTweetId,
      buildIframeSrc: (tweetId, options) => buildTwitterEmbedUrl(tweetId, options?.theme),
      parseIframeSrc: (src) => parseTwitterTweetId(src),
      pasteRegex: TWITTER_URL_PASTE_RE,
      iframeSelector: 'iframe[src*="platform.twitter.com/embed/Tweet.html"]',
      iframeAllow: 'encrypted-media',
      usesEditorTheme: true
    }
  },
  {
    id: 'teamsRecording',
    label: 'Teams-Aufzeichnung',
    dataAttrs: [NOTE_TEAMS_RECORDING_EMBED_ATTR],
    embedClass: NOTE_TEAMS_RECORDING_EMBED_CLASS,
    canParseInput: (input) => parseTeamsRecordingEmbedSrc(input) != null,
    isAllowedEmbedSrc: isAllowedTeamsRecordingEmbedSrc,
    tiptap: {
      extensionName: 'noteTeamsRecordingEmbed',
      title: 'Teams-Aufzeichnung',
      parseStoredValue: parseTeamsRecordingEmbedSrc,
      buildIframeSrc: buildTeamsRecordingEmbedUrl,
      parseIframeSrc: (src) =>
        isAllowedTeamsRecordingEmbedSrc(src) ? parseTeamsRecordingEmbedSrc(src) : null,
      pasteRegex: TEAMS_RECORDING_URL_PASTE_RE,
      iframeSelector:
        'iframe[src*="microsoftstream.com/embed/video"], iframe[src*="sharepoint.com"], iframe[src*="teams.microsoft.com/l/meetingrecap"]',
      iframeAllow: 'autoplay; fullscreen; encrypted-media; picture-in-picture'
    }
  },
  {
    id: 'm365Video',
    label: 'SharePoint-Video',
    dataAttrs: [NOTE_M365_VIDEO_EMBED_ATTR],
    embedClass: NOTE_M365_VIDEO_EMBED_CLASS,
    canParseInput: isM365VideoShareUrl,
    isAllowedEmbedSrc: () => false
  },
  {
    id: 'spotify',
    label: 'Spotify',
    dataAttrs: [NOTE_SPOTIFY_EMBED_ATTR],
    embedClass: NOTE_SPOTIFY_EMBED_CLASS,
    canParseInput: isSpotifyUrl,
    isAllowedEmbedSrc: isAllowedSpotifyEmbedSrc,
    tiptap: {
      extensionName: 'noteSpotifyEmbed',
      title: 'Spotify',
      parseStoredValue: parseSpotifyStoredValue,
      buildIframeSrc: buildSpotifyEmbedUrl,
      parseIframeSrc: (src) => parseSpotifyStoredValue(src),
      pasteRegex: SPOTIFY_URL_PASTE_RE,
      iframeSelector: 'iframe[src*="open.spotify.com/embed/"]',
      iframeAllow: 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture'
    }
  },
  {
    id: 'vimeo',
    label: 'Vimeo',
    dataAttrs: [NOTE_VIMEO_EMBED_ATTR],
    embedClass: NOTE_VIMEO_EMBED_CLASS,
    canParseInput: (input) => parseVimeoVideoId(input) != null,
    isAllowedEmbedSrc: isAllowedVimeoEmbedSrc,
    tiptap: {
      extensionName: 'noteVimeoEmbed',
      title: 'Vimeo',
      parseStoredValue: parseVimeoVideoId,
      buildIframeSrc: buildVimeoEmbedUrl,
      parseIframeSrc: (src) => parseVimeoVideoId(src),
      pasteRegex: VIMEO_URL_PASTE_RE,
      iframeSelector: 'iframe[src*="player.vimeo.com/video/"]',
      iframeAllow: 'autoplay; fullscreen; picture-in-picture; encrypted-media'
    }
  },
  {
    id: 'soundcloud',
    label: 'SoundCloud',
    dataAttrs: [NOTE_SOUNDCLOUD_EMBED_ATTR],
    embedClass: NOTE_SOUNDCLOUD_EMBED_CLASS,
    canParseInput: (input) => parseSoundCloudPageUrl(input) != null,
    isAllowedEmbedSrc: isAllowedSoundCloudEmbedSrc,
    tiptap: {
      extensionName: 'noteSoundCloudEmbed',
      title: 'SoundCloud',
      parseStoredValue: parseSoundCloudPageUrl,
      buildIframeSrc: buildSoundCloudEmbedUrl,
      parseIframeSrc: (src) => parseSoundCloudPageUrl(src),
      pasteRegex: SOUNDCLOUD_URL_PASTE_RE,
      iframeSelector: 'iframe[src*="w.soundcloud.com/player"]'
    }
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    dataAttrs: [NOTE_TIKTOK_EMBED_ATTR],
    embedClass: NOTE_TIKTOK_EMBED_CLASS,
    canParseInput: (input) => parseTikTokVideoId(input) != null,
    isAllowedEmbedSrc: isAllowedTikTokEmbedSrc,
    tiptap: {
      extensionName: 'noteTiktokEmbed',
      title: 'TikTok',
      parseStoredValue: parseTikTokVideoId,
      buildIframeSrc: buildTikTokEmbedUrl,
      parseIframeSrc: (src) => parseTikTokVideoId(src),
      pasteRegex: TIKTOK_URL_PASTE_RE,
      iframeSelector: 'iframe[src*="tiktok.com/embed/v2/"]'
    }
  },
  {
    id: 'desmos',
    label: 'Desmos',
    dataAttrs: [NOTE_DESMOS_EMBED_ATTR],
    embedClass: NOTE_DESMOS_EMBED_CLASS,
    canParseInput: isDesmosUrl,
    isAllowedEmbedSrc: isAllowedDesmosEmbedSrc,
    tiptap: {
      extensionName: 'noteDesmosEmbed',
      title: 'Desmos',
      parseStoredValue: parseDesmosStoredValue,
      buildIframeSrc: buildDesmosEmbedUrl,
      parseIframeSrc: (src) => parseDesmosStoredValue(src),
      pasteRegex: DESMOS_URL_PASTE_RE,
      iframeSelector: 'iframe[src*="desmos.com/"]'
    }
  },
  {
    id: 'codepen',
    label: 'CodePen',
    dataAttrs: [NOTE_CODEPEN_EMBED_ATTR],
    embedClass: NOTE_CODEPEN_EMBED_CLASS,
    canParseInput: isCodePenUrl,
    isAllowedEmbedSrc: isAllowedCodePenEmbedSrc,
    tiptap: {
      extensionName: 'noteCodepenEmbed',
      title: 'CodePen',
      parseStoredValue: parseCodePenStoredValue,
      buildIframeSrc: buildCodePenEmbedUrl,
      parseIframeSrc: (src) => parseCodePenStoredValue(src),
      pasteRegex: CODEPEN_URL_PASTE_RE,
      iframeSelector: 'iframe[src*="codepen.io/"][src*="/embed/"]'
    }
  },
  {
    id: 'gist',
    label: 'GitHub Gist',
    dataAttrs: [NOTE_GIST_EMBED_ATTR],
    embedClass: NOTE_GIST_EMBED_CLASS,
    canParseInput: isGistUrl,
    isAllowedEmbedSrc: isAllowedGistEmbedSrc,
    tiptap: {
      extensionName: 'noteGistEmbed',
      title: 'GitHub Gist',
      parseStoredValue: parseGistStoredValue,
      buildIframeSrc: buildGistEmbedUrl,
      parseIframeSrc: (src) => parseGistStoredValue(src),
      pasteRegex: GIST_URL_PASTE_RE,
      iframeSelector: 'iframe[src*="gist.github.com/"]'
    }
  },
  {
    id: 'loom',
    label: 'Loom',
    dataAttrs: [NOTE_LOOM_EMBED_ATTR],
    embedClass: NOTE_LOOM_EMBED_CLASS,
    canParseInput: (input) => parseLoomVideoId(input) != null,
    isAllowedEmbedSrc: isAllowedLoomEmbedSrc,
    tiptap: {
      extensionName: 'noteLoomEmbed',
      title: 'Loom',
      parseStoredValue: parseLoomVideoId,
      buildIframeSrc: buildLoomEmbedUrl,
      parseIframeSrc: (src) => parseLoomVideoId(src),
      pasteRegex: LOOM_URL_PASTE_RE,
      iframeSelector: 'iframe[src*="loom.com/embed/"]',
      iframeAllow: 'autoplay; fullscreen; encrypted-media; picture-in-picture'
    }
  },
  {
    id: 'figma',
    label: 'Figma',
    dataAttrs: [NOTE_FIGMA_EMBED_ATTR],
    embedClass: NOTE_FIGMA_EMBED_CLASS,
    canParseInput: (input) => parseFigmaPageUrl(input) != null,
    isAllowedEmbedSrc: isAllowedFigmaEmbedSrc,
    tiptap: {
      extensionName: 'noteFigmaEmbed',
      title: 'Figma',
      parseStoredValue: parseFigmaPageUrl,
      buildIframeSrc: buildFigmaEmbedUrl,
      parseIframeSrc: (src) => parseFigmaPageUrl(src),
      pasteRegex: FIGMA_URL_PASTE_RE,
      iframeSelector: 'iframe[src*="figma.com/embed"]'
    }
  },
  {
    id: 'miro',
    label: 'Miro',
    dataAttrs: [NOTE_MIRO_EMBED_ATTR],
    embedClass: NOTE_MIRO_EMBED_CLASS,
    canParseInput: (input) => parseMiroBoardId(input) != null,
    isAllowedEmbedSrc: isAllowedMiroEmbedSrc,
    tiptap: {
      extensionName: 'noteMiroEmbed',
      title: 'Miro',
      parseStoredValue: parseMiroBoardId,
      buildIframeSrc: buildMiroEmbedUrl,
      parseIframeSrc: (src) => parseMiroBoardId(src),
      pasteRegex: MIRO_URL_PASTE_RE,
      iframeSelector: 'iframe[src*="miro.com/app/live-embed/"]',
      iframeAllow: 'fullscreen; clipboard-read; clipboard-write'
    }
  },
  {
    id: 'openstreetmap',
    label: 'OpenStreetMap',
    dataAttrs: [NOTE_OPENSTREETMAP_EMBED_ATTR],
    embedClass: NOTE_OPENSTREETMAP_EMBED_CLASS,
    canParseInput: isOpenStreetMapUrl,
    isAllowedEmbedSrc: isAllowedOpenStreetMapEmbedSrc,
    tiptap: {
      extensionName: 'noteOpenstreetmapEmbed',
      title: 'OpenStreetMap',
      parseStoredValue: parseOpenStreetMapEmbedSrc,
      buildIframeSrc: buildOpenStreetMapEmbedUrl,
      parseIframeSrc: (src) =>
        isAllowedOpenStreetMapEmbedSrc(src) ? parseOpenStreetMapEmbedSrc(src) : null,
      pasteRegex: OPENSTREETMAP_URL_PASTE_RE,
      iframeSelector: 'iframe[src*="openstreetmap.org/export/embed.html"]'
    }
  },
  {
    id: 'calendly',
    label: 'Calendly',
    dataAttrs: [NOTE_CALENDLY_EMBED_ATTR],
    embedClass: NOTE_CALENDLY_EMBED_CLASS,
    canParseInput: isCalendlyUrl,
    isAllowedEmbedSrc: isAllowedCalendlyEmbedSrc,
    tiptap: {
      extensionName: 'noteCalendlyEmbed',
      title: 'Calendly',
      parseStoredValue: parseCalendlyPath,
      buildIframeSrc: buildCalendlyEmbedUrl,
      parseIframeSrc: (src) => parseCalendlyPath(src),
      pasteRegex: CALENDLY_URL_PASTE_RE,
      iframeSelector: 'iframe[src*="calendly.com/"]'
    }
  }
] as const

export function getNoteEmbedRegistryEntry(
  id: NoteEmbedProviderId
): NoteEmbedRegistryEntry | undefined {
  return NOTE_EMBED_REGISTRY.find((entry) => entry.id === id)
}

export function noteEmbedSanitizeDataAttrs(): string[] {
  return NOTE_EMBED_REGISTRY.flatMap((entry) => [...entry.dataAttrs])
}

export function noteEmbedTiptapConfigs(): NoteEmbedTiptapConfig[] {
  return NOTE_EMBED_REGISTRY.flatMap((entry) => (entry.tiptap ? [entry.tiptap] : []))
}

export function isEmbeddableNoteUrl(input: string): boolean {
  const trimmed = input.trim()
  if (!trimmed) return false
  return NOTE_EMBED_REGISTRY.some((entry) => entry.canParseInput(trimmed))
}

export function isAllowedNoteEmbedIframeSrc(src: string): boolean {
  const trimmed = src.trim()
  if (!trimmed) return false
  return NOTE_EMBED_REGISTRY.some((entry) => entry.isAllowedEmbedSrc(trimmed))
}

/** Darf als iframe-Subframe in Notizen geladen werden (Electron Mail-Schutz). */
export function isAllowedNoteEmbedSubFrameUrl(url: string): boolean {
  return isAllowedNoteEmbedIframeSrc(url)
}

export { isResolvableNoteEmbedUrl }

export function findNoteEmbedPasteTarget(
  url: string
): { extensionName: string; storedValue: string } | null {
  for (const entry of NOTE_EMBED_REGISTRY) {
    if (!entry.tiptap) continue
    const storedValue = entry.tiptap.parseStoredValue(url)
    if (storedValue) {
      return { extensionName: entry.tiptap.extensionName, storedValue }
    }
  }
  return null
}
