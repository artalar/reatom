import React from 'react'
import ReactDOM from 'react-dom'
import { Style, styled } from 'stylerun'

export type LensProps = {
  src: string
  alt: string
  height: string
  width: string
  lensSize?: number
  zoomSize?: number
}

export const Glass = styled<{ lensSize: number }>(
  `div`,
  ({ lensSize, className, useCssVar }) => {
    const sizeVar = useCssVar(`${lensSize}px`)

    return `.${className} {
      position: fixed;
      top: 0;
      left: 0;
      width: ${sizeVar};
      height: ${sizeVar};
      overflow: hidden;
      pointer-events: none;
      border-radius: 50%;
      background-color: #fff;
      box-shadow: black 0px 0px 60px -20px;
    }`
  },
)

export const Lens = styled<LensProps>(
  ({ src, alt, height, width, lensSize = 300, zoomSize = 3, className }) => {
    const portalRef = React.useRef<HTMLElement>()
    if (!portalRef.current) {
      portalRef.current = document.createElement('div')
      const id = `Lens-${Math.random().toString(36).replace('.', '')}`
      portalRef.current.id = id
    }
    const portal = portalRef.current

    const handleMouseEnter = () => portal.classList.add(`visible`)

    const handleMouseLeave = () => portal.classList.remove(`visible`)

    const handleMouseMove = (
      e: React.MouseEvent<HTMLImageElement, MouseEvent>,
    ) => {
      const lens = portal.firstChild as HTMLElement
      const img = lens.firstChild as HTMLElement
      const { y, x } = e.currentTarget.getBoundingClientRect()
      const { clientX, clientY } = e
      const positionX = clientX - x
      const positionY = clientY - y
      const shiftX = positionY * zoomSize - lensSize / 2
      const shiftY = positionX * zoomSize - lensSize / 2

      lens.style.left = `${clientX - lensSize / 2}px`
      lens.style.top = `${clientY - lensSize / 2}px`

      img.style.left = `${-shiftY}px`
      img.style.top = `${-shiftX}px`
    }

    React.useLayoutEffect(() => {
      document.body.appendChild(portal)

      return () => void document.body.removeChild(portal)
    }, [])

    return (
      <>
        <div className={className}>
          <img
            src={src}
            alt={alt}
            style={{ height: height, width: width }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onMouseMove={handleMouseMove}
          />
          {ReactDOM.createPortal(
            <Glass lensSize={lensSize}>
              <img src={src} alt={alt} />
            </Glass>,
            portal,
          )}
        </div>
        <Style>{`
        .${className} {
          position: relative;
          cursor: zoom-in;
        }
        .${className} img {
          object-fit: contain;
        }
        ${Glass} img {
          position: absolute;
          object-fit: contain;
          height: calc(${height} * ${zoomSize});
          width: calc(${width} * ${zoomSize});
        }
        #${portal.id} {
          pointer-events: none;
          opacity: 0;
          transition: opacity 250ms;
        }
        #${portal.id}.visible {
          opacity: 1;
        }
      `}</Style>
      </>
    )
  },
)
