import { AsyncArray } from '@liuli-util/async'
import FastGlob from 'fast-glob'
import { readFile, readJson, writeFile, writeJson } from '@liuli-util/fs-extra'
import path from 'path'
import { PackageJson } from 'type-fest'
import { findPnpmRootPath } from './utils/findPnpmRootPath'
import { scanPnpmMods } from './utils/scanPnpmMods'
import { parse, print, visit } from 'recast'
import { format } from 'prettier-package-json'
import { namedTypes as n, builders as b } from 'ast-types'
import { createRequire } from 'module'
import { NodePath } from 'ast-types/lib/node-path'
const require = createRequire(import.meta.url)

async function updatePackageJSON(modPath: string) {
  const jsonPath = path.resolve(modPath, 'package.json')
  const json = (await readJson(jsonPath)) as PackageJson
  if (json.type === 'module') {
    return
  }
  json.type = 'module'
  if (json.scripts && Object.values(json.scripts).some((item) => item.includes('liuli-cli'))) {
    json.exports = {
      import: './dist/index.js',
      require: './dist/index.cjs',
    }
    delete json.main
    delete json.module
  }
  await writeJson(jsonPath, json, { spaces: 2 })
}

async function updateBundle(modPath: string) {
  const jsonPath = path.resolve(modPath, 'package.json')
  const json = (await readJson(jsonPath)) as PackageJson
  if (json.devDependencies) {
    Reflect.set(json.devDependencies, 'tsup', '^6.2.3')
    Reflect.deleteProperty(json.devDependencies, '@liuli-util/cli')
  }
  if (json.scripts) {
    Object.keys(json.scripts).forEach((k) => {
      const matches = [
        [
          'liuli-cli build cli -w',
          'tsup src/index.ts --format esm,cjs --dts && tsup src/bin.ts --format esm --target esnext --watch',
        ],
        [
          'liuli-cli build cli',
          'tsup src/index.ts --format esm,cjs --dts && tsup src/bin.ts --format esm --target esnext',
        ],
        ['liuli-cli build lib -w', 'tsup src/index.ts --format esm,cjs --dts --watch'],
        ['liuli-cli build lib', 'tsup src/index.ts --format esm,cjs --dts'],
      ]
      matches.forEach(([o, n]) => (json.scripts[k] = json.scripts[k].replaceAll(o, n)))
    })
  }
  await writeJson(jsonPath, json, { spaces: 2 })
}

async function replaceEsnoToTsx(modPath: string) {
  const jsonPath = path.resolve(modPath, 'package.json')
  const json = (await readJson(jsonPath)) as PackageJson
  if (!json.devDependencies || !json.devDependencies.esno) {
    return
  }
  delete json.devDependencies.esno
  json.devDependencies.tsx = '^3.9.0'
  if (json.scripts) {
    Object.keys(json.scripts).forEach((k) => {
      const matches = [['esno', 'tsx']]
      matches.forEach(([o, n]) => (json.scripts[k] = json.scripts[k].replaceAll(o, n)))
    })
  }
  await writeJson(jsonPath, json, { spaces: 2 })
}

async function updateFsExtraImport(modPath: string) {
  if (path.basename(modPath) === 'fs-extra') {
    return
  }
  const jsonPath = path.resolve(modPath, 'package.json')
  const json = (await readJson(jsonPath)) as PackageJson
  if (!json.dependencies || !json.dependencies['fs-extra']) {
    return
  }
  delete json.devDependencies?.['@types/fs-extra']
  delete json.dependencies?.['fs-extra']
  json.dependencies['@liuli-util/fs-extra'] = 'workspace:^'
  const list = await FastGlob('src/**/*.ts', { cwd: modPath })
  function replace(code: string) {
    const ast = parse(code, { parser: require('recast/parsers/typescript') })
    visit(ast, {
      visitImportDeclaration(path) {
        if (path.node.source.value === 'fs-extra') {
          path.node.source.value = '@liuli-util/fs-extra'
        }
        return false
      },
    })
    return print(ast, { parser: require('recast/parsers/typescript') }).code
  }
  await new AsyncArray(list.map((item) => path.resolve(modPath, item)))
    .filter(async (item) => {
      const text = await readFile(item, 'utf-8')
      return text.includes('fs-extra')
    })
    .forEach(async (item) => {
      const text = await readFile(item, 'utf-8')
      await writeFile(item, replace(text))
    })
  await writeJson(jsonPath, json, { spaces: 2 })
}

