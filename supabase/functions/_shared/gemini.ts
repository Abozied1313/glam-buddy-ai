export const GEMINI_DEFAULT_MODEL = 'gemini-3.8-flash';
export function geminiModel(name: string) {
 const model = Deno.env.get(name) || GEMINI_DEFAULT_MODEL;
 if (!/^gemini-[a-z0-9.-]+$/.test(model)) throw new Error('Invalid server model configuration');
 return model;
}
export async function* geminiTextEvents(body: ReadableStream<Uint8Array>) {
 const reader=body.getReader(), decoder=new TextDecoder(); let buffer='';
 try {
  for (;;) {
   const {done,value}=await reader.read();
   buffer += done ? decoder.decode() : decoder.decode(value,{stream:true});
   let index;
   while ((index=buffer.indexOf('\n'))>=0) {
    const line=buffer.slice(0,index).trim(); buffer=buffer.slice(index+1);
    if (!line.startsWith('data:')) continue;
    const payload=JSON.parse(line.slice(5));
    if(payload.error) throw new Error('Provider stream failed');
    const candidate=payload.candidates?.[0];
    if(candidate?.finishReason && !['STOP','MAX_TOKENS'].includes(candidate.finishReason)) throw new Error('Incomplete provider response');
    for(const part of candidate?.content?.parts || []) if(part.text && !part.thought) yield part.text as string;
   }
   if(done) break;
  }
 } finally { reader.releaseLock(); }
}
