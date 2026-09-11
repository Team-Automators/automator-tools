import { lazy } from 'react'

// Single source of truth for the code-split page components. Each is lazy (its
// own chunk, loaded on demand) but also carries a .preload() so we can fetch the
// chunk BEFORE the user navigates — on link hover/focus, or on idle — which makes
// switching pages feel instant (the Next.js "prefetch" behavior, on React Router).
function withPreload(factory) {
  const Component = lazy(factory)
  Component.preload = factory   // import() dedupes, so calling this repeatedly is cheap
  return Component
}

export const Dashboard       = withPreload(() => import('./pages/Dashboard.jsx'))
export const CopywritersList = withPreload(() => import('./pages/CopywritersList.jsx'))
export const CopywritersChat = withPreload(() => import('./pages/CopywritersChat.jsx'))
export const Library         = withPreload(() => import('./pages/Library.jsx'))
export const CustomerDetail  = withPreload(() => import('./pages/CustomerDetail.jsx'))
export const LibraryChat     = withPreload(() => import('./pages/LibraryChat.jsx'))
export const Settings        = withPreload(() => import('./pages/Settings.jsx'))
export const Tasks           = withPreload(() => import('./pages/Tasks.jsx'))
export const Hooks           = withPreload(() => import('./pages/Hooks.jsx'))
export const Workflows       = withPreload(() => import('./pages/Workflows.jsx'))
export const Archive         = withPreload(() => import('./pages/Archive.jsx'))
export const Analyzer        = withPreload(() => import('./pages/Analyzer.jsx'))
export const FunnelArchitect = withPreload(() => import('./pages/FunnelArchitect.jsx'))
export const Pipeline        = withPreload(() => import('./pages/Pipeline.jsx'))
export const Admin           = withPreload(() => import('./pages/Admin.jsx'))

// Prefetch by nav key (used on hover/focus of a sidebar link) — pull in the
// chunks the user is most likely to open next, including the detail/chat pages
// reached from each section.
export const prefetchByKey = {
  dashboard:   () => Dashboard.preload(),
  copywriters: () => { CopywritersList.preload(); CopywritersChat.preload() },
  library:     () => { Library.preload(); CustomerDetail.preload(); LibraryChat.preload() },
  architect:   () => FunnelArchitect.preload(),
  website:     () => FunnelArchitect.preload(),
  hooks:       () => Hooks.preload(),
  tasks:       () => Tasks.preload(),
  pipeline:    () => Pipeline.preload(),
  archive:     () => Archive.preload(),
  analyzer:    () => Analyzer.preload(),
  workflows:   () => Workflows.preload(),
  admin:       () => Admin.preload(),
  settings:    () => Settings.preload(),
}

// Warm every page chunk in the background (called on idle after first paint) so
// any navigation is instant, without delaying the initial render.
export function prefetchAll() {
  ;[Dashboard, CopywritersList, CopywritersChat, Library, CustomerDetail, LibraryChat,
    Settings, Tasks, Hooks, Workflows, Archive, Analyzer, FunnelArchitect, Pipeline, Admin]
    .forEach(c => { try { c.preload() } catch {} })
}
