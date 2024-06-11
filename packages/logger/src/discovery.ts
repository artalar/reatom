export const createDiscovery = async (container: HTMLElement) => {
  const [discovery, { default: discoveryCss1 }, { default: discoveryCss2 }] =
    await Promise.all([
      // @ts-ignore
      import('@discoveryjs/discovery'),
      // @ts-ignore
      import('@discoveryjs/discovery/dist/discovery-preloader.css?raw'),
      // @ts-ignore
      import('@discoveryjs/discovery/dist/discovery.css?raw'),
    ])

  // console.log({ discovery })

  const widget = new discovery.App({
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
