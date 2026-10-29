import test from 'node:test';
import assert from 'node:assert/strict';
import {rmSync} from 'node:fs';
import {loadVisionModules} from './chart-vision-test-utils.mjs';
const modules=await loadVisionModules();
const {makePriceLabel,parseLabelPrice}=modules['price-labels'],{fitPriceScale,priceFromScale}=modules.scale,{detectCandles}=modules.candles,{FrameGate}=modules['frame-gate'];
const labels=(log=false)=>[100,220,340,460,580].map((y,i)=>makePriceLabel(String(log?Math.round(200000*Math.exp(-i*.25)):110000-i*10000),95,{x0:910,x1:990,y0:y-8,y1:y+8},`p${i}`));
test('numeric parsing abstains on ambiguous separators, suffixes and OCR letter confusion',()=>{
 for(const raw of ['95.000','95,000','90K','1O000','-20','0','1,23,456'])assert.equal(parseLabelPrice(raw).price,null);
 for(const [raw,price] of [['95,000.50',95000.5],['95.000,50',95000.5],['95000',95000],['95000.5',95000.5]])assert.equal(parseLabelPrice(raw).price,price);
});
test('robust linear fit rejects outliers/volume, bounds prices and includes glyph-position uncertainty',()=>{
 const input=[...labels(),makePriceLabel('999999',99,{x0:910,x1:990,y0:274,y1:290},'bad'),makePriceLabel('50',99,{x0:910,x1:990,y0:790,y1:806},'volume')];
 const fit=fitPriceScale(input,1000,900).fit;assert.ok(fit);assert.equal(fit.scale,'linear');assert.equal(fit.inlierIds.length,5);assert.equal(priceFromScale(50,fit),null);assert.equal(priceFromScale(800,fit),null);assert.ok(priceFromScale(340,fit).errorPrice>=600);assert.equal(priceFromScale(340,fit).price,90000);
});
test('log scale is selected only with substantial curvature; ambiguous narrow ranges abstain',()=>{
 const fit=fitPriceScale(labels(true),1000,900).fit;assert.ok(fit);assert.equal(fit.scale,'log');
 const tight=labels().map((l,i)=>makePriceLabel(String(100000-i*10),95,l.bbox,l.id));assert.equal(fitPriceScale(tight,1000,900).fit,null);
});
test('insufficient labels, bottom panels, low confidence and wrong columns yield no scale',()=>{
 assert.equal(fitPriceScale(labels().slice(0,2),1000,900).fit,null);
 assert.equal(fitPriceScale(labels().map(l=>({...l,bbox:{...l.bbox,y0:l.bbox.y0+650,y1:l.bbox.y1+650}})),1000,900).fit,null);
 assert.equal(fitPriceScale(labels().map(l=>({...l,confidence:20})),1000,900).fit,null);
 assert.equal(fitPriceScale(labels().map(l=>({...l,bbox:{...l.bbox,x0:100,x1:180}})),1000,900).fit,null);
});
test('revision leases reject frames after geometry/reference changes or teardown',()=>{
 const gate=new FrameGate(),first=gate.lease('a');assert.equal(gate.accepts(first,'a'),true);assert.equal(gate.accepts(first,'b'),false);gate.invalidate();assert.equal(gate.accepts(first,'a'),false);const next=gate.lease('a');gate.dispose();assert.equal(gate.accepts(next,'a'),false);
});
test('RGBA body/wick geometry finds color-directed OHLC candidates and rejects doji/unknown colors/volume',()=>{
 const width=1000,height=900,data=new Uint8ClampedArray(width*height*4);const fill=(x0,y0,x1,y1,rgb)=>{for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const i=(y*width+x)*4;data.set([...rgb,255],i);}};
 fill(100,200,108,240,[38,166,154]);fill(104,185,104,260,[38,166,154]);
 fill(200,300,208,350,[239,83,80]);fill(204,280,204,370,[239,83,80]);
 fill(300,200,308,200,[38,166,154]);fill(304,185,304,260,[38,166,154]);
 fill(400,200,408,240,[0,200,255]);fill(404,185,404,260,[0,200,255]);
 fill(500,780,508,820,[38,166,154]);
 const found=detectCandles({width,height,data},fitPriceScale(labels(),width,height).fit);
 assert.equal(found.length,2);assert.equal(found[0].high,185);assert.equal(found[0].low,260);assert.equal(found[0].open,240);assert.equal(found[0].close,200);assert.equal(found[1].open,300);assert.equal(found[1].close,350);
});
test('failed OCR preserves evidence/invalidation history and cannot reprice original drawings',()=>{
 const {newScene,applyFrameReading}=modules.model;
 const scene=newScene({id:'a',kind:'capture',image:'data:image/png;base64,a',imageWidth:1000,imageHeight:900,createdAt:'now'});
 const fit=fitPriceScale(labels(),1000,900).fit;
 const frame={id:'f',timestamp:'now',sha256:'test',width:1000,height:900,labels:labels(),scale:{fit,reason:'ok'},candles:[],image:scene.reference.image,source:'local-image',status:'estimated-frame'};
 const calibrated=applyFrameReading(scene,frame);assert.ok(calibrated.calibration);
 const failed=applyFrameReading(calibrated,{...frame,id:'g',scale:{fit:null,reason:'ambiguous'}});assert.equal(failed.calibration,null);assert.equal(failed.calibrationHistory.at(-1).action,'invalidated');assert.equal(failed.scanHistory.length,2);assert.equal(failed.scanHistory[1].labels.length,5);assert.ok(calibrated.calibration);
 assert.equal(applyFrameReading(scene,{...frame,width:500}),scene);
});
test('shared capture cleanup closes tracks, worker, timer, video and abort lease exactly once',async()=>{
 const {releaseCapture}=modules['frame-gate'];let stopped=0,disposed=0,paused=0,timerFired=false;const gate=new FrameGate(),lease=gate.lease('a');
 const s={gate,controller:new AbortController(),timer:setTimeout(()=>{timerFired=true;},5),stream:{getTracks:()=>[{stop:()=>stopped++},{stop:()=>stopped++}]},video:{pause:()=>paused++,srcObject:{}},reader:{dispose:async()=>{disposed++;}}};
 releaseCapture(s);releaseCapture(s);await new Promise(resolve=>setTimeout(resolve,10));
 assert.equal(stopped,2);assert.equal(disposed,1);assert.equal(paused,1);assert.equal(s.video.srcObject,null);assert.ok(s.controller.signal.aborted);assert.equal(gate.accepts(lease,'a'),false);assert.equal(timerFired,false);
});
process.on('exit',()=>rmSync(modules.dir,{recursive:true,force:true}));
