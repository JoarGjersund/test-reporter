import * as fs from 'fs'
import * as path from 'path'

import {BehaveJsonParser} from '../src/parsers/behave-json/behave-json'
import {ParseOptions} from '../src/test-parser'
import {DEFAULT_OPTIONS, getReport} from '../src/report/get-report'
import {normalizeFilePath} from '../src/utils/path-utils'

describe('behave-json tests', () => {
  it('produces empty test run result when there are no features', async () => {
    const fixturePath = path.join(__dirname, 'fixtures', 'empty', 'behave.json')
    const filePath = normalizeFilePath(path.relative(__dirname, fixturePath))
    const fileContent = fs.readFileSync(fixturePath, {encoding: 'utf8'})

    const opts: ParseOptions = {
      parseErrors: true,
      trackedFiles: []
    }

    const parser = new BehaveJsonParser(opts)
    const result = await parser.parse(filePath, fileContent)
    expect(result.tests).toBe(0)
    expect(result.result).toBe('success')
  })

  it('report from behave.json test results matches snapshot', async () => {
    const fixturePath = path.join(__dirname, 'fixtures', 'behave.json')
    const outputPath = path.join(__dirname, '__outputs__', 'behave-json.md')
    const filePath = normalizeFilePath(path.relative(__dirname, fixturePath))
    const fileContent = fs.readFileSync(fixturePath, {encoding: 'utf8'})

    const opts: ParseOptions = {
      parseErrors: true,
      trackedFiles: []
    }

    const parser = new BehaveJsonParser(opts)
    const result = await parser.parse(filePath, fileContent)
    expect(result).toMatchSnapshot()

    const report = getReport([result])
    fs.mkdirSync(path.dirname(outputPath), {recursive: true})
    fs.writeFileSync(outputPath, report)
  })
})
