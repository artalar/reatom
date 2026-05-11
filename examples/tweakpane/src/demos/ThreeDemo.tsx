import { action, atom, effect, peek, withConnectHook, wrap } from '@reatom/core'
import { reatomFactoryComponent } from '@reatom/react'
import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three'

import { reatomInstance, withInstance } from '../reatomInstance'
import { reatomPaneFolder, withBinding, withEffect } from '../tweakpane'

export const ThreeDemo = reatomFactoryComponent(() => {
  const threeFolder = reatomPaneFolder({ title: 'Three.js' })

  const containerAtom = atom<HTMLElement | null>(null, 'container').extend((target) => {
    const size = atom({ width: 0, height: 0 }, `${target.name}._size`).extend(
      withConnectHook((sizeTarget) => {
        const container = target()
        let observer: ResizeObserver | null = null
        if (container) {
          observer = new ResizeObserver(
            wrap(() => {
              sizeTarget.set({
                width: container.clientWidth,
                height: container.clientHeight,
              })
            }),
          )
          observer.observe(container)
        }

        return () => observer?.disconnect()
      }),
    )

    return {
      size,
      ref: action((node: HTMLElement | null) => void target.set(node)),
    }
  })

  const sceneAtom = reatomInstance(
    () => new Scene(),
    (scene) => scene.clear(),
  ).extend(
    () => ({
      bgColor: atom('#87ceeb', 'sceneColor').extend(
        withBinding({ label: 'Background Color' }, threeFolder),
      ),
    }),
    withEffect((scene) => {
      peek(scene).background = new Color(sceneAtom.bgColor())
    }),
  )

  const ambientLightAtom = reatomInstance(
    () => new AmbientLight(0xffffff, 0.5),
    (light) => light.removeFromParent(),
  ).extend(
    () => ({
      intensity: atom(0.5, 'ambientIntensity').extend(
        withBinding(
          { label: 'Ambient Intensity', min: 0, max: 2 },
          threeFolder,
        ),
      ),
    }),
    withEffect((light) => {
      peek(light).intensity = ambientLightAtom.intensity()
    }),
  )

  const directionalLightAtom = reatomInstance(
    () => new DirectionalLight(0xffffff, 1),
    (light) => light.removeFromParent(),
  ).extend(
    () => ({
      intensity: atom(1, 'directionalIntensity').extend(
        withBinding(
          { label: 'Directional Intensity', min: 0, max: 2 },
          threeFolder,
        ),
      ),
      position: atom({ x: 5, y: 5, z: 5 }, 'directionalPosition').extend(
        withBinding({ label: 'Light Position' }, threeFolder),
      ),
    }),
    withEffect((lightAtom) => {
      const light = peek(lightAtom)
      const { x, y, z } = directionalLightAtom.position()
      light.intensity = directionalLightAtom.intensity()
      light.position.set(x, y, z)
    }),
  )

  const cameraAtom = reatomInstance(
    () => new PerspectiveCamera(45, 1, 0.1, 100),
    (camera) => camera.removeFromParent(),
  ).extend(
    () => ({
      position: atom({ x: 0, y: 0, z: 10 }, 'cameraPosition').extend(
        withBinding({ label: 'Camera Position' }, threeFolder),
      ),
    }),
    withEffect((cameraAtom) => {
      const camera = peek(cameraAtom)
      const pos = cameraAtom.position()
      camera.position.set(pos.x, pos.y, pos.z)
    }),
    withEffect((cameraAtom) => {
      const camera = peek(cameraAtom)
      const { width, height } = containerAtom.size()
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }),
  )

  const rendererAtom = reatomInstance(
    () => {
      const renderer = new WebGLRenderer({ antialias: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setSize(1, 1)
      renderer.setAnimationLoop(
        wrap(() => {
          renderer.render(sceneAtom(), cameraAtom())
        }),
      )

      return renderer
    },
    (renderer) => {
      renderer.setAnimationLoop(null)
      renderer.dispose()
      renderer.domElement.remove()
    },
  ).extend(
    withEffect((rendererAtom) => {
      const renderer = peek(rendererAtom)
      const { width, height } = containerAtom.size()
      renderer.setSize(width, height)
      renderer.render(sceneAtom(), cameraAtom())
    }),
    withEffect((rendererAtom) => {
      const container = containerAtom()
      const element = peek(rendererAtom).domElement
      if (container && element.parentElement !== container) {
        container.appendChild(element)
      }
    }),
  )

  const boxGeometryAtom = atom({ x: 1, y: 1, z: 1 }, 'boxDimensions').extend(
    withBinding({ label: 'Box Dimensions' }, threeFolder),
    withInstance(
      (dimensions) => {
        const { x, y, z } = dimensions()
        return new BoxGeometry(x, y, z)
      },
      (geometry) => geometry.dispose(),
    ),
  )

  const boxMaterialAtom = atom({
    color: atom('#00ff00', 'boxColor').extend(
      withBinding({ label: 'Box Color' }, threeFolder),
    ),
    opacity: atom(1, 'boxOpacity').extend(
      withBinding({ label: 'Box Opacity', min: 0, max: 1 }, threeFolder),
    ),
  }).extend(
    withInstance(
      (params) =>
        new MeshStandardMaterial({
          color: params().color(),
          transparent: params().opacity() < 1,
          opacity: params().opacity(),
        }),
      (material) => material.dispose(),
    ),
  )

  const boxMeshAtom = reatomInstance(
    () => new Mesh(boxGeometryAtom.instance(), boxMaterialAtom.instance()),
    (box) => box.removeFromParent(),
  ).extend(
    () => ({
      rotation: atom({ x: 0.5, y: 0.5, z: -0.3 }, 'boxRotation').extend(
        withBinding({ label: 'Box Rotation' }, threeFolder),
      ),
    }),
    withEffect((boxAtom) => {
      const box = peek(boxAtom)
      const { x, y, z } = boxMeshAtom.rotation()
      box.rotation.set(x, y, z)
    }),
  )

  effect(() => {
    const scene = sceneAtom()
    scene.add(ambientLightAtom())
    scene.add(directionalLightAtom())
    scene.add(boxMeshAtom())
    rendererAtom()
  })

  return () => (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        minHeight: 'calc(100vh - 4rem)',
      }}
    >
      <h3>Three.js</h3>
      <p>
        Three.js scene wired to Tweakpane bindings. Adjust the controls to
        update the live WebGL view.
      </p>
      <div
        ref={wrap(containerAtom.ref)}
        id='three-container'
        style={{
          flex: 1,
          minHeight: '320px',
          border: '1px solid #eee',
          borderRadius: '6px',
        }}
      />
    </section>
  )
}, 'ThreeDemo')
