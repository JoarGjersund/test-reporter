export interface BehaveJson {
  stats: BehaveJsonStats
  passes: BehaveJsonTest[]
  pending: BehaveJsonTest[]
  failures: BehaveJsonTest[]
}

export interface BehaveJsonStats {
  duration: number
}

export interface BehaveJsonTest {
  title: string
  fullTitle: string
  file: string
  duration?: number
  err: BehaveJsonTestError
}

export interface BehaveJsonTestError {
  stack?: string
  message?: string
}
