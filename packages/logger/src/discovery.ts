// we need to inline CSS to simplify a user bundling, but something brokes if we try to bundle the whole discoveryjs
// so we bundle only CSS with this weird hack and import discoveryjs JS from a package

// @ts-ignore
import discoveryCss1 from '../../../node_modules/@discoveryjs/discovery/dist/discovery-preloader.css'
// @ts-ignore
import discoveryCss2 from '../../../node_modules/@discoveryjs/discovery/dist/discovery.css'
// @ts-ignore
import { App } from '@discoveryjs/discovery'

export const createDiscovery = async (container: HTMLElement) => {
  const widget = new App({
    container,
    logLevel: 'warn',
    extensions: [
      (host: { dom: { root: Element }; darkmode: { mode: string } }) => {
        // console.log('discovery data', host)

        // data.dom.root.children[0]!.classList.add('discovery-root-darkmode')
        host.darkmode.mode = 'auto'

        const stylesEl = document.createElement('style')
        stylesEl.textContent = `
          ${discoveryCss1}
          ${discoveryCss2}
          .view-page-header { display: none; }
        `
        host.dom.root.appendChild(stylesEl)
      },
    ],
  })

  // console.log('widget', widget)

  return widget as { setData(data: any): any }
}
