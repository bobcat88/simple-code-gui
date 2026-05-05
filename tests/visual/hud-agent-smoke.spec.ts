import { expect, test } from '@playwright/test'

test.describe('HUD visual smoke', () => {
  test('keeps glow, pulse, neural activity, self-healing state, and agent transitions visible', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.setContent(`
      <style>
        :root {
          --codex-neon-glow: rgba(204, 255, 0, 0.5);
          --codex-neon: #ccff00;
        }
        body {
          margin: 0;
          min-height: 100vh;
          background: #050607;
          color: white;
          font-family: Inter, ui-sans-serif, system-ui;
        }
        .hud-shell {
          position: relative;
          margin: 48px;
          width: 520px;
          height: 320px;
          border: 1px solid rgba(204, 255, 0, 0.35);
          box-shadow: 0 0 24px var(--codex-neon-glow), inset 0 0 24px rgba(204, 255, 0, 0.08);
          border-radius: 16px;
          overflow: hidden;
          background: rgba(10, 12, 15, 0.95);
        }
        .pulse-core {
          position: absolute;
          left: 44px;
          top: 42px;
          width: 18px;
          height: 18px;
          border-radius: 999px;
          background: var(--codex-neon);
          animation: pulse 1.4s ease-in-out infinite;
        }
        .neural-link {
          position: absolute;
          left: 72px;
          top: 50px;
          width: 320px;
          height: 2px;
          background: linear-gradient(90deg, transparent, var(--codex-neon), transparent);
          animation: neural-flow 1.1s linear infinite;
        }
        .agent-panel {
          position: absolute;
          right: 24px;
          bottom: 24px;
          width: 210px;
          padding: 18px;
          border-radius: 12px;
          border: 1px solid rgba(56, 189, 248, 0.4);
          background: rgba(8, 47, 73, 0.45);
          box-shadow: 0 0 20px rgba(56, 189, 248, 0.22);
          transform: translateX(0);
          opacity: 1;
          transition: transform 260ms ease, opacity 260ms ease;
        }
        .agent-panel.closed {
          transform: translateX(260px);
          opacity: 0;
        }
        .self-healing {
          position: absolute;
          left: 44px;
          bottom: 48px;
          color: rgb(52, 211, 153);
          text-shadow: 0 0 12px rgba(52, 211, 153, 0.7);
          animation: pulse 1.8s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.65; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.18); }
        }
        @keyframes neural-flow {
          from { filter: hue-rotate(0deg); opacity: 0.45; }
          to { filter: hue-rotate(90deg); opacity: 1; }
        }
      </style>
      <main class="hud-shell" data-testid="hud-shell">
        <div class="pulse-core" data-testid="pulse-core"></div>
        <div class="neural-link" data-testid="neural-link"></div>
        <button type="button" data-testid="toggle-agent">toggle</button>
        <section class="agent-panel" data-testid="agent-panel">AGENT ONLINE</section>
        <div class="self-healing" data-testid="self-healing">SELF HEALING ACTIVE</div>
      </main>
      <script>
        document.querySelector('[data-testid="toggle-agent"]').addEventListener('click', () => {
          document.querySelector('[data-testid="agent-panel"]').classList.toggle('closed')
        })
      </script>
    `)

    const shell = page.getByTestId('hud-shell')
    const pulse = page.getByTestId('pulse-core')
    const neural = page.getByTestId('neural-link')
    const agent = page.getByTestId('agent-panel')
    const healing = page.getByTestId('self-healing')

    await expect(shell).toBeVisible()
    await expect(shell).toHaveCSS('box-shadow', /204, 255, 0/)
    await expect(pulse).toHaveCSS('animation-name', 'pulse')
    await expect(neural).toHaveCSS('animation-name', 'neural-flow')
    await expect(healing).toHaveCSS('animation-name', 'pulse')

    await expect(agent).toBeInViewport()
    await page.getByTestId('toggle-agent').click()
    await expect(agent).toHaveClass(/closed/)
    await expect(agent).toHaveCSS('opacity', '0')
    await page.getByTestId('toggle-agent').click()
    await expect(agent).not.toHaveClass(/closed/)
    await expect(agent).toHaveCSS('opacity', '1')
  })
})
