/** Entkoppelt `config`/`profile-sync-service` vom Runner (vermeidet Zirkelimporte). */

type ProfileSyncRunnerApi = {
  start: () => void
  stop: () => void
  restart: () => void
}

let api: ProfileSyncRunnerApi | null = null

export function registerProfileSyncRunner(runner: ProfileSyncRunnerApi): void {
  api = runner
}

export function startProfileSyncRunner(): void {
  api?.start()
}

export function stopProfileSyncRunner(): void {
  api?.stop()
}

export function restartProfileSyncRunner(): void {
  api?.restart()
}
