import { useEffect, useState } from 'react'

/** Windows: frameless Hauptfenster mit eigenem Titelleisten-Chrome im Renderer. */
export function useFramelessTitlebar(): boolean {
  const [frameless, setFrameless] = useState(false)

  useEffect(() => {
    void window.mailClient.app.getPlatform().then((platform) => {
      setFrameless(platform === 'win32')
    })
  }, [])

  return frameless
}
