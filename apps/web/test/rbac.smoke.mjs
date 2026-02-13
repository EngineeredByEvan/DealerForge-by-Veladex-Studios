import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';

const source = await readFile(new URL('../src/lib/authorization.ts', import.meta.url), 'utf8');
const transpiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;

const require = createRequire(import.meta.url);
const moduleRef = { exports: {} };
const context = {
  module: moduleRef,
  exports: moduleRef.exports,
  require,
  console
};
vm.runInNewContext(transpiled, context);
const { canAccess } = moduleRef.exports;

const salesUser = {
  platformRole: 'NONE',
  dealerships: [{ dealershipId: 'd-1', role: 'SALES' }]
};

if (canAccess('/settings/integrations', salesUser, 'd-1')) {
  throw new Error('Sales user should not have integrations access in sidebar policy.');
}

if (canAccess('/integrations', salesUser, 'd-1')) {
  throw new Error('Sales user should not be able to access integrations route directly.');
}

console.log('RBAC smoke check passed.');
