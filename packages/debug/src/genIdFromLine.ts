import { TreeId, nameToIdDefault } from '@reatom/core'

type Trace = {
  file: string | null
  name: string | null
  line: number | null
  column: number | null
}

type GenConfiguration = {
  useFullPath: boolean
  pathMaxDeep: number
  showColumn: boolean
}

class StackTraceParser extends Error {
  stackTraces: Trace[]

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
    ): Trace[] {
      return stackTraces.map(t => ({
        file: t.getFileName(),
        name: t.getFunctionName(),
        line: t.getLineNumber(),
        column: t.getColumnNumber(),
      }))
    }
    const save = Error.prepareStackTrace
    Error.prepareStackTrace = prepareStackTrace
    this.stackTraces = ((this.stack as any) as Trace[]) || []
    Error.prepareStackTrace = save
  }
}

const configurationDefault: GenConfiguration = {
  useFullPath: false,
  pathMaxDeep: 3,
  showColumn: true,
}

export function genIdFromLine(
  config: Partial<GenConfiguration> = configurationDefault,
) {
  const { useFullPath, pathMaxDeep, showColumn } = {
    ...configurationDefault,
    ...config,
  }

  function _genIdFromLine(name: string | [string]): TreeId {
    const {
      stackTraces: [, , , trace],
    } = new StackTraceParser()

    if (!trace || !trace.file) {
      return nameToIdDefault(name)
    }

    const extractName = Array.isArray(name) ? name[0] : name
    const withoutBackSlashes = trace.file.replace(/\\/g, '/')
    const file = useFullPath
      ? withoutBackSlashes
      : withoutBackSlashes.match(`(?:\\/[^\\/]*){1,${pathMaxDeep}}$`)

    let id = `${extractName} [${file}:${trace.line}`

    if (showColumn) {
      id += `:${trace.column}]`
    } else {
      id += ']'
    }

    return id
  }
  return _genIdFromLine
}
