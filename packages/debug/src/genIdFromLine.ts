import { TreeId } from '@reatom/core'

interface ITrace {
  file: string | null
  name: string | null
  line: number | null
  column: number | null
}

interface IGenConfiguration {
  useFullPath: boolean
  pathMaxDeep: number
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
        column: t.getColumnNumber(),
      }))
    }
    const save = Error.prepareStackTrace
    Error.prepareStackTrace = prepareStackTrace
    this.stackTraces = ((this.stack as any) as ITrace[]) || []
    Error.prepareStackTrace = save
  }
}

let configuration: IGenConfiguration = {
  useFullPath: false,
  pathMaxDeep: 3,
}

export function genIdFromLine(name: string | [string]): TreeId {
  const {
    stackTraces: [, , , trace],
  } = new StackTrace()
  const id = Array.isArray(name) ? name[0] : name
  if (trace && trace.file && trace.line) {
    const withoutBackSlashes = trace.file.replace(/\\/g, '/')
    const file = configuration.useFullPath
      ? withoutBackSlashes
      : withoutBackSlashes.match(
          `(?:\/[^\/]*){1,${configuration.pathMaxDeep}}$`,
        )
    return `${id} [${file}:${trace.line}:${trace.column}]`
  }
  return id
}

export function configureGenIdFromLine(config: Partial<IGenConfiguration>) {
  configuration = { ...configuration, ...config }
}
