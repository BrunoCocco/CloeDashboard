import type { Worker } from 'tesseract.js';
import { makePriceLabel, type PriceLabel } from './price-labels';
import { fitPriceScale, type ScaleResult } from './scale';
import { detectCandles, type CandleCandidate } from './candles';
export type FrameReading={id:string;timestamp:string;sha256:string;width:number;height:number;labels:PriceLabel[];scale:ScaleResult;candles:CandleCandidate[];image:string;source:'local-image'|'current-tab-region';status:'estimated-frame'};
/** Adapted from vista-graficosxrp OCR. Worker/model downloads only; image remains local. */
export class AxisReader {
  private worker:Promise<Worker>|null=null;
  private disposed=false;
  private busy=false;
  async scan(blob:Blob,source:FrameReading['source'],signal:AbortSignal):Promise<FrameReading> {
    if(this.busy||this.disposed||signal.aborted)throw new Error('Lectura cancelada o ya en curso.');
    this.busy=true;
    const timestamp=new Date().toISOString();
    let timeout:ReturnType<typeof setTimeout>|undefined;
    let abort:()=>void=()=>{};
    const cancelled=new Promise<never>((_,reject)=>{
      abort=()=>{void this.dispose();reject(new Error('Lectura cancelada.'));};
      signal.addEventListener('abort',abort,{once:true});
      timeout=setTimeout(()=>{void this.dispose();reject(new Error('OCR superó 45 s. Reintentá con una captura más nítida.'));},45000);
    });
    const work=async()=>{
      const bitmap=await createImageBitmap(blob);
      const width=bitmap.width,height=bitmap.height;
      if(width<250||height<200||width*height>12000000){bitmap.close();throw new Error('Imagen fuera del rango 250×200 a 12 megapíxeles.');}
      const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx){bitmap.close();throw new Error('Canvas no disponible.');}
      ctx.drawImage(bitmap,0,0);bitmap.close();
      const frame=ctx.getImageData(0,0,width,height);
      const left=Math.floor(width*.87),cropWidth=width-left,factor=3;
      const axis=document.createElement('canvas');axis.width=cropWidth*factor;axis.height=height*factor;
      const ax=axis.getContext('2d',{willReadFrequently:true})!;
      ax.drawImage(canvas,left,0,cropWidth,height,0,0,axis.width,axis.height);
      const pixels=ax.getImageData(0,0,axis.width,axis.height);
      // Dark-theme axis: black text on white for sparse text recognition. Light images unchanged.
      let dark=0;for(let k=0;k<pixels.data.length;k+=4)if((pixels.data[k]+pixels.data[k+1]+pixels.data[k+2])/3<128)dark++;
      if(dark>pixels.width*pixels.height*.5)for(let k=0;k<pixels.data.length;k+=4){const v=255-Math.round(.2126*pixels.data[k]+.7152*pixels.data[k+1]+.0722*pixels.data[k+2]);pixels.data[k]=pixels.data[k+1]=pixels.data[k+2]=v;}
      ax.putImageData(pixels,0,0);
      const prepared=await new Promise<Blob>((resolve,reject)=>axis.toBlob(b=>b?resolve(b):reject(new Error('No se pudo preparar el eje.')),'image/png'));
      if(!this.worker)this.worker=import('tesseract.js').then(async({createWorker})=>{
        const worker=await createWorker('eng',1,{workerPath:'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/worker.min.js',corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0',langPath:'https://tessdata.projectnaptha.com/4.0.0'});
        if(this.disposed){await worker.terminate();throw new Error('OCR cancelado.');}
        await worker.setParameters({tessedit_pageseg_mode:'11' as import('tesseract.js').PSM});return worker;
      });
      const worker=await this.worker;
      if(this.disposed||signal.aborted)throw new Error('Lectura cancelada.');
      const result=(await worker.recognize(prepared,{}, {blocks:true,text:true})).data;
      const labels:PriceLabel[]=[];
      for(const block of result.blocks??[])for(const paragraph of block.paragraphs)for(const line of paragraph.lines)for(const word of line.words){
        if(labels.length>=300)break;
        const b=word.bbox;labels.push(makePriceLabel(word.text,word.confidence,{x0:left+b.x0/factor,x1:left+b.x1/factor,y0:b.y0/factor,y1:b.y1/factor},`label-${labels.length}`));
      }
      const scale=fitPriceScale(labels,width,height);
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),v=>v.toString(16).padStart(2,'0')).join('');
      return {id:crypto.randomUUID(),timestamp,sha256:hash,width,height,labels,scale,candles:detectCandles(frame,scale.fit),image:await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('No se pudo conservar el frame.'));reader.readAsDataURL(blob);}),source,status:'estimated-frame' as const};
    };
    try{return await Promise.race([work(),cancelled]);}
    finally{this.busy=false;clearTimeout(timeout);signal.removeEventListener('abort',abort);}
  }
  async dispose(){this.disposed=true;const worker=this.worker;this.worker=null;if(worker)try{await(await worker).terminate();}catch{}}
}
