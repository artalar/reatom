import { nameToIdDefault, TreeId, declareAction, declareAtom } from '@reatom/core';

class StackTrace extends Error {
  stackTraces?: NodeJS.CallSite[];
  prepareStackTrace(err: Error, stackTraces: NodeJS.CallSite[]) {
    this.stackTraces = stackTraces;
  }
}

function traceUntil(trace: NodeJS.CallSite[]) {
  for (let i = 0; i < trace.length; i++) {
    const fn = trace[i].getFunction();
    if (fn === declareAction || fn === declareAtom) {
      return trace[++i];
    }
  }
  return undefined;
}

export function genIdFromLine(name: string | [string]): TreeId {
  const { stackTraces } = new StackTrace();
  const id = nameToIdDefault(name);
  if (stackTraces) {
    const trace = traceUntil(stackTraces);
    if (trace) {
      return `${id}[/${trace.getFileName()}#${trace.getLineNumber()}]`
    }
  }
  return id;
}
