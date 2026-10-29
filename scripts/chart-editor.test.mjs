import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../src/lib/chart-editor/model.ts',import.meta.url),'utf8');
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {validateCalibration,estimatePrice,fitImage,newScene,newDocument,calibrateScene,invalidateScene,serializeDocument,restoreDocument}=await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
const calibration={source:'manual-two-points',scale:'linear',anchors:[{y:0.2,price:100},{y:0.8,price:40}],createdAt:'2026-10-29T12:00:00Z'};
test('linear interpolation, endpoints and extrapolation flags',()=>{
  assert.equal(validateCalibration(calibration),null);
  assert.equal(estimatePrice(0.2,calibration).price,100);
  assert.ok(Math.abs(estimatePrice(0.5,calibration).price-70)<1e-8);
  assert.equal(estimatePrice(0.5,calibration).extrapolated,false);
  assert.equal(estimatePrice(0.1,calibration).extrapolated,true);
  assert.equal(estimatePrice(0.5,null),null);
});
test('log interpolation uses geometric midpoint',()=>{
  const c={...calibration,scale:'log',anchors:[{y:0,price:100},{y:1,price:25}]};
  assert.ok(Math.abs(estimatePrice(0.5,c).price-50)<1e-8);
});
test('reject malformed, inverted, duplicate and nonfinite reference data',()=>{
  for(const c of [{...calibration,scale:'unknown'},{...calibration,anchors:[]},{...calibration,anchors:[{y:0.5,price:100},{y:0.5,price:50}]},{...calibration,anchors:[{y:0,price:50},{y:1,price:100}]},{...calibration,anchors:[{y:0,price:0},{y:1,price:1}]},{...calibration,anchors:[{y:0,price:Infinity},{y:1,price:1}]}]) assert.ok(validateCalibration(c));
});
test('capture contain geometry accounts for letterboxing and invalid dimensions',()=>{
  assert.deepEqual(fitImage(1000,1000,2000,1000),{left:0,top:250,width:1000,height:500});
  assert.deepEqual(fitImage(0,100,0,10),{left:0,top:0,width:0,height:0});
});
test('invalidating live view preserves historical calibration; captures stay stable',()=>{
  const live=calibrateScene(newScene(),calibration);
  const invalid=invalidateScene(live,'navigate');
  assert.equal(invalid.calibration,null);assert.equal(invalid.calibrationHistory.length,2);assert.deepEqual(invalid.calibrationHistory[1].calibration,calibration);
  assert.deepEqual(live.calibration,calibration);
  const capture=calibrateScene(newScene({id:'capture',kind:'capture',createdAt:'now'}),calibration);
  assert.equal(invalidateScene(capture,'resize'),capture);
});
test('JSON roundtrip preserves raw points and creation calibration, invalidates live current mapping',()=>{
  const doc=newDocument();doc.scenes[0]=calibrateScene(doc.scenes[0],calibration);
  doc.scenes[0].drawings=[{id:'line',kind:'segment',points:[{x:0.1,y:0.5},{x:0.9,y:0.6}],createdAt:'now',calibrationAtCreation:calibration}];
  const raw=serializeDocument(doc), exported=JSON.parse(raw), restored=restoreDocument(raw);
  assert.ok(exported.scenes[0].readings[0].points[0].creationCalibrationEstimate.estimated);
  assert.equal(restored.scenes[0].calibration,null);
  assert.deepEqual(restored.scenes[0].drawings,doc.scenes[0].drawings);
  assert.equal(restored.scenes[0].calibrationHistory.at(-1).action,'invalidated');
});
test('capture roundtrip retains image and mapping, rejects corrupt scale and dimensions',()=>{
  const doc=newDocument(),s=calibrateScene(newScene({id:'image',kind:'capture',createdAt:'now',image:'data:image/png;base64,a',imageWidth:1200,imageHeight:800}),calibration);
  doc.scenes=[s];doc.activeId='image';
  assert.deepEqual(restoreDocument(serializeDocument(doc)).scenes[0].calibration,calibration);
  s.calibration.scale='bad';assert.equal(restoreDocument(serializeDocument(doc)),null);
  s.calibration=null;s.reference.imageWidth=-1;assert.equal(restoreDocument(serializeDocument(doc)),null);
});
