export interface DemoStatus {
  active: boolean
  userDataPath: string
  packVersion: number | null
  scenario: string | null
  canReset: boolean
  canExit: boolean
}