async function prettryPackageJson(modPath: string) {
  const jsonPath = path.resolve(modPath, 'package.json')
  const json = (await readJson(jsonPath)) as PackageJson
  await writeFile(jsonPath, format(json))
}

async function updateJestToVitest(modPath: string) {
  const jsonPath = path.resolve(modPath, 'package.json')
  const json = (await readJson(jsonPath)) as PackageJson

  if (!json.devDependencies?.jest) {
    return
  }
  delete json?.['jest']
  delete json?.['wallaby']
  if (json.devDependencies) {
    delete json.devDependencies.jest
    delete json.devDependencies['ts-jest']
    delete json.devDependencies['@types/jest']
    json.devDependencies['vitest'] = '^0.23.4'
  }
  if (json.scripts) {
    Object.keys(json.scripts).forEach((k) => {
      json.scripts[k] = json.scripts[k].replaceAll('jest --all', 'vitest run')
    })
  }
  const list = await FastGlob('src/**/*.test.ts', { cwd: modPath })
  function replace(code: string) {
    const ast = parse(code, { parser: require('recast/parsers/typescript') }) as n.ASTNode
    const identifiers = ['describe', 'it', 'test', 'expect', 'beforeEach', 'afterEach', 'beforeAll', 'afterAll']
    let imp: n.ImportDeclaration,
      r: Set<string> = new Set(['expect', 'it']),
      hasJest = false
    visit(ast, {
      visitImportDeclaration(path) {
        if (path.node.source.value === 'vitest') {
          imp = path.node as any
        }
        return false
      },
      visitIdentifier(path) {
        if (identifiers.includes(path.node.name)) {
          r.add(path.node.name)
        }
        if (path.node.name === 'jest') {
          path.node.name = 'vi'
          hasJest = true
        }
        return false
      },
    })
    if (hasJest) {
      r.add('vi')
    }
    const s = [...r].map((item) => b.importSpecifier(b.identifier(item)))
    if (imp) {
      imp.specifiers = s
    } else if (ast.type === 'Program') {
      ast.body = [b.importDeclaration(s, b.literal('vitest')), ...ast.body]
    } else if (ast.type === 'File') {
      ast.program.body = [b.importDeclaration(s, b.literal('vitest')), ...ast.program.body]
    } else {
      console.warn('未转换', ast.type)
    }
    return print(ast, { parser: require('recast/parsers/typescript') }).code
  }
  await new AsyncArray(list.map((item) => path.resolve(modPath, item))).forEach(async (item) => {
    const text = await readFile(item, 'utf-8')
    await writeFile(item, replace(text))
  })
  await writeJson(jsonPath, json, { spaces: 2 })
}

async function updateLodashToLodashEs(modPath: string) {
  const jsonPath = path.resolve(modPath, 'package.json')
  const json = (await readJson(jsonPath)) as PackageJson
  if (!json.devDependencies?.lodash && !json.dependencies?.lodash) {
    return
  }
  if (json.devDependencies) {
    delete json.devDependencies['@types/lodash']
    json.devDependencies['@types/lodash-es'] = '^4.17.6'
    if (json.devDependencies.lodash) {
      delete json.devDependencies.lodash
      json.devDependencies['lodash-es'] = '^4.17.21'
    }
  }
  if (json.dependencies && json.dependencies.lodash) {
    delete json.dependencies.lodash
    json.dependencies['lodash-es'] = '^4.17.21'
  }
  const list = await FastGlob('src/**/*.ts', { cwd: modPath })
  function replace(code: string) {
    const ast = parse(code, { parser: require('recast/parsers/typescript') }) as n.ASTNode
    visit(ast, {
      visitImportDeclaration(path) {
        if (path.node.source.value === 'lodash') {
          path.node.source.value = 'lodash-es'
        }
        return false
      },
    })
    return print(ast, { parser: require('recast/parsers/typescript') }).code
  }
  await new AsyncArray(list.map((item) => path.resolve(modPath, item))).forEach(async (item) => {
    const text = await readFile(item, 'utf-8')
    await writeFile(item, replace(text))
  })
  await writeJson(jsonPath, json, { spaces: 2 })
}

