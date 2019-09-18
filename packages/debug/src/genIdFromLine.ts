import { nameToIdDefault, TreeId } from '@reatom/core'

interface ITrace {
  file: string | null
  name: string | null
  line: number | null
}

class StackTrace extends Error {
  stackTraces: ITrace[]
  constructor(error?: string) {
    super(error)
    this.stackTraces = []
    Error.captureStackTrace(this, this.constructor)
    this.getTrace()
  }
  getTrace() {
    function prepareStackTrace(
      err: Error,
      stackTraces: NodeJS.CallSite[],
    ): ITrace[] {
      return stackTraces.map(t => ({
        file: t.getFileName(),
        name: t.getFunctionName(),
        line: t.getLineNumber(),
      }))
    }
    const save = Error.prepareStackTrace
    Error.prepareStackTrace = prepareStackTrace
    this.stackTraces = ((this.stack as any) as ITrace[]) || []
    Error.prepareStackTrace = save
  }
}

export function genIdFromLine(name: string | [string]): TreeId {
  const {
    stackTraces: [, , , trace],
  } = new StackTrace()
  const id = nameToIdDefault(name)
  if (trace && trace.file && trace.line) {
    const withoutBackSlashes = trace.file.replace(/\\/g, '/')
    const file = withoutBackSlashes.match(/((?:\/).*?){1,3}$/)![1]
    return `${id}[${file}#${trace.line}]`
  }
  return id
}
