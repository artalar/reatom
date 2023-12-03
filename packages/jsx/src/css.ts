export const css = (strings: readonly string[], ...subs: any[]) => {
  return strings.reduce((result, string, i) => {
    if (i === strings.length - 1) return result + string
    return result + string + subs[i]
  }, '')
}
