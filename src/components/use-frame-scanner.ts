"use client";
import { useEffect, useRef, useState, type RefObject } from 'react';
import { AxisReader, type FrameReading } from '@/lib/chart-editor/ocr';
import { FrameGate, releaseCapture } from '@/lib/chart-editor/frame-gate';
type Session={stream:MediaStream;video:HTMLVideoElement;reader:AxisReader;controller:AbortController;gate:FrameGate;timer:ReturnType<typeof setTimeout>|null;paused:boolean;referenceId:string};
export function useFrameScanner(target:RefObject<HTMLDivElement|null>,referenceId:string,live:boolean) {
  const session=useRef<Session|null>(null);
  const imageJob=useRef<{reader:AxisReader;controller:AbortController;gate:FrameGate;referenceId:string}|null>(null);
  const [latest,setLatest]=useState<FrameReading|null>(null);
  const [status,setStatus]=useState('Sin lectura automática.');
  const [capturing,setCapturing]=useState(false);
  const [scanning,setScanning]=useState(false);
  const alive=useRef(true);
  const generation=useRef(0);
  const currentContext=useRef({referenceId,live});
  function advanceGeneration(){generation.current++;}
  function close(s:Session){releaseCapture(s);}
  function stop(){advanceGeneration();const s=session.current;session.current=null;if(s)close(s);imageJob.current?.controller.abort();imageJob.current?.gate.dispose();void imageJob.current?.reader.dispose();imageJob.current=null;setCapturing(false);setScanning(false);setLatest(null);setStatus('Captura detenida; las escenas congeladas conservan su evidencia.');}
  useEffect(()=>{
    alive.current=true;
    return()=>{alive.current=false;advanceGeneration();const s=session.current;session.current=null;if(s)close(s);imageJob.current?.gate.dispose();imageJob.current?.controller.abort();void imageJob.current?.reader.dispose();};
  },[]);
  useEffect(()=>{
    currentContext.current={referenceId,live};
    const s=session.current;if(s){s.paused=!live;s.referenceId=referenceId;s.gate.invalidate();}
    queueMicrotask(()=>{if(alive.current)setLatest(null);});
    if(imageJob.current&&imageJob.current.referenceId!==referenceId)imageJob.current.gate.invalidate();
  },[live,referenceId]);
  useEffect(()=>{
    const element=target.current;if(!element)return;
    const invalidate=()=>{const s=session.current;if(s){s.gate.invalidate();setLatest(null);setStatus('Geometría/navegación cambiada: esperando otro frame.');}};
    const observer=new ResizeObserver(invalidate);observer.observe(element);
    const visibility=()=>{if(document.hidden)invalidate();};
    document.addEventListener('visibilitychange',visibility);
    return()=>{observer.disconnect();document.removeEventListener('visibilitychange',visibility);};
  },[target]);
  async function start() {
    stop();
    const startGeneration=generation.current;
    const current=()=>alive.current&&generation.current===startGeneration;
    const cropApi=(window as unknown as {CropTarget?:{fromElement:(element:HTMLElement)=>Promise<unknown>}}).CropTarget;
    if(!navigator.mediaDevices?.getDisplayMedia||!cropApi||!target.current){setStatus('Este navegador no admite captura de pestaña recortada. Cargá una imagen: la escala se escanea automáticamente.');return;}
    let stream:MediaStream|null=null;
    try {
      setStatus('Seleccioná ESTA pestaña. No se acepta escritorio ni otra pestaña.');
      const element=target.current;
      const constraints={video:{displaySurface:'browser'},audio:false,preferCurrentTab:true,selfBrowserSurface:'include',surfaceSwitching:'exclude'};
      stream=await navigator.mediaDevices.getDisplayMedia(constraints);
      if(!current()){stream.getTracks().forEach(t=>t.stop());return;}
      const cropTarget=await cropApi.fromElement(element);
      if(!current()){stream.getTracks().forEach(t=>t.stop());return;}
      const track=stream.getVideoTracks()[0] as MediaStreamTrack&{cropTo?:(target:unknown)=>Promise<void>};
      if(track.getSettings().displaySurface!=='browser'||!track.cropTo)throw new Error('Seleccioná la pestaña actual en un navegador compatible con Region Capture.');
      await track.cropTo(cropTarget); // rejects a target created by a different tab
      if(!current()){stream.getTracks().forEach(t=>t.stop());return;}
      const video=document.createElement('video');video.muted=true;video.playsInline=true;video.srcObject=stream;await video.play();
      if(!current()){stream.getTracks().forEach(t=>t.stop());video.srcObject=null;return;}
      const context=currentContext.current;
      if(!context.live){stream.getTracks().forEach(t=>t.stop());video.srcObject=null;setStatus('Volvé a una vista viva antes de compartir la pestaña.');return;}
      const s:Session={stream,video,reader:new AxisReader(),controller:new AbortController(),gate:new FrameGate(),timer:null,paused:false,referenceId:context.referenceId};session.current=s;setCapturing(true);setStatus('Captura local autorizada. Esperando primer eje válido…');
      track.addEventListener('ended',()=>{if(session.current===s){stop();setStatus('El navegador terminó la captura.');}},{once:true});
      const tick=async()=>{
        if(session.current!==s||!alive.current)return;
        try {
          if(s.paused||document.hidden){s.timer=setTimeout(tick,1000);return;}
          s.gate.invalidate();setLatest(null);setScanning(true);setStatus('Escaneando eje de un frame local…');
          const lease=s.gate.lease(s.referenceId),rect=element.getBoundingClientRect();
          const w=video.videoWidth,h=video.videoHeight;
          if(!w||!h||Math.abs(w/h-rect.width/rect.height)>.04)throw new Error('El recorte no coincide con el gráfico. Seleccioná la pestaña actual y reintentá.');
          const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;canvas.getContext('2d')!.drawImage(video,0,0);
          const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('No se pudo obtener el frame.')),'image/png'));
          const frame=await s.reader.scan(blob,'current-tab-region',s.controller.signal);
          if(session.current===s&&s.gate.accepts(lease,s.referenceId)&&!s.paused&&!document.hidden){setLatest(frame);setStatus(frame.scale.fit?`Frame validado ${new Date(frame.timestamp).toLocaleTimeString()} · ${frame.scale.reason}. Dibujar lo congela.`:frame.scale.reason);}
        }catch(e){if(session.current===s&&!s.paused){setLatest(null);setStatus(e instanceof Error?e.message:'Error de captura.');session.current=null;close(s);setCapturing(false);}}
        finally{if(alive.current)setScanning(false);}
        if(session.current===s)s.timer=setTimeout(tick,4000);
      };
      void tick();
    }catch(e){stream?.getTracks().forEach(t=>t.stop());if(current()){setStatus(e instanceof Error?e.message:'Captura cancelada.');setCapturing(false);}}
  }
  async function scanImage(blob:Blob,id:string) {
    const previous=imageJob.current;previous?.controller.abort();previous?.gate.dispose();if(previous)await previous.reader.dispose();
    const job={reader:new AxisReader(),controller:new AbortController(),gate:new FrameGate(),referenceId:id};imageJob.current=job;
    const s=session.current;if(s){s.paused=true;s.gate.invalidate();s.controller.abort();await s.reader.dispose();s.reader=new AxisReader();s.controller=new AbortController();}
    setScanning(true);setStatus('Leyendo automáticamente el eje de la imagen…');
    const lease=job.gate.lease(id);
    try {const frame=await job.reader.scan(blob,'local-image',job.controller.signal);if(imageJob.current!==job||!alive.current||!job.gate.accepts(lease,id))return null;setStatus(frame.scale.reason);return frame;}
    catch(e){if(imageJob.current===job&&alive.current)setStatus(e instanceof Error?e.message:'No se pudo leer la imagen.');return null;}
    finally{void job.reader.dispose();if(imageJob.current===job){imageJob.current=null;if(alive.current)setScanning(false);}}
  }
  function invalidate(){const s=session.current;if(s)s.gate.invalidate();imageJob.current?.gate.invalidate();setLatest(null);}
  return {latest,status,capturing,scanning,start,stop,scanImage,invalidate};
}
