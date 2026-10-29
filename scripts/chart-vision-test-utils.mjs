import {mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
export async function loadVisionModules(){
  const dir=mkdtempSync(join(tmpdir(),'cloe-vision-test-'));
  for(const name of ['model','price-labels','scale','candles','frame-gate']) {
    const source=readFileSync(new URL(`../src/lib/chart-editor/${name}.ts`,import.meta.url),'utf8');
    const out=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,(_,p)=>`from '${p}.mjs'`);
    writeFileSync(join(dir,`${name}.mjs`),out);
  }
  return {dir,...Object.fromEntries(await Promise.all(['model','price-labels','scale','candles','frame-gate'].map(async name=>[name,await import(pathToFileURL(join(dir,`${name}.mjs`)))])))};
}
