const fs = require('fs')
const path = require('path')
const glob = require('glob')

function modulesFix(content) {
  let contentFixed = content

  contentFixed = contentFixed.replace(
    /## References(.|[\n\r])+?## Type aliases/g,
    '## Type aliases',
  )

  contentFixed = contentFixed.replace(
    /## References(.|[\n\r])+?## Classes/g,
    '## Classes',
  )
  contentFixed = contentFixed.replace(/<\/a> `Const` /g, '</a> ')

  contentFixed = contentFixed.replace(/# Variables/g, '# Globals')

  return contentFixed
}

const fixes = [{ pattern: 'docs/modules/*.md', execute: modulesFix }]

function processFiles(fix) {
  const { pattern, execute } = fix
  const fileOptions = { encoding: 'utf-8' }
  glob.sync(pattern).forEach(fileName => {
    console.log(`Fixing doc file: ${fileName}`)

    const content = fs.readFileSync(fileName, fileOptions)
    const contentFixed = execute(content)
    fs.writeFileSync(fileName, contentFixed, fileOptions)
  })
}

function executeFixes() {
  const rootFolder = path.resolve(`${__dirname}/../..`)
  process.chdir(rootFolder)

  fixes.forEach(fix => processFiles(fix))
}

executeFixes()
