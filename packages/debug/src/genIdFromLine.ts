import { TreeId, nameToIdDefault } from '@reatom/core'

interface ITrace {
  file: string | null
  name: string | null
  line: number | null
  column: number | null
}

interface IGenConfiguration {
  useFullPath: boolean
  pathMaxDeep: number
  showColumn: boolean
}

class StackTraceParcer extends Error {
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

const configurationDefault: IGenConfiguration = {
  useFullPath: false,
  pathMaxDeep: 3,
  showColumn: true
}

let configuration = configurationDefault

export function genIdFromLine(name: string | [string]): TreeId {
  const {
    stackTraces: [, , , trace],
  } = new StackTraceParcer()

  if (!trace || !trace.file) {
    return nameToIdDefault(name)
  }

  const extractName = Array.isArray(name) ? name[0] : name
  const withoutBackSlashes = trace.file.replace(/\\/g, '/')
  const { useFullPath, pathMaxDeep, showColumn } = configuration
  const file = useFullPath
    ? withoutBackSlashes
    : withoutBackSlashes.match(
      `(?:\/[^\/]*){1,${pathMaxDeep}}$`,
    )

  let id = `${extractName} [${file}:${trace.line}`

  if (showColumn) {
    id += `:${trace.column}]`
  } else {
    id += ']'
  }

  return id
}

export function configureGenIdFromLine(config: Partial<IGenConfiguration>) {
  configuration = { ...configurationDefault, ...config }
}