async function updateDirname(modPath: string) {
  const list = await FastGlob('src/**/*.ts', { cwd: modPath })
  function replace(code: string) {
    const ast = parse(code, { parser: require('recast/parsers/typescript') }) as n.File
    let hasDirname = false,
      urlImp: n.ImportDeclaration,
      pathImp: n.ImportDeclaration
    visit(ast, {
      visitIdentifier(path) {
        if (path.node.name === '__dirname') {
          const temp = parse(`path.dirname(fileURLToPath(import.meta.url))`, {
            parser: require('recast/parsers/typescript'),
          }) as n.File
          path.replace(temp.program.body[0])
          hasDirname = true
        }
        return false
      },
      visitImportDeclaration(path) {
        if (path.node.source.value === 'url') {
          urlImp = path.node as any
        }
        if (path.node.source.value === 'path') {
          pathImp = path.node as any
        }
        return false
      },
    })
    if (!hasDirname) {
      return code
    }
    if (!pathImp) {
      ast.program.body.unshift(b.importDeclaration([b.importDefaultSpecifier(b.identifier('path'))], b.literal('path')))
    }
    if (urlImp) {
      if (!urlImp.specifiers.some((item) => item.local.name === 'fileURLToPath')) {
        urlImp.specifiers.push(b.importSpecifier(b.identifier('fileURLToPath')))
      }
    } else {
      ast.program.body.unshift(
        b.importDeclaration([b.importSpecifier(b.identifier('fileURLToPath'))], b.literal('url')),
      )
    }
    return print(ast, { parser: require('recast/parsers/typescript') }).code
  }
  await new AsyncArray(list.map((item) => path.resolve(modPath, item))).forEach(async (item) => {
    const text = await readFile(item, 'utf-8')
    await writeFile(item, replace(text))
  })
}

async function updateRequire(modPath: string) {
  const list = await FastGlob('src/**/*.ts', { cwd: modPath })
  function replace(code: string) {
    const ast = parse(code, { parser: require('recast/parsers/typescript') }) as n.File
    let hasRequire = false,
      imp: NodePath<n.ImportDeclaration>
    visit(ast, {
      visitIdentifier(path) {
        if (path.node.name === 'require') {
          hasRequire = true
        }
        return false
      },
      visitImportDeclaration(path) {
        if (path.node.source.value === 'module') {
          imp = path as any
        }
        return false
      },
    })
    if (!hasRequire) {
      return code
    }
    if (imp) {
      if (!imp.node.specifiers.some((item) => item.local.name === 'createRequire')) {
        imp.node.specifiers.push(b.importSpecifier(b.identifier('createRequire')))
      }
    } else {
      ast.program.body.unshift(
        b.importDeclaration([b.importSpecifier(b.identifier('createRequire'))], b.literal('module')),
      )
      ast.program.body
    }
    return print(ast, { parser: require('recast/parsers/typescript') }).code
  }
  await new AsyncArray(list.map((item) => path.resolve(modPath, item))).forEach(async (item) => {
    const text = await readFile(item, 'utf-8')
    await writeFile(item, replace(text))
  })
}

async function updateESM() {
  const rootPath = await findPnpmRootPath()
  const mods = await scanPnpmMods(rootPath)
  const list = mods
    .filter((item) => ['apps/', 'libs/'].some((s) => item.startsWith(s)))
    .map((item) => path.resolve(rootPath, item))
  const funcs = [
    // 列表
    // updatePackageJSON,
    // updateBundle,
    // replaceEsnoToTsx,
    // updateFsExtraImport,
    // prettryPackageJson,
    updateJestToVitest,
    // updateLodashToLodashEs,
    // updateDirname,
  ]
  await AsyncArray.forEach(list, async (modPath) => {
    for (const f of funcs) {
      await f(modPath)
    }
  })
}

updateESM()