import Document, {
  Html,
  Head,
  Main,
  NextScript,
  DocumentContext,
} from 'next/document'
import { StylerunContext } from 'stylerun'

class MyDocument extends Document {
  static async getInitialProps(ctx: DocumentContext) {
    const stylesSet = new Set<string>()
    const originalRenderPage = ctx.renderPage

    try {
      ctx.renderPage = () =>
        originalRenderPage({
          enhanceApp: (App) => (props) => (
            <StylerunContext.Provider value={stylesSet}>
              <App {...props} />
            </StylerunContext.Provider>
          ),
        })

      const initialProps = await Document.getInitialProps(ctx)

      return {
        ...initialProps,
        styles: (
          <>
            {initialProps.styles}
            <style>/* SSR */{[...stylesSet].join('\n')}</style>
          </>
        ),
      }
    } finally {
      stylesSet.clear()
    }
  }

  render() {
    return (
      <Html lang="en">
        <Head></Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}

export default MyDocument
