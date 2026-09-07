import type { Computed } from '@reatom/core'
import {
  type CheckboxControlProps,
  type RadioItemProps,
  checkboxProps,
} from '@reatom/ux'

import {
  developRawFullSizeCheckbox,
  gridColumns,
  gridColumnsLabel,
  gridGapRadio,
  ignoreExifOrientationCheckbox,
  imageFitRadio,
  keepLightboxViewCheckbox,
  showFileSizesCheckbox,
  showImageNamesCheckbox,
  showLightboxScrubberCheckbox,
  themeModeRadio,
  themePackRadio,
  wrapFolderNavigationCheckbox,
} from '../model'
import { THEME_PACKS } from '../theme'
import type { GridGap, ImageFit } from '../types'
import { CloseIcon } from './Icons'
import { settingsPanelOpen } from './panelState'
import { radioButtonProps } from './uxProps'

const GAP_OPTIONS: GridGap[] = ['none', 'small', 'medium', 'large', 'xl']
const FIT_OPTIONS: ImageFit[] = ['contain', 'cover', 'fill', 'none']

const SectionTitle = ({ text }: { text: string }) => (
  <h3
    css={`
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-secondary);
      margin-bottom: 8px;
      margin-top: 16px;
    `}
  >
    {text}
  </h3>
)

const OptionButton = ({
  label,
  props,
  isActive,
}: {
  label: string
  props: Computed<RadioItemProps>
  isActive: () => boolean
}) => (
  <button
    $spread={radioButtonProps(props)}
    type="button"
    class="glass-lens"
    attr:data-active={isActive}
    data-terminal-bracket="true"
    css={`
      padding: 6px 12px;
      border: var(--border-width) var(--control-border-style) var(--border);
      border-radius: var(--radius-sm);
      background: var(--bg-secondary);
      background-image: var(--surface-bg-image);
      background-size: var(--surface-bg-size);
      color: var(--text-primary);
      font-size: 12px;
      transition: all 0.15s;
      white-space: nowrap;
      text-transform: var(--control-transform);

      &:hover {
        border-color: var(--accent);
        color: var(--accent);
      }

      &[data-active='true'] {
        background: var(--accent);
        border-color: var(--accent);
        color: var(--accent-contrast);
      }
    `}
  >
    {label}
  </button>
)

const ToggleSwitch = ({
  label,
  control,
}: {
  label: string
  control: Computed<CheckboxControlProps>
}) => (
  <label
    css={`
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 0;
      cursor: pointer;
      font-size: 13px;
      color: var(--text-primary);
    `}
  >
    <span>{label}</span>
    <input
      $spread={control}
      data-glass-toggle="true"
      css={`
        appearance: none;
        --toggle-width: 40px;
        --toggle-height: 22px;
        --toggle-knob-size: 18px;
        --toggle-inset: max(
          1px,
          calc(
            (var(--toggle-height) - var(--toggle-knob-size)) /
              2 - var(--border-width)
          )
        );
        width: var(--toggle-width);
        height: var(--toggle-height);
        border-radius: var(--radius-round);
        background: var(--bg-tertiary);
        border: var(--border-width) var(--control-border-style) var(--border);
        position: relative;
        transition: background 0.2s;
        cursor: pointer;

        &::after {
          content: '';
          position: absolute;
          top: 50%;
          left: var(--toggle-inset);
          width: var(--toggle-knob-size);
          height: var(--toggle-knob-size);
          border-radius: var(--radius-round);
          background: var(--accent-contrast);
          box-shadow: 0 2px 6px var(--shadow);
          transform: translateY(-50%);
          transition: transform 0.2s;
        }

        &:checked {
          background: var(--accent);
        }

        &:checked::after {
          transform: translate(
            calc(
              var(--toggle-width) - var(--toggle-knob-size) - var(
                  --toggle-inset
                ) - var(--toggle-inset) - var(--border-width) - var(
                  --border-width
                )
            ),
            -50%
          );
        }
      `}
    />
  </label>
)

