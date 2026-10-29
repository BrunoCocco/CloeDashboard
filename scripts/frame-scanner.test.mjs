// Deterministic hook integration harness: simulated React lifecycle, DOM, capture and OCR.
// This does not exercise a native browser permission selector or OCR recognition.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const transpile=path=>ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const gateModule={exports:{}};vm.runInNewContext(transpile('../src/lib/chart-editor/frame-gate.ts'),{exports:gateModule.exports,AbortController,clearTimeout});
const source=transpile('../src/components/use-frame-scanner.ts');
const settle=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
function harness(){
 let cursor=0,slots=[],effects=[],layouts=[],cleanups=[],api,props={id:'a',live:true},timers=new Map(),nextTimer=1,stopped=0,videoPaused=0;
 const listeners=new Map(),jobs=[],readers=[],resize=[];
 const listen=(name,fn)=>{const set=listeners.get(name)??new Set();set.add(fn);listeners.set(name,set);};
 const unlisten=(name,fn)=>listeners.get(name)?.delete(fn);
 const dispatch=name=>{for(const fn of listeners.get(name)??[])fn();};
 const react={useRef(value){const i=cursor++;return slots[i]??(slots[i]={current:value});},useState(value){const i=cursor++;slots[i]??={value};return [slots[i].value,v=>{slots[i].value=typeof v==='function'?v(slots[i].value):v;}];}};
 const effect=(queue)=>(fn,deps)=>{const i=cursor++,old=slots[i];if(!old||deps.some((v,j)=>v!==old[j])){slots[i]=deps;queue.push(()=>{cleanups[i]?.();cleanups[i]=fn();});}};
 react.useEffect=effect(effects);react.useLayoutEffect=effect(layouts);
 class AxisReader{constructor(){this.disposed=0;readers.push(this);}scan(blob,kind,signal){return new Promise((resolve,reject)=>jobs.push({resolve,reject,blob,kind,signal,reader:this}));}async dispose(){this.disposed++;}}
 const track={getSettings:()=>({displaySurface:'browser'}),cropTo:async()=>{},stop:()=>stopped++,addEventListener:listen};
 const stream={getTracks:()=>[track],getVideoTracks:()=>[track]};
 const video={muted:false,playsInline:false,srcObject:null,play:async()=>{},pause:()=>videoPaused++,videoWidth:1000,videoHeight:800};
 const document={hidden:false,addEventListener:listen,removeEventListener:unlisten,createElement:name=>name==='video'?video:{getContext:()=>({drawImage(){}}),toBlob:fn=>fn(new Blob(['frame']))}};
 const window={CropTarget:{fromElement:async()=>({})},addEventListener:listen,removeEventListener:unlisten};
 const bounds={width:1000,height:800};const target={current:{getBoundingClientRect:()=>bounds}};
 const context={exports:{},require:name=>name==='react'?react:name.includes('frame-gate')?gateModule.exports:{AxisReader},document,window,navigator:{mediaDevices:{getDisplayMedia:async()=>stream}},ResizeObserver:class{constructor(fn){resize.push(fn);}observe(){}disconnect(){}},AbortController,queueMicrotask,setTimeout:(fn,ms)=>{const id=nextTimer++;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),console};
 vm.runInNewContext(source,context);
 const render=(id=props.id,live=props.live)=>{props={id,live};cursor=0;api=context.exports.useFrameScanner(target,id,live);for(const f of layouts.splice(0))f();for(const f of effects.splice(0))f();return api;};
 render();
 return {get api(){return api;},render,jobs,readers,dispatch,bounds,resize:()=>resize.forEach(fn=>fn()),document,async tick(){const [id,timer]=timers.entries().next().value;timers.delete(id);timer.fn();await settle();},get stopped(){return stopped;},get paused(){return videoPaused;},unmount(){for(const fn of cleanups)fn?.();}};
}
const frame=id=>({id,timestamp:new Date().toISOString(),scale:{fit:{},reason:'ok'}});
test('capture publishes a valid frame, but blur/resize reject a stale render synchronously',async()=>{
 const h=harness();await settle();await h.api.start();await settle();h.jobs[0].resolve(frame('first'));await settle();h.render();
 const staleRender=h.api;assert.equal(staleRender.getLatest().id,'first');h.dispatch('blur');assert.equal(staleRender.getLatest(),null);
 await h.tick();h.jobs[1].resolve(frame('second'));await settle();h.render();assert.equal(h.api.getLatest().id,'second');h.resize();assert.equal(h.api.getLatest(),null);h.unmount();
});
test('in-flight results cannot survive reference changes, even away and back',async()=>{
 const h=harness();await settle();await h.api.start();await settle();h.render('b',true);h.render('a',true);h.jobs[0].resolve(frame('obsolete'));await settle();h.render();assert.equal(h.api.getLatest(),null);
 await h.tick();h.jobs[1].resolve(frame('fresh'));await settle();h.render();assert.equal(h.api.getLatest().id,'fresh');h.unmount();
});
test('latest image scan wins and stop invalidates pending image results',async()=>{
 const h=harness();await settle();h.render('image',false);await settle();const one=h.api.scanImage(new Blob(['one']),'image'),two=h.api.scanImage(new Blob(['two']),'image');
 assert.ok(h.jobs[0].signal.aborted);h.jobs[1].resolve(frame('two'));h.jobs[0].resolve(frame('one'));assert.equal((await two).id,'two');assert.equal(await one,null);
 const pending=h.api.scanImage(new Blob(['three']),'image');h.api.stop();h.jobs[2].resolve(frame('three'));assert.equal(await pending,null);h.unmount();
});
test('image reference changes reject pending OCR',async()=>{
 const h=harness();await settle();h.render('image',false);await settle();const pending=h.api.scanImage(new Blob(['image']),'image');h.render('other',false);h.jobs[0].resolve(frame('old-image'));assert.equal(await pending,null);h.unmount();
});
test('stopping capture releases media and rejects late frames; a new session survives old completion',async()=>{
 const h=harness();await settle();await h.api.start();await settle();h.api.stop();assert.equal(h.stopped,1);assert.equal(h.paused,1);
 await h.api.start();await settle();h.jobs[0].resolve(frame('old'));await settle();h.jobs[1].resolve(frame('new'));await settle();h.render();assert.equal(h.api.getLatest().id,'new');assert.equal(h.api.scanning,false);h.unmount();assert.equal(h.stopped,2);
});
test('hidden document rejects a completed frame and paused live scan cannot overwrite image status',async()=>{
 const h=harness();await settle();await h.api.start();await settle();h.document.hidden=true;h.dispatch('visibilitychange');h.jobs[0].resolve(frame('hidden'));await settle();h.render();assert.equal(h.api.getLatest(),null);
 h.document.hidden=false;await h.tick();h.render('image',false);const image=h.api.scanImage(new Blob(['image']),'image');h.jobs[1].reject(new Error('late live error'));await settle();h.jobs[2].resolve(frame('image'));assert.equal((await image).id,'image');h.render();assert.equal(h.api.capturing,true);assert.equal(h.api.scanning,false);h.unmount();
});

test('freezing checks geometry before ResizeObserver delivery; invalidated image errors remain silent',async()=>{
 const h=harness();await settle();await h.api.start();await settle();h.jobs[0].resolve(frame('frame'));await settle();h.render();assert.ok(h.api.getLatest());h.bounds.width=900;assert.equal(h.api.getLatest(),null);
 h.render('image',false);await settle();const pending=h.api.scanImage(new Blob(['image']),'image');h.render('other',false);const status=h.api.status;h.jobs[1].reject(new Error('obsolete failure'));await pending;h.render();assert.equal(h.api.status,status);h.unmount();
});
