import { parseLabelPrice, type PriceLabel } from './price-labels';
export type ScaleFit = {
  scale:'linear'|'log'; slope:number; intercept:number; residualPx:number; uncertaintyPx:number;
  validY:[number,number]; axisX:[number,number]; width:number;height:number;
  labels:PriceLabel[]; rejectedLabels:PriceLabel[]; inlierIds:string[];
};
export type ScaleResult={fit:ScaleFit|null;reason:string};
function regress(points:{y:number;t:number}[]) {
  const n=points.length,my=points.reduce((s,p)=>s+p.y,0)/n,mt=points.reduce((s,p)=>s+p.t,0)/n;
  const denom=points.reduce((s,p)=>s+(p.y-my)**2,0);
  const slope=points.reduce((s,p)=>s+(p.y-my)*(p.t-mt),0)/denom;
  return {slope,intercept:mt-slope*my};
}
export function fitPriceScale(labels:PriceLabel[],width:number,height:number):ScaleResult {
  const fail=(reason:string):ScaleResult=>({fit:null,reason});
  if(![width,height].every(n=>Number.isFinite(n)&&n>100))return fail('Imagen demasiado pequeña.');
  // Standard single top price pane only. Bottom/volume labels and short fields are excluded.
  const eligible=labels.filter(l=>l.confidence>=65&&l.price!==null&&parseLabelPrice(l.raw).price===l.price&&l.bbox.x0>width*.65&&l.bbox.x1<=width&&l.bbox.y0>Math.max(38,height*.06)&&l.bbox.y1<height*.82);
  const groups:PriceLabel[][]=[];
  for(const label of eligible){const group=groups.find(g=>Math.abs(g[0].bbox.x1-label.bbox.x1)<Math.max(8,width*.018));if(group)group.push(label);else groups.push([label]);}
  const fits:ScaleFit[]=[];
  for(const group of groups) {
    const unique=group.filter((l,i)=>!group.slice(0,i).some(o=>Math.abs((o.bbox.y0+o.bbox.y1-l.bbox.y0-l.bbox.y1)/2)<6));
    if(unique.length<3)continue;
    for(const scale of ['linear','log'] as const) {
      const points=unique.map(l=>({label:l,y:(l.bbox.y0+l.bbox.y1)/2,t:scale==='log'?Math.log(l.price!):l.price!}));
      let best:typeof points=[];
      for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++) {
        if(Math.abs(points[i].y-points[j].y)<30)continue;
        const slope=(points[j].t-points[i].t)/(points[j].y-points[i].y);if(!Number.isFinite(slope)||slope>=0)continue;
        const intercept=points[i].t-slope*points[i].y;
        const inliers=points.filter(p=>Math.abs((p.t-intercept)/slope-p.y)<=2);
        if(inliers.length>best.length)best=inliers;
      }
      if(best.length<3||best.length/points.length<.65)continue;
      const fit=regress(best);if(!Number.isFinite(fit.slope)||fit.slope>=0)continue;
      const residualPx=Math.max(...best.map(p=>Math.abs((p.t-fit.intercept)/fit.slope-p.y)));
      const ys=best.map(p=>p.y),validY:[number,number]=[Math.min(...ys),Math.max(...ys)];
      if(residualPx>2||validY[1]-validY[0]<Math.max(80,height*.22)||validY[0]>height*.4)continue;
      fits.push({...fit,scale,residualPx:Math.max(.5,residualPx),uncertaintyPx:Math.max(2,residualPx+Math.max(...best.map(p=>(p.label.bbox.y1-p.label.bbox.y0)/2))),validY,axisX:[Math.min(...best.map(p=>p.label.bbox.x0)),Math.max(...best.map(p=>p.label.bbox.x1))],width,height,labels,inlierIds:best.map(p=>p.label.id),rejectedLabels:labels.filter(l=>!best.some(p=>p.label.id===l.id))});
    }
  }
  fits.sort((a,b)=>b.inlierIds.length-a.inlierIds.length||a.residualPx-b.residualPx);
  if(!fits.length)return fail('No hay 3 etiquetas coherentes del mismo eje/panel con suficiente separación.');
  const best=fits[0];
  const rival=fits.find(f=>f!==best&&(f.scale!==best.scale||Math.abs(f.axisX[1]-best.axisX[1])>10)&&f.inlierIds.length>=best.inlierIds.length);
  if(rival&&Math.abs(rival.residualPx-best.residualPx)<.75)return fail('Escala o columna ambigua: no asigno precios.');
  return {fit:best,reason:`${best.inlierIds.length} etiquetas · ${best.scale} · error de ajuste ≤ ${best.residualPx.toFixed(1)} px`};
}
export function priceFromScale(y:number,fit:ScaleFit|null) {
  if(!fit||!Number.isFinite(y)||y<fit.validY[0]||y>fit.validY[1])return null;
  const at=(py:number)=>fit.scale==='log'?Math.exp(fit.intercept+fit.slope*py):fit.intercept+fit.slope*py;
  const price=at(y);if(!Number.isFinite(price)||price<=0)return null;
  return {price,estimated:true as const,extrapolated:false as const,errorPrice:Math.max(Math.abs(at(y-fit.uncertaintyPx)-price),Math.abs(at(y+fit.uncertaintyPx)-price)),residualPx:fit.residualPx,uncertaintyPx:fit.uncertaintyPx};
}
