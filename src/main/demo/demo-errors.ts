import { DEMO_READ_ONLY_ERROR_CODE } from '@shared/demo'

export class DemoReadOnlyError extends Error {
  readonly code = DEMO_READ_ONLY_ERROR_CODE

  constructor(message = 'Im Demo-Modus sind Schreibaktionen an Cloud-Diensten deaktiviert.') {
    super(message)
    this.name = 'DemoReadOnlyError'
  }
}
