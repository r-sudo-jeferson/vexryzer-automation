export const PERFORMANCE_BUDGETS=Object.freeze({lcpMs:2500,inpMs:200,cls:0.1,longTaskMs:50});
export interface PerformanceSample{lcpMs:number;inpMs:number;cls:number}
export interface PerformanceAssessment{ok:boolean;exceeded:readonly('lcp'|'inp'|'cls')[]}
export function classifyPerformanceSample(sample:PerformanceSample):PerformanceAssessment{const exceeded:('lcp'|'inp'|'cls')[]=[];if(sample.lcpMs>=PERFORMANCE_BUDGETS.lcpMs)exceeded.push('lcp');if(sample.inpMs>=PERFORMANCE_BUDGETS.inpMs)exceeded.push('inp');if(sample.cls>=PERFORMANCE_BUDGETS.cls)exceeded.push('cls');return{ok:exceeded.length===0,exceeded};}
