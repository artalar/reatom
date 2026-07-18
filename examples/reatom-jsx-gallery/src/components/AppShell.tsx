import type { JSX } from '@reatom/jsx'

import { srOnlyCss } from '../a11y'
import { resolvedThemeMode, themePack } from '../model'
import { activeThemeVariables, GlobalStyles } from '../theme'
import { GlassFilters } from './GlassFilters'

export const AppShell = ({ children }: { children: JSX.ElementChildren }) => (
  <div
    attr:data-theme-pack={themePack}
    attr:data-theme-mode={resolvedThemeMode}
    style={() => activeThemeVariables()}
    css={`
      display: flex;
      flex-direction: column;
      height: 100vh;
      background: var(--bg-primary);
      background-image: var(--app-bg-image);
      background-size: var(--bg-size);
      color: var(--text-primary);
      font-family: var(--font-ui);
      overflow: hidden;
      transition:
        background 0.3s,
        color 0.3s;

      &[data-theme-pack='blueprint'] button,
      &[data-theme-pack='blueprint'] input {
        border-style: dashed;
      }

      &[data-theme-pack='blueprint'][data-theme-mode='light'] main {
        background-color: #eaf8ff;
        background-image:
          linear-gradient(rgba(2, 132, 168, 0.12) 1px, transparent 1px),
          linear-gradient(90deg, rgba(2, 132, 168, 0.12) 1px, transparent 1px);
        background-size: 28px 28px;
      }

      &[data-theme-pack='neon'] button,
      &[data-theme-pack='neon'] input {
        box-shadow: var(--glow);
      }

      &[data-theme-pack='neon'][data-theme-mode='light'] main {
        background-color: var(--bg-primary);
        background-image: var(--app-bg-image);
      }

      &[data-theme-pack='terminal'] {
        letter-spacing: 0.01em;
      }

      &[data-theme-pack='terminal'][data-theme-mode='light'] main {
        background-color: #f4f6ef;
        background-image:
          linear-gradient(rgba(15, 107, 58, 0.055) 50%, transparent 50%),
          linear-gradient(90deg, rgba(15, 107, 58, 0.03) 1px, transparent 1px);
        background-size:
          100% 4px,
          22px 22px;
      }

      &[data-theme-pack='terminal'] button,
      &[data-theme-pack='terminal'] input {
        border-radius: 0;
      }

      &[data-theme-pack='terminal'] button {
        letter-spacing: 0.04em;
        box-shadow: inset 0 0 0 1px var(--input-bg);
      }

      &[data-theme-pack='terminal'] button[data-terminal-bracket='true'] {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.25em;
      }

      &[data-theme-pack='terminal']
        button[data-terminal-bracket='true']::before {
        content: '[';
        color: var(--text-muted);
      }

      &[data-theme-pack='terminal']
        button[data-terminal-bracket='true']::after {
        content: ']';
        color: var(--text-muted);
      }

      &[data-theme-pack='bauhaus'] button {
        box-shadow: var(--glow);
      }

      &[data-theme-pack='bauhaus'] button:hover {
        box-shadow: var(--card-hover-shadow);
      }

      &[data-theme-pack='bauhaus'] main {
        background-image: var(--app-bg-image);
        background-size: var(--bg-size);
        padding: calc(20px + var(--shadow-clearance, 0px))
          calc(24px + var(--shadow-clearance, 0px));
      }

      &[data-theme-pack='bauhaus'][data-theme-mode='light'] main {
        background-color: #fff1b8;
        background-image: var(--app-bg-image);
      }

      &[data-theme-pack='obsidian'] button,
      &[data-theme-pack='obsidian'] input {
        clip-path: var(--surface-clip-path);
      }

      &[data-theme-pack='obsidian'][data-theme-mode='light'] main {
        background-color: #e7e9ee;
        background-image:
          linear-gradient(135deg, rgba(15, 23, 42, 0.12), transparent 26%),
          linear-gradient(315deg, rgba(71, 85, 105, 0.12), transparent 24%);
      }

      &[data-theme-pack='paper'][data-theme-mode='light'] main {
        background-color: #f5ecd9;
        background-image:
          radial-gradient(
            circle at 20% 30%,
            rgba(42, 33, 23, 0.055) 0 1px,
            transparent 1px
          ),
          linear-gradient(
            90deg,
            rgba(42, 33, 23, 0.025),
            transparent 40%,
            rgba(42, 33, 23, 0.025)
          );
        background-size:
          22px 22px,
          auto;
      }

      &[data-theme-pack='polaroid'][data-theme-mode='light'] main {
        background-color: #eadfcf;
        background-image: radial-gradient(
          circle at 50% 10%,
          rgba(255, 255, 255, 0.44),
          transparent 34%
        );
      }

      &[data-theme-pack='blueprint'][data-theme-mode='light'] {
        background-color: #eaf8ff;
        background-image:
          linear-gradient(rgba(2, 132, 168, 0.12) 1px, transparent 1px),
          linear-gradient(90deg, rgba(2, 132, 168, 0.12) 1px, transparent 1px);
        background-size: 28px 28px;
        font-family: 'IBM Plex Mono', 'SFMono-Regular', Consolas, monospace;
      }

      &[data-theme-pack='neon'][data-theme-mode='light'] {
        background-color: var(--bg-primary);
        background-image: var(--app-bg-image);
        font-family: 'Inter', system-ui, sans-serif;
      }

      &[data-theme-pack='paper'][data-theme-mode='light'] {
        background-color: #f5ecd9;
        background-image:
          radial-gradient(
            circle at 20% 30%,
            rgba(42, 33, 23, 0.055) 0 1px,
            transparent 1px
          ),
          linear-gradient(
            90deg,
            rgba(42, 33, 23, 0.025),
            transparent 40%,
            rgba(42, 33, 23, 0.025)
          );
        background-size:
          22px 22px,
          auto;
        font-family: Georgia, 'Times New Roman', serif;
      }

      &[data-theme-pack='bauhaus'][data-theme-mode='light'] {
        background-color: #fff1b8;
        background-image: var(--app-bg-image);
        font-family: Arial, Helvetica, sans-serif;
      }

      &[data-theme-pack='polaroid'][data-theme-mode='light'] {
        background-color: #eadfcf;
        background-image: radial-gradient(
          circle at 50% 10%,
          rgba(255, 255, 255, 0.44),
          transparent 34%
        );
      }

      &[data-theme-pack='glass'][data-theme-mode='light'] main,
      &[data-theme-pack='glass'][data-theme-mode='dark'] main {
        background-color: var(--bg-primary);
        background-image:
          radial-gradient(
            circle at top right,
            var(--hero-glow-2),
            transparent 34%
          ),
          radial-gradient(
            circle at 12% 18%,
            var(--hero-glow-1),
            transparent 38%
          ),
          var(--app-bg-image);
        background-size: auto, auto, var(--bg-size);
      }

      &[data-theme-pack='glass'][data-theme-mode='light'] {
        background-color: #d9ecf4;
        background-image:
          radial-gradient(
            circle at 18% 20%,
            rgba(14, 116, 144, 0.24),
            transparent 36%
          ),
          radial-gradient(
            circle at 82% 8%,
            rgba(109, 40, 217, 0.18),
            transparent 32%
          );
      }

      &[data-theme-pack='glass'] header,
      &[data-theme-pack='glass'] aside[role='dialog'] {
        border-color: var(--glass-rim);
        box-shadow:
          var(--glow),
          -20px 0 56px var(--shadow-strong);
      }

      &[data-theme-pack='glass'] header {
        box-shadow:
          var(--glow),
          0 14px 36px var(--shadow);
      }

      &[data-theme-pack='glass'] aside[role='dialog'] {
        box-shadow:
          -24px 0 64px var(--shadow-strong),
          inset 1px 0 0 var(--glass-rim-strong);
      }

      &[data-theme-pack='glass'] .glass-lens {
        position: relative;
        overflow: hidden;
        isolation: isolate;
      }

      &[data-theme-pack='glass'] .glass-lens::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        background: var(--glass-refraction-target);
        filter: url(#glass-pill);
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.15s ease;
      }

      &[data-theme-pack='glass'] .glass-lens::after {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        background: var(--glass-specular);
        box-shadow: var(--glass-lens-shadow);
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.15s ease;
      }

      &[data-theme-pack='glass'] .glass-lens > * {
        position: relative;
        z-index: 1;
      }

      &[data-theme-pack='glass'] .glass-lens[aria-pressed='true'],
      &[data-theme-pack='glass'] .glass-lens[data-active='true'] {
        color: var(--accent-contrast);
        border-color: var(--accent);
        background: linear-gradient(
          135deg,
          var(--accent),
          var(--accent-hover)
        );
        box-shadow: var(--glow);
      }

      &[data-theme-pack='glass'] .glass-lens[aria-pressed='true']::before,
      &[data-theme-pack='glass'] .glass-lens[data-active='true']::before,
      &[data-theme-pack='glass'] .glass-lens[aria-pressed='true']::after,
      &[data-theme-pack='glass'] .glass-lens[data-active='true']::after {
        opacity: 0.55;
      }

      &[data-theme-pack='glass'] [data-glass-toggle] {
        background: var(--input-bg);
        border-color: var(--glass-rim);
        box-shadow: inset 0 1px 0 var(--glass-rim-strong);
      }

      &[data-theme-pack='glass'] [data-glass-toggle]::after {
        background: var(--glass-refraction-target);
        filter: url(#glass-toggle);
        box-shadow: var(--glass-lens-shadow);
        border: 1px solid var(--glass-rim-strong);
      }

      &[data-theme-pack='glass'] [data-glass-toggle][data-on='true'] {
        background: var(--accent-soft);
        border-color: var(--accent);
      }

      &[data-theme-pack='glass'] [data-glass-toggle][data-on='true']::after {
        background: linear-gradient(
          135deg,
          var(--accent),
          var(--accent-hover)
        );
      }

      &[data-theme-pack='glass'] .glass-card[data-selected='true'] {
        box-shadow: var(--selected-shadow);
      }

      &[data-theme-pack='glass'] .glass-overlay-control {
        position: relative;
        overflow: hidden;
        isolation: isolate;
        backdrop-filter: var(--panel-backdrop-filter);
        border-color: var(--glass-rim) !important;
        box-shadow: var(--glass-lens-shadow);
      }

      &[data-theme-pack='glass'] .glass-overlay-control::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        background: var(--glass-specular);
        pointer-events: none;
      }

      &[data-theme-pack='glass'] .glass-overlay-control > * {
        position: relative;
        z-index: 1;
      }

      &[data-theme-pack='glass'] .lightbox-control-layer button,
      &[data-theme-pack='glass'] .slideshow-controls button {
        backdrop-filter: var(--panel-backdrop-filter);
        border-color: var(--glass-rim) !important;
        box-shadow: var(--glass-lens-shadow);
      }
    `}
  >
    <a
      href="#gallery-main"
      css={`
        ${srOnlyCss}
        &:focus {
          position: fixed;
          top: 12px;
          left: 12px;
          z-index: 2000;
          width: auto;
          height: auto;
          margin: 0;
          padding: 10px 14px;
          clip: auto;
          overflow: visible;
          white-space: nowrap;
          background: var(--accent);
          color: var(--accent-contrast);
          border-radius: var(--radius-sm);
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          box-shadow: var(--glow);
        }
      `}
    >
      Skip to gallery
    </a>
    <GlassFilters />
    <GlobalStyles />
    <style>
      {`
        body {
          margin: 0;
          background-color: var(--bg-primary);
          background-image: var(--app-bg-image);
          background-size: var(--bg-size);
          font-family: var(--font-ui);
        }
        *, *::before, *::after { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb {
          background: var(--scrollbar-thumb);
          border-radius: var(--radius-round);
        }
        @keyframes lightbox-enter {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}
    </style>
    {children}
  </div>
)
