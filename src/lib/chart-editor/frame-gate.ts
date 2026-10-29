/** Revision lease: navigation/geometry/reference change rejects any work already in flight. */
export class FrameGate {
  private revision=0;
  private disposed=false;
  invalidate(){this.revision++;}
  lease(referenceId:string){return {revision:this.revision,referenceId};}
  accepts(lease:{revision:number;referenceId:string},referenceId:string){return !this.disposed&&lease.revision===this.revision&&lease.referenceId===referenceId;}
  dispose(){this.disposed=true;this.invalidate();}
}
export type ReleasableCapture={closed?:boolean;gate:FrameGate;controller:AbortController;timer:ReturnType<typeof setTimeout>|null;stream:{getTracks:()=>{stop:()=>void}[]};video:{pause:()=>void;srcObject:unknown};reader:{dispose:()=>Promise<void>}};
/** Shared by stop, browser-ended and unmount; idempotent even when several paths race. */
export function releaseCapture(s:ReleasableCapture){
  if(s.closed)return;s.closed=true;s.gate.dispose();s.controller.abort();if(s.timer)clearTimeout(s.timer);
  s.stream.getTracks().forEach(t=>t.stop());s.video.pause();s.video.srcObject=null;void s.reader.dispose();
}
