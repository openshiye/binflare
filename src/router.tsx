import { createRouter } from '@tanstack/react-router'
import { AppShellSkeleton } from './components/app-shell-skeleton'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPendingComponent: () => <AppShellSkeleton />,
    defaultPendingMs: 0,
  })
}
