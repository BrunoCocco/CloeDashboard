"use client";

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { calibrateScene, invalidateScene, estimatePrice, fitImage, newDocument, newScene, restoreDocument, serializeDocument, validateCalibration, type Calibration, type Drawing, type EditorDocument, type Point, type Scene } from '@/lib/chart-editor/model';
import styles from './chart-editor.module.css';

type Tool = 'navigate' | 'select' | 'segment' | 'horizontal' | 'freehand' | 'calibrate';
const names: [Tool,string][] = [['navigate','Navegar'],['select','Seleccionar'],['segment','Línea'],['horizontal','Horizontal'],['freehand','Libre'],['calibrate','Calibrar']];
function download(text:string,type:string,name:string) {
  const url=URL.createObjectURL(new Blob([text],{type}));
  const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function ChartEditor({userId}:{userId:string}) {
  const [doc,setDoc]=useState<EditorDocument|null>(null);
  const [tool,setTool]=useState<Tool>('navigate');
  const [selected,setSelected]=useState<string|null>(null);
  const [draft,setDraft]=useState<Drawing|null>(null);
  const [message,setMessage]=useState('');
  const [panel,setPanel]=useState(false);
  const [size,setSize]=useState({width:0,height:0});
  const [anchors,setAnchors]=useState<[number|null,number|null]>([null,null]);
  const [prices,setPrices]=useState<[string,string]>(['','']);
  const [anchorIndex,setAnchorIndex]=useState<0|1>(0);
  const [scale,setScale]=useState<'linear'|'log'>('linear');
  const rootRef=useRef<HTMLDivElement>(null);
  const svgRef=useRef<SVGSVGElement>(null);
  const storageKey=`cloe-chart-editor:v1:${userId}`;
  const scene=doc?.scenes.find(s=>s.reference.id===doc.activeId);

  function updateScene(update:(scene:Scene)=>Scene) {
    setDoc(d=>d?{...d,scenes:d.scenes.map(s=>s.reference.id===d.activeId?update(s):s)}:d);
  }
  function invalidate(reason:string) {
    setDoc(d=>d?{...d,scenes:d.scenes.map(s=>s.reference.id===d.activeId&&s.reference.kind==='live'?invalidateScene(s,reason):s)}:d);
  }
  useEffect(()=>{
    let cancelled=false;
    queueMicrotask(()=>{
      if(cancelled)return;
      try {const saved=localStorage.getItem(storageKey);setDoc(saved?restoreDocument(saved)??newDocument():newDocument());}
      catch {setDoc(newDocument());setMessage('Almacenamiento local no disponible. Exportá el JSON para conservar tu trabajo.');}
    });
    return ()=>{cancelled=true;};
  },[storageKey]);
  useEffect(()=>{
    if(!doc)return;
    const timer=setTimeout(()=>{try{localStorage.setItem(storageKey,serializeDocument(doc));}catch{setMessage('No se pudo guardar en este dispositivo (espacio o permiso). Exportá el JSON ahora.');}},300);
    return()=>clearTimeout(timer);
  },[doc,storageKey]);
  useEffect(()=>{
    const el=rootRef.current;if(!el)return;
    let previous='';
    const observer=new ResizeObserver(([entry])=>{
      const {width,height}=entry.contentRect;
      const geometry=`${width}:${height}`;
      setSize({width,height});
      if(previous&&previous!==geometry)invalidate('Cambió el tamaño de la vista viva: recalibrá.');
      previous=geometry;
    });observer.observe(el);
    const blur=()=>invalidate('La vista perdió el foco: verificá la escala y recalibrá.');
    window.addEventListener('blur',blur);
    return()=>{observer.disconnect();window.removeEventListener('blur',blur);};
  },[]);

  function changeTool(next:Tool) {
    if(next==='navigate')invalidate('Navegación activada: la escala de TradingView puede cambiar. Recalibrá.');
    setTool(next);setDraft(null);
    if(next==='calibrate')setPanel(true);
  }
  const reference=scene?.reference;
  const rect=reference?.kind==='capture'?fitImage(size.width,size.height,reference.imageWidth!,reference.imageHeight!):{left:0,top:0,...size};
  function point(e:PointerEvent<SVGSVGElement>):Point {
    const bounds=e.currentTarget.getBoundingClientRect();
    return {x:Math.max(0,Math.min(1,(e.clientX-bounds.left)/bounds.width)),y:Math.max(0,Math.min(1,(e.clientY-bounds.top)/bounds.height))};
  }
  function pointerDown(e:PointerEvent<SVGSVGElement>) {
    if(e.button!==0||!scene)return;
    const p=point(e);
    if(tool==='calibrate'){setAnchors(a=>anchorIndex===0?[p.y,a[1]]:[a[0],p.y]);setAnchorIndex(anchorIndex===0?1:0);return;}
    if(tool==='select'){setSelected(null);return;}
    if(!['segment','horizontal','freehand'].includes(tool))return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraft({id:crypto.randomUUID(),kind:tool as Drawing['kind'],points:tool==='horizontal'?[{x:0,y:p.y},{x:1,y:p.y}]:[p,p],createdAt:new Date().toISOString()});
  }
  function pointerMove(e:PointerEvent<SVGSVGElement>) {
    if(!draft)return;const p=point(e);
    setDraft(d=>d?{...d,points:d.kind==='freehand'?[...d.points,p]:d.kind==='horizontal'?[{x:0,y:p.y},{x:1,y:p.y}]:[d.points[0],p]}:null);
  }
  function pointerUp(e:PointerEvent<SVGSVGElement>) {
    if(!draft)return;
    const p=point(e);
    const completed={...draft,referenceSizeAtCreation:{width:rect.width,height:rect.height},calibrationAtCreation:scene?.calibration??null,points:draft.kind==='freehand'?[...draft.points,p]:draft.kind==='horizontal'?[{x:0,y:p.y},{x:1,y:p.y}]:[draft.points[0],p]};
    updateScene(s=>({...s,drawings:[...s.drawings,completed]}));setSelected(completed.id);setDraft(null);
  }
  function applyCalibration() {
    if(anchors[0]===null||anchors[1]===null||!prices[0].trim()||!prices[1].trim()){setMessage('Marcá las dos alturas y escribí ambos precios sin separadores de miles.');return;}
    const c:Calibration={source:'manual-two-points',referenceSize:{width:rect.width,height:rect.height},scale,anchors:[{y:anchors[0],price:Number(prices[0])},{y:anchors[1],price:Number(prices[1])}],createdAt:new Date().toISOString()};
    const error=validateCalibration(c);if(error){setMessage(error);return;}
    updateScene(s=>calibrateScene(s,c));setMessage('Calibración manual aplicada. Los precios son estimaciones.');setTool('select');
  }
  async function loadImage(file:File) {
    if(!file.type.startsWith('image/')){setMessage('Seleccioná una imagen del gráfico.');return;}
    if(file.size>15*1024*1024){setMessage('La imagen supera 15 MB. Cargá una captura más pequeña.');return;}
    try {
      const url=URL.createObjectURL(file);const image=new Image();
      try {image.src=url;await image.decode();}finally{URL.revokeObjectURL(url);}
      const ratio=Math.min(1,2400/image.naturalWidth,2400/image.naturalHeight);
      const canvas=document.createElement('canvas');canvas.width=Math.round(image.naturalWidth*ratio);canvas.height=Math.round(image.naturalHeight*ratio);
      canvas.getContext('2d')!.drawImage(image,0,0,canvas.width,canvas.height);
      const data=canvas.toDataURL('image/jpeg',0.88);
      if(data.length>3*1024*1024){setMessage('Captura demasiado grande para guardar localmente; reducí la resolución.');return;}
      const next=newScene({id:crypto.randomUUID(),kind:'capture',image:data,imageWidth:canvas.width,imageHeight:canvas.height,name:file.name,createdAt:new Date().toISOString()});
      setDoc(d=>d?{...d,scenes:[...d.scenes,next],activeId:next.reference.id}:d);setAnchors([null,null]);setPrices(['','']);setSelected(null);setTool('select');setMessage('Nueva captura congelada. Activo y temporalidad de la imagen no verificados; calibración independiente.');
    }catch{setMessage('No se pudo abrir esa imagen. Probá PNG o JPEG.');}
  }
  async function importJson(file:File) {
    if(file.size>20*1024*1024){setMessage('El JSON supera 20 MB.');return;}
    try {const restored=restoreDocument(await file.text());if(!restored){setMessage('Documento no válido o versión no compatible.');return;}setDoc(restored);setTool('select');setSelected(null);setDraft(null);setAnchors([null,null]);setPrices(['','']);setMessage('Documento restaurado en este dispositivo. Las vistas vivas requieren nueva calibración.');}
    catch{setMessage('No se pudo leer el JSON.');}
  }
  function newLive() {
    const next=newScene();setDoc(d=>d?{...d,scenes:[...d.scenes,next],activeId:next.reference.id}:d);setAnchors([null,null]);setPrices(['','']);setSelected(null);setTool('navigate');
  }
  function exportSvg() {
    if(!svgRef.current||!doc)return;
    const clone=svgRef.current.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns','http://www.w3.org/2000/svg');clone.setAttribute('width',String(rect.width));clone.setAttribute('height',String(rect.height));
    const meta=document.createElementNS('http://www.w3.org/2000/svg','metadata');meta.textContent=serializeDocument(doc);clone.prepend(meta);
    download(new XMLSerializer().serializeToString(clone),'image/svg+xml','cloe-dibujos.svg');
  }
  const activeDrawing=scene?.drawings.find(d=>d.id===selected);
  function reading(p:Point) {
    const result=estimatePrice(p.y,scene?.calibration??null);
    return `x ${(p.x*100).toFixed(2)}% · y ${(p.y*100).toFixed(2)}% · ${(p.y*rect.height).toFixed(1)} px${result?` · ≈ ${result.price.toFixed(2)} USDT${result.extrapolated?' (extrapolado)':''}`:' · sin precio calibrado'}`;
  }
  return <div ref={rootRef} className={styles.root}>
    {reference?.kind==='capture'?<div className={styles.backdrop}/>:null}
    <div className={styles.stage} style={rect}>
      {/* User-supplied local capture stays entirely in this browser. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {reference?.kind==='capture'?<img src={reference.image} alt="Captura local de referencia congelada" draggable={false}/>:null}
      <svg ref={svgRef} className={styles.overlay} style={{pointerEvents:tool==='navigate'?'none':'auto',touchAction:tool==='navigate'?'auto':'none'}} viewBox="0 0 1 1" preserveAspectRatio="none" aria-label="Capa de dibujos propios" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={()=>setDraft(null)}>
        {[...(scene?.drawings??[]),...(draft?[draft]:[])].map(d=><polyline key={d.id} points={d.points.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke={d.id===selected?'#facc15':'#22d3ee'} strokeWidth={d.id===selected?4:3} vectorEffect="non-scaling-stroke" style={{cursor:tool==='select'?'pointer':undefined,pointerEvents:tool==='select'?'stroke':'none'}} onPointerDown={e=>{if(tool==='select'){e.stopPropagation();setSelected(d.id);setPanel(true);}}}/>)}
        {tool==='calibrate'?anchors.map((y,i)=>y!==null?<line key={i} x1="0" x2="1" y1={y} y2={y} stroke={i===0?'#fb7185':'#a78bfa'} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeDasharray="6 4" pointerEvents="none"/>:null):null}
      </svg>
    </div>
    <div className={styles.controls}>
      <div className={styles.toolbar} role="toolbar" aria-label="Editor transparente">
        {names.map(([value,label])=><button key={value} aria-pressed={tool===value} onClick={()=>changeTool(value)}>{label}</button>)}
        <button onClick={()=>updateScene(s=>({...s,drawings:s.drawings.slice(0,-1)}))} disabled={!scene?.drawings.length}>Deshacer</button>
        <button onClick={()=>{updateScene(s=>({...s,drawings:s.drawings.filter(d=>d.id!==selected)}));setSelected(null);}} disabled={!selected}>Borrar</button>
        <button aria-expanded={panel} onClick={()=>setPanel(!panel)}>{panel?'Ocultar datos':'Datos / captura'}</button>
      </div>
      <p className={styles.badge}>Dibujos anclados a {reference?.kind==='capture'?'captura fija':'pantalla viva'} · {scene?.calibration?'calibración manual activa (estimaciones)':'SIN calibración de precio'}</p>
      {panel?<section className={styles.panel} aria-label="Datos del editor">
        <strong>Editor propio · {reference?.kind==='capture'?'captura fija':'TradingView vivo'}</strong>
        <p>Inicio: BTCUSDT · semanal. No podemos leer cambios de escala/temporalidad ni dibujos dentro de TradingView. Esta capa guarda coordenadas de pantalla; no sigue velas. Sin OCR automático.</p>
        <div className={styles.row}><label className={styles.upload}>Cargar captura<input type="file" accept="image/*" onChange={e=>{const file=e.target.files?.[0];if(file)void loadImage(file);e.target.value='';}}/></label><button onClick={newLive}>Nueva vista viva</button><label className={styles.upload}>Importar JSON<input type="file" accept="application/json,.json" onChange={e=>{const file=e.target.files?.[0];if(file)void importJson(file);e.target.value='';}}/></label></div>
        <label>Referencia guardada<select value={doc?.activeId??''} onChange={e=>{setDoc(d=>d?{...d,activeId:e.target.value}:d);setAnchors([null,null]);setPrices(['','']);setSelected(null);setDraft(null);setTool('select');invalidate('Cambio de referencia: verificá y recalibrá la vista viva.');}}>{doc?.scenes.map((s,i)=><option key={s.reference.id} value={s.reference.id}>{i+1}. {s.reference.kind==='live'?'Viva':s.reference.name??'Captura'}</option>)}</select></label>
        <fieldset><legend>Calibración manual de precio (mismo panel, nunca volumen)</legend>
          <p>Usá dos etiquetas del eje de precios: elegí una referencia, pulsá su altura en el gráfico y escribí el precio exacto. Decimal con punto, sin separadores de miles.</p>
          {[0,1].map(i=><div key={i} className={styles.row}><button aria-pressed={tool==='calibrate'&&anchorIndex===i} onClick={()=>{setAnchorIndex(i as 0|1);setTool('calibrate');}}>Marcar {i+1}{anchors[i]!==null?` (${(anchors[i]!*100).toFixed(1)}%)`:''}</button><input aria-label={`Precio referencia ${i+1}`} type="number" min="0" step="any" inputMode="decimal" value={prices[i]} onChange={e=>setPrices(p=>i===0?[e.target.value,p[1]]:[p[0],e.target.value])}/></div>)}
          <label>Escala<select value={scale} onChange={e=>setScale(e.target.value as 'linear'|'log')}><option value="linear">Lineal</option><option value="log">Logarítmica</option></select></label><button onClick={applyCalibration}>Aplicar calibración</button>
        </fieldset>
        <p>{scene?.calibration?`Precio estimado · escala ${scene.calibration.scale} · origen manual.`:scene?.invalidationReason??'Sin calibración: solo coordenadas.'} En vivo, navegar, redimensionar o perder foco invalida la calibración; un cambio automático del iframe no es detectable. Preferí captura para comparar con precisión.</p>
        <label>Dibujo<select value={selected??''} onChange={e=>setSelected(e.target.value||null)}><option value="">Seleccioná un dibujo</option>{scene?.drawings.map((d,i)=><option key={d.id} value={d.id}>{i+1}. {d.kind}</option>)}</select></label>
        {activeDrawing?<div className={styles.readings}><p>{activeDrawing.points.length} puntos · {activeDrawing.createdAt}</p><p>Inicio: {reading(activeDrawing.points[0])}</p><p>Fin: {reading(activeDrawing.points.at(-1)!)}</p></div>:null}
        <div className={styles.row}><button disabled={!doc} onClick={()=>doc&&download(serializeDocument(doc),'application/json','cloe-editor.json')}>Exportar JSON + capturas</button><button disabled={!doc} onClick={exportSvg}>Exportar SVG</button></div>
        <p>Guardado local por cuenta y dispositivo. No se envía a Cloe ni a un servidor. JSON incluye imagen reducida (máx. 2400 px), puntos y calibraciones para reconstrucción; SVG exporta la capa activa.</p>
      </section>:null}
      {message?<p role="status" className={styles.message}>{message}<button aria-label="Cerrar aviso" onClick={()=>setMessage('')}>×</button></p>:null}
    </div>
  </div>;
}
