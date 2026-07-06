declare module '@reatom/core' {
  interface RouteChild extends Element {}
}

declare global {
  interface ImportMetaEnv {
    readonly BASE_URL: string
    readonly DEV: boolean
    readonly MODE: string
    readonly PROD: boolean
    readonly RECORD_VIDEO: boolean
    readonly VITEST?: boolean
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv
  }
}

export {}
