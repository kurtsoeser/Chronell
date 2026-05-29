import type { LucideIcon } from 'lucide-react'
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun
} from 'lucide-react'
import { cn } from '@/lib/utils'

/** Open-Meteo WMO-Wettercode → Anzeige-Kategorie. */
export type WeatherCodeKind =
  | 'clear'
  | 'partly'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'showers'
  | 'storm'
  | 'unknown'

const ICON_BY_KIND: Record<WeatherCodeKind, LucideIcon> = {
  clear: Sun,
  partly: CloudSun,
  cloudy: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: CloudSnow,
  showers: CloudRain,
  storm: CloudLightning,
  unknown: Cloud
}

export function weatherCodeKind(code: number): WeatherCodeKind {
  if (code === 0) return 'clear'
  if (code === 1 || code === 2) return 'partly'
  if (code === 3) return 'cloudy'
  if (code === 45 || code === 48) return 'fog'
  if (code >= 51 && code <= 57) return 'drizzle'
  if (code >= 61 && code <= 67) return 'rain'
  if (code >= 71 && code <= 77) return 'snow'
  if (code >= 80 && code <= 82) return 'showers'
  if (code >= 95) return 'storm'
  return 'unknown'
}

/** i18n-Schlüssel unter `dashboard.weather.codes.*` */
export function weatherCodeLabelKey(code: number): WeatherCodeKind {
  return weatherCodeKind(code)
}

export function WeatherCodeIcon(props: {
  code: number
  className?: string
  title?: string
}): JSX.Element {
  const { code, className, title } = props
  const kind = weatherCodeKind(code)
  const Icon = ICON_BY_KIND[kind]
  return (
    <Icon
      className={cn('shrink-0 text-primary/90', className)}
      strokeWidth={1.75}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    />
  )
}
