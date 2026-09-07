import {
  imageInfoPanelExpanded,
  imageInfoPanelOpen,
  inspectedImage,
  inspectionCameraHudRows,
  inspectionContextLabel,
  inspectionExifRows,
} from '../model'
import { CloseIcon } from './Icons'

const infoRowCss = `
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
  gap: 12px;
`

const labelCss = `
  color: var(--text-muted);
  font-size: 12px;
  flex-shrink: 0;
  min-width: 70px;
`

const valueCss = `
  color: var(--text-primary);
  font-size: 13px;
  text-align: right;
  word-break: break-all;
  min-width: 0;
`

const panelHeaderCss = `
  margin-bottom: 16px;
  padding-right: 40px;
`

const panelCloseButtonCss = `
  position: sticky;
  top: 12px;
  z-index: 1;
  margin: 0 0 -28px auto;
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
  cursor: pointer;

  &:hover {
    background: var(--accent);
    color: var(--accent-contrast);
  }
`

export const ImageInfoPanel = () => (
  <div css="position: fixed; right: 0; top: 0; bottom: 0; z-index: 1050; pointer-events: none;">
    <aside
      $spread={imageInfoPanelOpen.props.content}
      role="complementary"
      aria-label="Image details"
      data-open={imageInfoPanelExpanded}
      aria-hidden={() => !imageInfoPanelExpanded()}
      prop:inert={() => !imageInfoPanelExpanded()}
      css={`
        position: absolute;
        right: 0;
        top: 0;
        bottom: 0;
        width: 300px;
        background-color: var(--panel-bg);
        background-image: var(--surface-bg-image);
        background-size: var(--surface-bg-size);
        border-left: var(--border-width) var(--border-style) var(--border);
        backdrop-filter: var(--panel-backdrop-filter);
        padding: 20px 16px;
        overflow-y: auto;
        pointer-events: auto;
        transform: translateX(100%);
        visibility: hidden;
        transition:
          transform 0.3s ease,
          visibility 0s linear 0.3s;
        box-shadow: -18px 0 48px var(--shadow-strong);
        clip-path: var(--surface-clip-path);
        &[data-open='true'] {
          transform: translateX(0);
          visibility: visible;
          transition: transform 0.3s ease;
        }
      `}
    >
      <button
        type="button"
        on:click={imageInfoPanelOpen.hide}
        css={panelCloseButtonCss}
        title="Close details"
        aria-label="Close details"
      >
        <CloseIcon />
      </button>

      <div css={panelHeaderCss}>
        <div>
          <div css="font-size: 15px; font-weight: 750; color: var(--text-primary);">
            Image Details
          </div>
          <div css="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
            {inspectionContextLabel}
          </div>
        </div>
      </div>

      <div style:display={() => (inspectedImage() ? 'block' : 'none')}>
        <InfoRow
          label="Filename"
          value={() => inspectedImage()?.source.name ?? ''}
        />
        <InfoRow
          label="Path"
          value={() => {
            const source = inspectedImage()?.source
            return source ? source.relativePath || source.path : ''
          }}
        />
        <InfoRow
          label="Size"
          value={() => inspectedImage()?.display.sizeLabel() ?? ''}
        />
        <InfoRow
          label="Dimensions"
          value={() => inspectedImage()?.display.dimensionsLabel() ?? ''}
        />
        <InfoRow
          label="Type"
          value={() => inspectedImage()?.display.typeLabel() ?? ''}
        />
        <InfoRow
          label="Modified"
          value={() => inspectedImage()?.display.lastModifiedLabel() ?? ''}
        />
        <InfoRow
          label="Format"
          value={() => {
            const image = inspectedImage()
            if (!image) return ''

            const imageFormat = image.meta.data()?.format
            if (imageFormat) return imageFormat.toUpperCase()

            return image.meta.pending() ? 'Loading…' : 'Unavailable'
          }}
        />
        <InfoRow
          label="EXIF thumb"
          value={() => {
            const image = inspectedImage()
            if (!image) return ''

            const meta = image.meta.data()
            if (!meta) return image.meta.pending() ? 'Loading…' : 'Unavailable'

            return meta.hasExifThumbnail ? 'Yes' : 'No'
          }}
        />

        <div
          style:display={() =>
            inspectionCameraHudRows().length > 0 ? 'block' : 'none'
          }
        >
          <div css="font-size: 12px; font-weight: 700; color: var(--text-secondary); margin: 16px 0 8px; text-transform: uppercase; letter-spacing: 0.04em;">
            Camera
          </div>
          {() =>
            inspectionCameraHudRows().map((row) => (
              <CameraRow label={row.label} value={row.value} href={row.href} />
            ))
          }
        </div>

        <div
          style:display={() =>
            inspectionExifRows().length > 0 ? 'block' : 'none'
          }
        >
          <div css="font-size: 12px; font-weight: 700; color: var(--text-secondary); margin: 16px 0 8px; text-transform: uppercase; letter-spacing: 0.04em;">
            EXIF
          </div>
          {() =>
            inspectionExifRows().map(([label, value]) => (
              <InfoRow label={label} value={() => value} />
            ))
          }
        </div>
      </div>
    </aside>
  </div>
)

const InfoRow = ({ label, value }: { label: string; value: () => string }) => (
  <div css={infoRowCss}>
    <span css={labelCss}>{label}</span>
    <span css={valueCss}>{value}</span>
  </div>
)

const CameraRow = ({
  label,
  value,
  href,
}: {
  label: string
  value: string
  href?: string
}) => (
  <div css={infoRowCss}>
    <span css={labelCss}>{label}</span>
    {href ? (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        css={`
          ${valueCss}
          color: var(--accent);
          text-decoration: none;
          &:hover {
            text-decoration: underline;
          }
        `}
      >
        {value}
      </a>
    ) : (
      <span css={valueCss}>{value}</span>
    )}
  </div>
)
