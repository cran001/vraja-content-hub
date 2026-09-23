import { ApiError } from './api';

export function contentText(value: unknown, label: string, max=5000, required=false): string|null {
  if(value==null||value==='') { if(required)throw new ApiError(400,`${label} is required.`);return null; }
  if(typeof value!=='string'||value.length>max||required&&!value.trim())throw new ApiError(400,`Invalid ${label}.`);
  return value.trim();
}
export function contentInteger(value: unknown, label: string, fallback=0) {
  if(value==null||value==='')return fallback;
  const num=typeof value==='number'?value:typeof value==='string'&&/^-?\d+$/.test(value)?Number(value):NaN;
  if(!Number.isInteger(num)||Math.abs(num)>100000)throw new ApiError(400,`Invalid ${label}.`);
  return num;
}
export function contentPatch(body:Record<string,unknown>, nullableTexts:string[], requiredTexts:string[]=[], booleanFields:string[]=[], integerFields:string[]=[]) {
  const result:Record<string,unknown>={};
  for(const [field,value] of Object.entries(body)) {
    if(field==='id')continue;
    if(nullableTexts.includes(field)||requiredTexts.includes(field))result[field]=contentText(value,field,field.includes('title')?255:10000,requiredTexts.includes(field));
    else if(booleanFields.includes(field)) {if(typeof value!=='boolean')throw new ApiError(400,`${field} must be boolean.`);result[field]=value;}
    else if(integerFields.includes(field)){if(value===null)throw new ApiError(400,`${field} cannot be null.`);result[field]=contentInteger(value,field);}
    else throw new ApiError(400,`Unknown field: ${field}.`);
  }
  return result;
}
