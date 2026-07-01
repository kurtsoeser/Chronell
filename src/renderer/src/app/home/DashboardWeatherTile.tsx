import { useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { useDateFnsLocale } from '@/lib/date-fns-locale'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { fetchOpenMeteoForecast, type OpenMeteoForecastDay } from '@/lib/open-meteo-weather'
import { requestOpenAccountSettings } from '@/lib/open-account-settings'
import {
  chronellDashboardTileCaptionClass,
  chronellDashboardTileListMetaClass,
  chronellDashboardTileListPrimaryClass,
  chronellDashboardTileSubtitleClass,
  chronellDashboardTileTitleClass,
  chronellDashboardTileWeatherTempClass
} from '@/lib/chronell-ui-classes'
import { WeatherCodeIcon, weatherCodeLabelKey } from '@/lib/weather-code-display'

export interface DashboardWeatherTileProps {
  latitude: number | null
  longitude: number | null
  locationName: string | null
  calendarTimeZone: string | null
}

export function DashboardWeatherTile({
  latitude,
  longitude,
  locationName,
  calendarTimeZone
}: DashboardWeatherTileProps): JSX.Element {
  const { t, i18n } = useTranslation()
  const dfLocale = useDateFnsLocale()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [daily, setDaily] = useState<OpenMeteoForecastDay[]>([])
  const [currentTemp, setCurrentTemp] = useState<number | null>(null)
  const [currentCode, setCurrentCode] = useState<number>(0)
  const [currentHum, setCurrentHum] = useState<number | null>(null)
  const [currentWind, setCurrentWind] = useState<number | null>(null)
  const [currentFeels, setCurrentFeels] = useState<number | null>(null)

  const hasCoords = latitude != null && longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude)

  const labelForCode = useMemo(
    () =>
      (code: number): string =>
        t(`dashboard.weather.codes.${weatherCodeLabelKey(code)}`),
    [t]
  )

  useEffect(() => {
    if (!hasCoords || latitude == null || longitude == null) {
      setDaily([])
      setCurrentTemp(null)
      setError(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    void fetchOpenMeteoForecast(latitude, longitude, calendarTimeZone)
      .then((d) => {
        if (cancelled) return
        setLoading(false)
        if (!d) {
          setError(t('dashboard.weather.loadError'))
          setDaily([])
          setCurrentTemp(null)
          return
        }
        setCurrentTemp(d.current.temperatureC)
        setCurrentCode(d.current.weatherCode)
        setCurrentHum(d.current.humidityPct)
        setCurrentWind(d.current.windKmh)
        setCurrentFeels(d.current.apparentTemperatureC)
        setDaily(d.daily.slice(0, 8))
      })
      .catch(() => {
        if (cancelled) return
        setLoading(false)
        setError(t('dashboard.weather.loadError'))
        setDaily([])
      })
    return (): void => {
      cancelled = true
    }
  }, [hasCoords, latitude, longitude, calendarTimeZone, t])

  const todayLabel = useMemo(() => {
    const first = daily[0]?.dateIso
    if (!first) return ''
    try {
      return format(parseISO(first), 'EEEE d. MMM', { locale: dfLocale })
    } catch {
      return first
    }
  }, [daily, dfLocale])

  const currentLabel = labelForCode(currentCode)

  if (!hasCoords) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-2 py-3 text-center">
        <p className={cn(chronellDashboardTileListMetaClass, 'leading-relaxed')}>
          {t('dashboard.weather.configureHint')}
        </p>
        <button
          type="button"
          onClick={(): void => requestOpenAccountSettings({ tab: 'general' })}
          className={cn(
            chronellDashboardTileListPrimaryClass,
            'rounded-md border border-border bg-secondary/60 px-2 py-1 hover:bg-secondary'
          )}
        >
          {t('dashboard.weather.openSettings')}
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border/50 px-2 py-1.5">
        {locationName ? (
          <div className={cn(chronellDashboardTileTitleClass, 'truncate')} title={locationName}>
            {locationName}
          </div>
        ) : null}
        <div className={chronellDashboardTileCaptionClass}>{t('dashboard.weather.todayHeading')}</div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-1.5">
        {loading ? (
          <div
            className={cn(
              chronellDashboardTileListMetaClass,
              'flex items-center justify-center gap-1.5 py-6'
            )}
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            {t('dashboard.loading.generic')}
          </div>
        ) : error ? (
          <div className={cn(chronellDashboardTileListMetaClass, 'py-3 text-center text-destructive')}>
            {error}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <WeatherCodeIcon
                code={currentCode}
                className="h-6 w-6"
                title={currentLabel}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
                  <span className={chronellDashboardTileWeatherTempClass}>
                    {currentTemp != null ? `${Math.round(currentTemp)}°` : '—'}
                  </span>
                  <span className={cn(chronellDashboardTileListMetaClass, 'truncate')}>
                    {currentLabel}
                  </span>
                </div>
                {currentFeels != null ? (
                  <div className={cn(chronellDashboardTileListMetaClass, 'mt-0.5')}>
                    {t('dashboard.weather.feelsLike', { temp: Math.round(currentFeels) })}
                  </div>
                ) : null}
              </div>
            </div>
            <div
              className={cn(
                chronellDashboardTileListMetaClass,
                'mt-1.5 flex flex-wrap gap-x-2.5 gap-y-0.5'
              )}
            >
              {currentHum != null ? (
                <span>{t('dashboard.weather.humidity', { pct: Math.round(currentHum) })}</span>
              ) : null}
              {currentWind != null ? (
                <span>{t('dashboard.weather.wind', { kmh: Math.round(currentWind) })}</span>
              ) : null}
            </div>
            {todayLabel ? (
              <div className={cn(chronellDashboardTileSubtitleClass, 'mt-1')}>{todayLabel}</div>
            ) : null}

            <div className={cn(chronellDashboardTileCaptionClass, 'mt-3')}>
              {t('dashboard.weather.weekHeading')}
            </div>
            <ul className="mt-1 space-y-0.5">
              {daily.slice(0, 7).map((d) => {
                let dayStr = d.dateIso
                try {
                  dayStr = format(parseISO(d.dateIso), 'EEE d.', { locale: dfLocale })
                } catch {
                  /* keep iso */
                }
                const rowLabel = labelForCode(d.weatherCode)
                return (
                  <li
                    key={d.dateIso}
                    className={cn(
                      chronellDashboardTileListMetaClass,
                      'flex items-center gap-1.5 rounded-md px-1 py-0.5'
                    )}
                  >
                    <span className="w-[3.25rem] shrink-0 tabular-nums">{dayStr}</span>
                    <WeatherCodeIcon
                      code={d.weatherCode}
                      className="h-3.5 w-3.5"
                      title={rowLabel}
                    />
                    <span className="min-w-0 flex-1 truncate" title={rowLabel}>
                      {rowLabel}
                    </span>
                    <span
                      className={cn(
                        chronellDashboardTileListPrimaryClass,
                        'shrink-0 tabular-nums'
                      )}
                    >
                      {Math.round(d.tempMaxC)}°/{Math.round(d.tempMinC)}°
                    </span>
                  </li>
                )
              })}
            </ul>
            <p className={cn(chronellDashboardTileListMetaClass, 'mt-2 opacity-80')}>
              <a
                href="https://open-meteo.com"
                target="_blank"
                rel="noreferrer noopener"
                className="underline-offset-2 hover:underline"
              >
                {t('dashboard.weather.attribution')}
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
