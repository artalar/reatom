declare module 'gallery-app/setup'

declare module 'gallery-app/App' {
  export const App: () => JSX.Element
}

declare module 'gallery-app/__fixtures__/mockData' {
  export const mockFolderTree: unknown
  export const mockEmptyFolder: unknown
  export const fixtureFolderTree: unknown
}

declare module 'gallery-app/shared/testSetup' {
  export function loadGalleryState(options: {
    tree: unknown
    currentFolderNode?: unknown
  }): void
  export function loadEmptyState(): void
}
