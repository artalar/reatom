import { AppShell } from './components/AppShell'
import { FilterPanel } from './components/FilterPanel'
import { GalleryBootstrap } from './components/GalleryBootstrap'
import { GalleryWorkspace } from './components/GalleryWorkspace'
import { ImageInfoPanel } from './components/ImageInfoPanel'
import { Lightbox } from './components/Lightbox'
import { RestoreSelectedFolder } from './components/RestoreSelectedFolder'
import { SettingsPanel } from './components/SettingsPanel'
import { Toolbar } from './components/Toolbar'
import { KeyboardShortcuts } from './shortcuts'

export const App = () => (
  <AppShell>
    <GalleryBootstrap />
    <RestoreSelectedFolder />
    <KeyboardShortcuts />
    <Toolbar />
    <GalleryWorkspace />
    <Lightbox />
    <SettingsPanel />
    <FilterPanel />
    <ImageInfoPanel />
  </AppShell>
)
