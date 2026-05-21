/** Entkoppelt `config`/`index` vom Mail-Body-Index-Modul (vermeidet Zirkelimporte und nutzlose dynamic imports). */

type MailBodyIndexRunnerApi = {
  start: () => void
  stop: () => void
  restart: () => void
}

let api: MailBodyIndexRunnerApi | null = null

export function registerMailBodyIndexRunner(runner: MailBodyIndexRunnerApi): void {
  api = runner
}

export function startMailBodyIndexRunner(): void {
  api?.start()
}

export function stopMailBodyIndexRunner(): void {
  api?.stop()
}

export function restartMailBodyIndexRunner(): void {
  api?.restart()
}