const ThemePackButton = ({
  props,
  isActive,
  label,
  description,
  swatches,
}: {
  props: Computed<RadioItemProps>
  isActive: () => boolean
  label: string
  description: string
  swatches: readonly [string, string, string]
}) => (
  <button
    $spread={radioButtonProps(props)}
    type="button"
    class="glass-lens"
    attr:data-active={isActive}
    css={`
      width: 100%;
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 10px;
      align-items: center;
      text-align: left;
      padding: 10px;
      border: var(--border-width) var(--control-border-style) var(--border);
      border-radius: var(--radius-md);
      background: var(--input-bg);
      background-image: var(--surface-bg-image);
      background-size: var(--surface-bg-size);
      color: var(--text-primary);
      transition: all 0.15s ease;

      &:hover {
        border-color: var(--accent);
        background: var(--hover-bg);
      }

      &[data-active='true'] {
        border-color: var(--accent);
        background: var(--active-bg);
        box-shadow:
          0 0 0 3px var(--focus-ring),
          var(--glow);
      }
    `}
  >
    <span css="display: flex; gap: 3px;">
      {swatches.map((color) => (
        <span
          style={{ background: color }}
          css={`
            width: 14px;
            height: 32px;
            border-radius: var(--radius-sm);
            border: var(--border-width) var(--border-style) var(--card-border);
          `}
        />
      ))}
    </span>
    <span css="display: grid; gap: 2px;">
      <span css="font-size: 13px; font-weight: 700;">{label}</span>
      <span css="font-size: 11px; color: var(--text-muted);">
        {description}
      </span>
    </span>
  </button>
)

const ThemeModeButton = ({
  props,
  isActive,
  label,
}: {
  props: Computed<RadioItemProps>
  isActive: () => boolean
  label: string
}) => (
  <button
    $spread={radioButtonProps(props)}
    type="button"
    class="glass-lens"
    attr:data-active={isActive}
    css={`
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 8px 12px;
      border: var(--border-width) var(--control-border-style) var(--border);
      border-radius: var(--radius-sm);
      background: var(--input-bg);
      color: var(--text-primary);
      font-size: 12px;
      font-weight: 700;
      transition: all 0.15s ease;
      text-transform: var(--control-transform);

      &:hover {
        border-color: var(--accent);
        background: var(--hover-bg);
      }

      &[data-active='true'] {
        border-color: var(--accent);
        background: var(--accent);
        color: var(--accent-contrast);
        box-shadow:
          var(--glow),
          0 8px 20px var(--shadow);
      }

      &[data-active='true'] .theme-mode-dot {
        background: currentColor;
      }
    `}
  >
    <span
      class="theme-mode-dot"
      css={`
        width: 7px;
        height: 7px;
        border-radius: var(--radius-round);
        background: var(--text-muted);
        flex-shrink: 0;
      `}
    />
    {label}
  </button>
)

const showImageNamesProps = checkboxProps(showImageNamesCheckbox)
const showFileSizesProps = checkboxProps(showFileSizesCheckbox)
const ignoreExifOrientationProps = checkboxProps(ignoreExifOrientationCheckbox)
const developRawFullSizeProps = checkboxProps(developRawFullSizeCheckbox)
const wrapFolderNavigationProps = checkboxProps(wrapFolderNavigationCheckbox)
const keepLightboxViewProps = checkboxProps(keepLightboxViewCheckbox)
const showLightboxScrubberProps = checkboxProps(showLightboxScrubberCheckbox)

