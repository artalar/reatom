// @ts-ignore
import { Widget } from '@discoveryjs/discovery'
import discoveryCss1 from '@discoveryjs/discovery/dist/discovery-preloader.css?raw'
import discoveryCss2 from '@discoveryjs/discovery/dist/discovery.css?raw'

const container = document.querySelector('#discovery') as HTMLDialogElement
container.onclick = ({ target }) => {
  if (target === container) {
    container.close()
    widget.unloadData()
  }
}

const widget = new Widget({
  container,
  logLevel: 'warn',
  extensions: [
    ({ dom: { root } }: { dom: { root: Element } }) => {
      const stylesEl = document.createElement('style')
      stylesEl.textContent = `
        ${discoveryCss1}
        ${discoveryCss2}
        .view-page-header { display: none; }
      `
      root.appendChild(stylesEl)
    },
  ],
})

export const show = (data: any) => {
  widget.setData(data)
  container.showModal()
}
