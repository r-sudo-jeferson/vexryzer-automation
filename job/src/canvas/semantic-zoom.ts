export const ZOOM_THRESHOLDS = Object.freeze({ medium: 0.70, near: 1.05, hysteresis: 0.03 });
export type ZoomBand = 'far' | 'medium' | 'near';
export function resolveZoomBand(zoom: number, previous?: ZoomBand): ZoomBand { if(!Number.isFinite(zoom)||zoom<=0) throw new RangeError('zoom must be a finite positive number'); const {medium,near,hysteresis}=ZOOM_THRESHOLDS; if(previous==='far'&&zoom<medium+hysteresis)return'far'; if(previous==='medium'){if(zoom<medium-hysteresis)return'far';if(zoom<near+hysteresis)return'medium';return'near';} if(previous==='near'&&zoom>near-hysteresis)return'near'; if(zoom<medium)return'far';if(zoom<near)return'medium';return'near'; }
export function zoomDetailLevel(band: ZoomBand): 0|1|2 { return band==='far'?0:band==='medium'?1:2; }
