export interface MotionPolicy{reduced:boolean;decorativeMotion:boolean;cameraDurationMs:number;stateFadeMs:number}
export function createMotionPolicy(reduced:boolean):MotionPolicy{return reduced?{reduced:true,decorativeMotion:false,cameraDurationMs:0,stateFadeMs:90}:{reduced:false,decorativeMotion:true,cameraDurationMs:520,stateFadeMs:160};}