export const SettingsPanel = () => (
  <aside
    $spread={settingsPanelOpen.props.content}
    aria-hidden={() => !settingsPanelOpen()}
    prop:inert={() => !settingsPanelOpen()}
    css={`
      position: fixed;
      top: 0;
      right: 0;
      width: 320px;
      height: 100vh;
      background: var(--bg-secondary);
      border-left: var(--border-width) var(--border-style) var(--border);
      z-index: 1000;
      transform: translateX(100%);
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      overflow-y: auto;
      padding: 20px calc(20px + var(--shadow-clearance, 0px))
        calc(20px + var(--shadow-clearance, 0px)) 20px;
      box-shadow: -18px 0 48px var(--shadow-strong);
      background-color: var(--panel-bg);
      background-image: var(--surface-bg-image);
      background-size: var(--surface-bg-size);
      backdrop-filter: var(--panel-backdrop-filter);
      clip-path: var(--surface-clip-path);

      &[data-open='true'] {
        transform: translateX(0);
      }
    `}
  >
    <div
      css={`
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;
      `}
    >
      <h2
        $spread={settingsPanelOpen.props.heading}
        css={`
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
        `}
      >
        Settings
      </h2>
      <button
        $spread={settingsPanelOpen.props.dismiss}
        aria-label="Close settings"
        css={`
          width: 28px;
          height: 28px;
          border: var(--border-width) var(--control-border-style) transparent;
          border-radius: var(--radius-sm);
          background: var(--bg-tertiary);
          color: var(--text-primary);
          font-size: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s;

          &:hover {
            background: var(--accent);
            color: var(--accent-contrast);
          }
        `}
      >
        <CloseIcon />
      </button>
    </div>

    <SectionTitle text="Grid Columns" />
    <div
      css={`
        display: flex;
        align-items: center;
        gap: 12px;
      `}
    >
      <input
        type="range"
        min="0"
        max="12"
        step="1"
        aria-label="Grid columns"
        model:valueAsNumber={gridColumns}
        css={`
          flex: 1;
          accent-color: var(--accent);
        `}
      />
      <span
        css={`
          font-size: 13px;
          color: var(--text-secondary);
          min-width: 32px;
          text-align: center;
        `}
      >
        {gridColumnsLabel}
      </span>
    </div>

    <SectionTitle text="Grid Gap" />
    <div
      $spread={gridGapRadio.props.group}
      aria-label="Grid gap"
      css={`
        display: flex;
        flex-wrap: wrap;
        gap: calc(6px + var(--shadow-clearance, 0px));
      `}
    >
      {GAP_OPTIONS.map((gap) => {
        const item = gridGapRadio.item(gap)
        return (
          <OptionButton
            label={gap}
            props={gridGapRadio.props.item(item)}
            isActive={item.checked}
          />
        )
      })}
    </div>

    <SectionTitle text="Image Fit" />
    <div
      $spread={imageFitRadio.props.group}
      aria-label="Image fit"
      css={`
        display: flex;
        flex-wrap: wrap;
        gap: calc(6px + var(--shadow-clearance, 0px));
      `}
    >
      {FIT_OPTIONS.map((fit) => {
        const item = imageFitRadio.item(fit)
        return (
          <OptionButton
            label={fit}
            props={imageFitRadio.props.item(item)}
            isActive={item.checked}
          />
        )
      })}
    </div>

    <SectionTitle text="UI Options" />
    <ToggleSwitch
      label="Show Image Names"
      control={showImageNamesProps.control}
    />
    <ToggleSwitch
      label="Show File Sizes"
      control={showFileSizesProps.control}
    />
    <ToggleSwitch
      label="Ignore EXIF Orientation"
      control={ignoreExifOrientationProps.control}
    />
    <ToggleSwitch
      label="Develop RAW at Full Size"
      control={developRawFullSizeProps.control}
    />

    <SectionTitle text="Lightbox Navigation" />
    <ToggleSwitch
      label="Wrap at Folder Ends"
      control={wrapFolderNavigationProps.control}
    />
    <ToggleSwitch
      label="Keep Zoom While Navigating"
      control={keepLightboxViewProps.control}
    />
    <ToggleSwitch
      label="Show Folder Scrubber"
      control={showLightboxScrubberProps.control}
    />

    <SectionTitle text="Theme" />
    <div
      $spread={themePackRadio.props.group}
      aria-label="Theme pack"
      css="display: grid; gap: calc(8px + var(--shadow-clearance, 0px));"
    >
      {THEME_PACKS.map((pack) => {
        const item = themePackRadio.item(pack.value)
        return (
          <ThemePackButton
            props={themePackRadio.props.item(item)}
            isActive={item.checked}
            label={pack.label}
            description={pack.description}
            swatches={pack.swatches}
          />
        )
      })}
    </div>

    <div
      $spread={themeModeRadio.props.group}
      aria-label="Theme mode"
      css={`
        display: flex;
        gap: calc(6px + var(--shadow-clearance, 0px));
        margin-top: calc(10px + var(--shadow-clearance, 0px));
      `}
    >
      {(['light', 'dark', 'system'] as const).map((mode) => {
        const item = themeModeRadio.item(mode)
        return (
          <ThemeModeButton
            props={themeModeRadio.props.item(item)}
            isActive={item.checked}
            label={mode[0]!.toUpperCase() + mode.slice(1)}
          />
        )
      })}
    </div>
  </aside>
)
