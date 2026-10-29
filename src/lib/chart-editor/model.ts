import type { FrameReading } from './ocr';
import type { CandleCandidate } from './candles';
import type { ScaleFit } from './scale';
export type Point = { x: number; y: number };
export type Drawing = { id: string; kind: 'segment' | 'horizontal' | 'freehand'; points: Point[]; createdAt: string; referenceSizeAtCreation?: {width:number;height:number}; calibrationAtCreation?: Calibration | null };
export type Calibration = { source: 'manual-two-points' | 'local-ocr-axis'; fit?: ScaleFit; frameEvidence?: Omit<FrameReading,'image'|'candles'>; referenceSize?: {width:number;height:number}; scale: 'linear' | 'log'; anchors: [{ y: number; price: number }, { y: number; price: number }]; createdAt: string };
export type Reference = { id: string; kind: 'live' | 'capture'; createdAt: string; image?: string; imageWidth?: number; imageHeight?: number; name?: string };
export type CalibrationEvent = { at: string; action: 'applied' | 'invalidated'; calibration: Calibration | null; reason: string | null };
export type Scene = { scanHistory?: Omit<FrameReading,'image'|'candles'>[]; candleCandidates?: CandleCandidate[]; lastScan?: {id:string;timestamp:string;sha256:string;reason:string}; calibrationHistory: CalibrationEvent[]; reference: Reference; drawings: Drawing[]; calibration: Calibration | null; invalidationReason: string | null };
export type EditorDocument = { version: 1; symbol: 'BINANCE:BTCUSDT'; symbolVerified: false; initialTimeframe: 'W'; timeframeVerified: false; scenes: Scene[]; activeId: string };
export function newScene(reference?: Reference): Scene {
  return { calibrationHistory: [], reference: reference ?? { id: crypto.randomUUID(), kind: 'live', createdAt: new Date().toISOString() }, drawings: [], calibration: null, invalidationReason: null };
}
export function newDocument(): EditorDocument {
  const scene = newScene();
  return { version: 1, symbol: 'BINANCE:BTCUSDT', symbolVerified: false, initialTimeframe: 'W', timeframeVerified: false, scenes: [scene], activeId: scene.reference.id };
}
export function validateCalibration(c: Calibration): string | null {
  if (!c || !['linear','log'].includes(c.scale) || !['manual-two-points','local-ocr-axis'].includes(c.source) || !Array.isArray(c.anchors) || c.anchors.length!==2 || !c.anchors[0] || !c.anchors[1]) return 'Calibración no válida.';
  if(c.source==='local-ocr-axis'&&(!c.fit||!c.frameEvidence||c.fit.inlierIds.length<3||!c.fit.uncertaintyPx))return 'Evidencia OCR insuficiente.';
  const [a,b] = c.anchors;
  if (![a.y,b.y,a.price,b.price].every(Number.isFinite)) return 'Las referencias deben ser números finitos.';
  if (a.y < 0 || a.y > 1 || b.y < 0 || b.y > 1) return 'Marcá ambas alturas dentro del gráfico.';
  if (Math.abs(a.y-b.y) < 0.00001) return 'Las alturas deben ser distintas.';
  if (a.price <= 0 || b.price <= 0 || a.price === b.price) return 'Usá dos precios positivos y distintos.';
  if ((a.price-b.price)*(a.y-b.y) >= 0) return 'El precio superior debe ser mayor que el inferior.';
  return null;
}
export function estimatePrice(y: number, c: Calibration | null) {
  if (!c || validateCalibration(c) || !Number.isFinite(y)) return null;
  if(c.source==='local-ocr-axis'&&c.fit&&(y*c.fit.height<c.fit.validY[0]||y*c.fit.height>c.fit.validY[1]))return null;
  const [a,b] = c.anchors;
  const t = (y-a.y)/(b.y-a.y);
  const price = c.scale === 'log' ? Math.exp(Math.log(a.price)+t*(Math.log(b.price)-Math.log(a.price))) : a.price+t*(b.price-a.price);
  if (!Number.isFinite(price) || price <= 0) return null;
  const errorY=c.fit?c.fit.uncertaintyPx/c.fit.height:0;
  const at=(py:number)=>{const pt=(py-a.y)/(b.y-a.y);return c.scale==='log'?Math.exp(Math.log(a.price)+pt*(Math.log(b.price)-Math.log(a.price))):a.price+pt*(b.price-a.price);};
  return { price, estimated: true, extrapolated: t < 0 || t > 1, errorPrice:errorY?Math.max(Math.abs(at(y-errorY)-price),Math.abs(at(y+errorY)-price)):null, source:c.source }; 
}
export function fitImage(width:number, height:number, imageWidth:number, imageHeight:number) {
  if (![width,height,imageWidth,imageHeight].every(n=>Number.isFinite(n)&&n>0)) return {left:0,top:0,width:0,height:0};
  const ratio = Math.min(width/imageWidth,height/imageHeight);
  const w=imageWidth*ratio,h=imageHeight*ratio;
  return {left:(width-w)/2,top:(height-h)/2,width:w,height:h};
}
export function calibrateScene(s:Scene,calibration:Calibration):Scene {
  if(validateCalibration(calibration))return s;
  return {...s,calibration,invalidationReason:null,calibrationHistory:[...s.calibrationHistory,{at:new Date().toISOString(),action:'applied',calibration,reason:null}]};
}
export function invalidateScene(s:Scene,reason:string):Scene {
  if(s.reference.kind!=='live')return s;
  return {...s,calibration:null,invalidationReason:reason,calibrationHistory:s.calibration?[...s.calibrationHistory,{at:new Date().toISOString(),action:'invalidated',calibration:s.calibration,reason}]:s.calibrationHistory};
}
export function applyFrameReading(s:Scene,frame:FrameReading):Scene {
  if(s.reference.kind!=='capture'||s.reference.imageWidth!==frame.width||s.reference.imageHeight!==frame.height)return s;
  const {image:_savedImage,candles:_detectedCandles,...scanEvidence}=frame;void _savedImage;void _detectedCandles;
  const scanHistory=[...(s.scanHistory??[]),scanEvidence];
  const lastScan={id:frame.id,timestamp:frame.timestamp,sha256:frame.sha256,reason:frame.scale.reason};
  if(!frame.scale.fit)return {...s,calibration:null,lastScan,scanHistory,candleCandidates:[],calibrationHistory:s.calibration?[...s.calibrationHistory,{at:new Date().toISOString(),action:'invalidated',calibration:s.calibration,reason:frame.scale.reason}]:s.calibrationHistory};
  const fit=frame.scale.fit;
  const at=(y:number)=>fit.scale==='log'?Math.exp(fit.intercept+fit.slope*y):fit.intercept+fit.slope*y;
  const {image:_image,candles,...frameEvidence}=frame;
  void _image;
  const calibration:Calibration={source:'local-ocr-axis',scale:fit.scale,fit,frameEvidence,referenceSize:{width:frame.width,height:frame.height},anchors:[{y:fit.validY[0]/fit.height,price:at(fit.validY[0])},{y:fit.validY[1]/fit.height,price:at(fit.validY[1])}],createdAt:new Date().toISOString()};
  return {...calibrateScene(s,calibration),lastScan,scanHistory,candleCandidates:candles};
}
export function serializeDocument(doc: EditorDocument) {
  return JSON.stringify({ ...doc, exportedAt: new Date().toISOString(), coordinateSystem: 'normalized-reference-image-or-live-viewport', limitations: ['Live drawings are screen coordinates, not candle/time anchors.', 'TradingView scale/timeframe and drawings are inaccessible across origins.', 'Prices are estimates from manual calibration or local OCR evidence, not verified feed quotes.'], scenes: doc.scenes.map(s=>({...s, readings:s.drawings.map(d=>({id:d.id, points:d.points.map(p=>({...p,currentCalibrationEstimate:estimatePrice(p.y,s.calibration),creationCalibrationEstimate:estimatePrice(p.y,d.calibrationAtCreation??null)}))}))})) },null,2);
}
export function restoreDocument(raw:string): EditorDocument | null {
  try {
    const doc=JSON.parse(raw) as EditorDocument;
    if (doc.version!==1 || doc.symbol!=='BINANCE:BTCUSDT' || !Array.isArray(doc.scenes) || !doc.scenes.length || !doc.scenes.some(s=>s.reference.id===doc.activeId)) return null;
    for(const s of doc.scenes) {
      if (!s.reference || !['live','capture'].includes(s.reference.kind) || !Array.isArray(s.drawings)) return null;
      if (s.reference.kind==='capture' && (!s.reference.image?.startsWith('data:image/') || ![s.reference.imageWidth,s.reference.imageHeight].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>0))) return null;
      if(!Array.isArray(s.calibrationHistory))s.calibrationHistory=[];
      for(const d of s.drawings) if (!['segment','horizontal','freehand'].includes(d.kind) || !Array.isArray(d.points) || d.points.length<2 || !d.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1)) return null;
      if(s.calibration && validateCalibration(s.calibration)) return null;
      if(s.reference.kind==='live') Object.assign(s,invalidateScene(s,'Vista viva restaurada: recalibrá antes de estimar precios.'));
    }
    return {...doc,symbolVerified:false,timeframeVerified:false};
  } catch {return null;}
}
