In general Config, app does not remember settings (no local save ? )

je ne peux toujours pas déplacer la fenetre . 

je ne vois toujours pas de terminal "IA" ouvert ou s'afficher, donc pas de chat possible avec claude/Codex CLI 

Batch erreur: 
window.electronAPI?.onInstallProgress is not a function. (In 'window.electronAPI?.onInstallProgress((data) => {
      if (data.type === "python") {
        const percent = data.percent !== void 0 ? ` (${data.percent}%)` : "";
        setBeadsState((prev) => {
          if (prev.status !== "not_installed") return prev;
          return { ...prev, installStatus: `${data.status}${percent}` };
        });
      }
    })', 'window.electronAPI?.onInstallProgress' is undefined)

BeadsPanel@http://localhost:1420/src/renderer/components/beads/BeadsPanel.tsx:37:14
div
div
div
div
SidebarContent@http://localhost:1420/src/renderer/components/sidebar/SidebarContent.tsx:54:12
div
div
SidebarDesktop@http://localhost:1420/src/renderer/components/sidebar/SidebarDesktop.tsx:20:90
Sidebar@http://localhost:1420/src/renderer/components/sidebar/Sidebar.tsx:29:11
div
div
div
div
div
MainApp@http://localhost:1420/src/renderer/App/MainApp.tsx:44:30
AppConnection@http://localhost:1420/src/renderer/App/AppConnection.tsx:34:12
App
ModalProvider@http://localhost:1420/src/renderer/contexts/ModalContext.tsx:21:5
VoiceProvider@http://localhost:1420/src/renderer/contexts/VoiceContext/VoiceProvider.tsx:23:5
QueryClientProvider@http://localhost:1420/node_modules/.vite/deps/@tanstack_react-query.js:3194:9
ErrorBoundary@http://localhost:1420/src/renderer/components/ErrorBoundary.tsx:7:10


Erreur 2
dans terminal : [MCP filesystem STDERR] Client does not support MCP Roots, using allowed directories set from server args: [
[MCP filesystem STDERR]   '/home/_johan',
[MCP filesystem STDERR]   '/home/_johan/Documents/Borg',
[MCP filesystem STDERR]   '/home/_johan/Documents/Projects'
[MCP filesystem STDERR] ]


je ne vois toujours pas de terminal 'IA" s'afficher, pas de chat possible avec claude/Codex CLI 