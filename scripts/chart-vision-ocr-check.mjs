// Real Tesseract.js execution on synthetic rendered text, not mocked OCR.
// Supply TESSDATA_PATH pointing at a directory containing eng.traineddata (uncompressed).
import {createWorker,PSM} from 'tesseract.js';
import {readFileSync,mkdirSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {loadVisionModules} from './chart-vision-test-utils.mjs';
const modules=await loadVisionModules();
const cachePath=join(tmpdir(),'cloe-ocr-test-cache');mkdirSync(cachePath,{recursive:true});
const worker=await createWorker('eng',1,{langPath:process.env.TESSDATA_PATH??'/usr/share/tesseract-ocr/5/tessdata',gzip:false,cachePath});
try {
 await worker.setParameters({tessedit_pageseg_mode:PSM.SPARSE_TEXT});
 // Same narrow-axis crop and 3x upsample used in browser; normalization preserves bbox coordinates.
 const source=new URL('./fixtures/axis-candles-synthetic.png',import.meta.url),width=1600,height=900,left=Math.floor(width*.87),factor=3;
 const prepared=await sharp(readFileSync(source)).extract({left,top:0,width:width-left,height}).resize((width-left)*factor,height*factor).greyscale().negate().png().toBuffer();
 const {data}=await worker.recognize(prepared,{}, {blocks:true,text:true});
 const labels=[];
 for(const block of data.blocks??[])for(const para of block.paragraphs)for(const line of para.lines)for(const word of line.words){const b=word.bbox;labels.push(modules['price-labels'].makePriceLabel(word.text,word.confidence,{x0:left+b.x0/factor,x1:left+b.x1/factor,y0:b.y0/factor,y1:b.y1/factor},`ocr-${labels.length}`));}
 const result=modules.scale.fitPriceScale(labels,width,height);assert.ok(result.fit,result.reason);assert.equal(result.fit.inlierIds.length,5);assert.equal(result.fit.scale,'linear');assert.ok(!result.fit.inlierIds.some(id=>labels.find(l=>l.id===id)?.price===50));
 assert.ok(result.fit.rejectedLabels.some(l=>l.price===50));
 const at400=modules.scale.priceFromScale(400,result.fit);assert.ok(Math.abs(at400.price-100000)<=at400.errorPrice,'Error budget must cover glyph-center offset');
 const {data:rgba}=await sharp(readFileSync(source)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const candles=modules.candles.detectCandles({width,height,data:new Uint8ClampedArray(rgba)},result.fit);
 const truth=JSON.parse(readFileSync(new URL('./fixtures/axis-candles-truth.json',import.meta.url),'utf8'));assert.equal(candles.length,truth.candles.length);
 for(const [i,c] of candles.entries()){assert.equal(c.x,truth.candles[i].x);for(const key of ['high','low','open','close'])assert.ok(Math.abs(c.prices[key].price-truth.candles[i][key])<=c.prices[key].errorPrice+40,`${key} estimate out of expected visual uncertainty`);}
 console.log(JSON.stringify({ocr:'Tesseract.js 6 real execution',synthetic:true,labels:labels.map(l=>({raw:l.raw,confidence:l.confidence})),scale:result.fit.scale,inliers:result.fit.inlierIds.length,rejected:result.fit.rejectedLabels.map(l=>l.raw),at400,candleCandidates:candles.length,limitations:'synthetic standard-color chart only; no real TradingView capture tested'},null,2));
}finally{await worker.terminate();rmSync(modules.dir,{recursive:true,force:true});}
