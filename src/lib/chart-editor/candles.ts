import { priceFromScale, type ScaleFit } from './scale';
export type CandleCandidate={id:string;kind:'visual-candidate';direction:'up'|'down';confidence:'candidate';candleTimestamp:null;x:number;high:number;low:number;open:number;close:number;body:[number,number];bounds:[number,number,number,number];prices:{high:ReturnType<typeof priceFromScale>;low:ReturnType<typeof priceFromScale>;open:ReturnType<typeof priceFromScale>;close:ReturnType<typeof priceFromScale>}};
/** Strict standard TradingView colors; components/geometry are hypotheses, never feed OHLC. */
export function detectCandles(frame:{width:number;height:number;data:Uint8ClampedArray},fit:ScaleFit|null):CandleCandidate[] {
  if(!fit)return [];
  const {width,height,data}=frame;
  if(data.length!==width*height*4||width!==fit.width||height!==fit.height)return [];
  const x0=Math.max(45,Math.round(width*.04)),x1=Math.floor(fit.axisX[0]-12),y0=Math.ceil(fit.validY[0]),y1=Math.floor(fit.validY[1]);
  const color=(x:number,y:number)=>{const k=(y*width+x)*4,r=data[k],g=data[k+1],b=data[k+2];if(data[k+3]<220)return 0;
    if(Math.abs(r-38)<25&&Math.abs(g-166)<25&&Math.abs(b-154)<25)return 1;
    if(Math.abs(r-239)<25&&Math.abs(g-83)<25&&Math.abs(b-80)<25)return 2;
    return 0;};
  const visited=new Uint8Array(width*height),out:CandleCandidate[]=[];
  for(let y=y0;y<=y1;y++)for(let x=x0;x<x1;x++) {
    const kind=color(x,y);if(!kind||visited[y*width+x])continue;
    const queue=[y*width+x],pixels:number[]=[];visited[y*width+x]=1;
    for(let i=0;i<queue.length;i++){const idx=queue[i],px=idx%width,py=Math.floor(idx/width);pixels.push(idx);
      for(const [nx,ny] of [[px-1,py],[px+1,py],[px,py-1],[px,py+1]])if(nx>=x0&&nx<x1&&ny>=y0&&ny<=y1&&!visited[ny*width+nx]&&color(nx,ny)===kind){visited[ny*width+nx]=1;queue.push(ny*width+nx);}
    }
    if(pixels.length<10||pixels.length>4000)continue;
    const xs=pixels.map(p=>p%width),ys=pixels.map(p=>Math.floor(p/width)),left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys),bw=right-left+1;
    if(bw<3||bw>Math.min(40,width*.045)||bottom-top<7||top<=y0||bottom>=y1)continue;
    const rows=new Map<number,number>();for(const py of ys)rows.set(py,(rows.get(py)??0)+1);
    const bodyRows=[...rows].filter(([,count])=>count>=Math.max(3,bw*.75)).map(([py])=>py).sort((a,b)=>a-b);
    if(bodyRows.length<3)continue;const bt=bodyRows[0],bb=bodyRows.at(-1)!;
    if(bb-bt+1!==bodyRows.length||bb-bt<3||top===bt&&bottom===bb)continue; // reject doji/no visible wick
    const cx=(left+right)/2;
    let clean=true;for(let py=top;py<=bottom;py++){const rowXs=pixels.filter(p=>Math.floor(p/width)===py).map(p=>p%width);if(py<bt||py>bb){if(rowXs.length>Math.max(2,Math.ceil(bw*.4))||rowXs.some(v=>Math.abs(v-cx)>1.5))clean=false;}}
    if(!clean)continue;
    const open=kind===1?bb:bt,close=kind===1?bt:bb;
    out.push({id:`candle-${out.length}`,kind:'visual-candidate',direction:kind===1?'up':'down',confidence:'candidate',candleTimestamp:null,x:cx,high:top,low:bottom,open,close,body:[bt,bb],bounds:[left,top,right,bottom],prices:{high:priceFromScale(top,fit),low:priceFromScale(bottom,fit),open:priceFromScale(open,fit),close:priceFromScale(close,fit)}});
    if(out.length>=300)return out;
  }
  return out.sort((a,b)=>a.x-b.x);
}
