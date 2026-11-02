import {env} from 'cloudflare:workers';
import {extractDocument} from '../../extract.mjs';
import {analyze} from '../../analyze.mjs';
export const GET=handle;export const POST=handle;
async function handle(req:Request){const db=(env as any).DB;let owner=req.headers.get('cookie')?.match(/(?:^|;\s*)quality_session=([a-f0-9-]{36})(?:;|$)/)?.[1];const fresh=!owner;owner ||=crypto.randomUUID();const send=(x:any,status=200)=>new Response(JSON.stringify(x),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...(fresh?{'Set-Cookie':`quality_session=${owner}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`}:{})}});
const put=async(id:string,kind:string,payload:any)=>db.prepare('INSERT INTO records(id,owner,kind,payload) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').bind(id,owner,kind,JSON.stringify(payload)).run();
const list=async(kind:string)=>(await db.prepare('SELECT payload FROM records WHERE owner=? AND kind=? ORDER BY rowid DESC').bind(owner,kind).all()).results.map((r:any)=>JSON.parse(r.payload));
const get=async(id:string,kind:string)=>{const r=await db.prepare('SELECT payload FROM records WHERE id=? AND owner=? AND kind=?').bind(id,owner,kind).first();return r?JSON.parse(r.payload):null};
try{const path=new URL(req.url).pathname;if(req.method==='GET'){if(path==='/api/rules')return send(await list('rule'));if(path==='/api/config')return send({configured:!!(env as any).DEEPSEEK_API_KEY});if(path==='/api/documents')return send((await list('document')).map(({input,...d}:any)=>({...d,version:input.version,owner:input.owner,project:input.project,characters:input.design.length})));if(path==='/api/tasks')return send((await list('task')).map((t:any)=>{const s=t.result?.findings.map((f:any)=>f.state)||[];return {...t,progress:t.status!=='已完成'?'尚未开始':s.includes('待人工确认')?'待人工确认':s.includes('待整改')?'整改中':s.includes('待复检')?'待复检':'已闭环'}}))}
if(req.method==='POST'){if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return send({error:'不允许跨站提交'},403);const raw=await req.text();if(raw.length>14500000)return send({error:'输入过大'},413);const x=JSON.parse(raw);
if(path==='/api/rules/preview') return send({text:await extractDocument(x.name,x.contentBase64)});
if(path==='/api/rules/save'||path==='/api/rules/delete'){
  const previous=x.id?await get(x.id,'rule'):null;
  if(x.id&&(!previous||previous.revision!==x.revision))return send({error:'规则已变更，请刷新'},409);
  if(path.endsWith('/delete')){
    if(!previous)return send({error:'规则不存在'},404);
    const result=await db.prepare("DELETE FROM records WHERE owner=? AND kind='rule' AND id=? AND json_extract(payload,'$.revision')=?").bind(owner,x.id,x.revision).run();
    if(!result.meta.changes)return send({error:'规则已变更，请刷新'},409);
  }else{
    const title=typeof x.title==='string'?x.title.trim():'';
    const text=typeof x.text==='string'?x.text.trim():'';
    if(!title||title.length>240||!text)return send({error:'请填写规则名称和正文'},400);
    const rule={id:previous?.id||crypto.randomUUID(),title,text,revision:(previous?.revision||0)+1};
    const result=await db.prepare(`INSERT INTO records(id,owner,kind,payload)
      SELECT ?,?,'rule',? WHERE (SELECT COALESCE(SUM(length(json_extract(payload,'$.text'))),0) FROM records WHERE owner=? AND kind='rule' AND id<>?)+?<=50000
      AND (?=0 OR EXISTS(SELECT 1 FROM records WHERE id=? AND owner=? AND kind='rule' AND json_extract(payload,'$.revision')=?))
      ON CONFLICT(id) DO UPDATE SET payload=excluded.payload WHERE records.owner=excluded.owner AND records.kind='rule'`).bind(rule.id,owner,JSON.stringify(rule),owner,rule.id,text.length,rule.revision-1,rule.id,owner,rule.revision-1).run();
    if(!result.meta.changes)return send({error:'规则已变更或正文合计超过50000字'},409);
  }
  return send(await list('rule'));
}
if(path==='/api/documents'){if(typeof x.name!=='string'||!x.name.trim()||x.name.length>240)throw Error('文档名称无效');const design=x.contentBase64!==undefined?await extractDocument(x.name,x.contentBase64):x.text;if(typeof design!=='string'||!design.trim()||design.length>50000)throw Error('正文不能为空或超过50000字');const input:any={document:x.name,design,project:'未关联项目',version:'V1.0',owner:'待分配',requirements:'',standards:'',components:''};for(const k of ['project','version','owner','requirements','standards','components'])if(x[k]!==undefined){if(typeof x[k]!=='string'||x[k].length>50000)throw Error('无效字段');input[k]=x[k]}const d={id:crypto.randomUUID(),name:x.name,createdAt:new Date().toISOString(),input};await put(d.id,'document',d);return send({id:d.id,name:d.name,characters:design.length},201)}
if(path==='/api/tasks'){const d=await get(x.documentId,'document');if(!d)return send({error:'文档不存在'},404);const t:any={id:crypto.randomUUID(),documentId:d.id,input:d.input,rules:await list('rule'),status:'分析中',createdAt:new Date().toISOString()};await put(t.id,'task',t);await analyze(t,(env as any).DEEPSEEK_API_KEY);await put(t.id,'task',t);return send(t,201)}
const m=path.match(/^\/api\/tasks\/([^/]+)\/findings\/([^/]+)$/);if(m){const t=await get(m[1],'task'),f=t?.result?.findings.find((f:any)=>f.id===m[2]);if(!f)return send({error:'问题不存在'},404);const allowed:any={'待人工确认':['待整改','不采纳'],'待整改':['待复检'],'待复检':['已闭环','待整改']};if(!allowed[f.state]?.includes(x.state))return send({error:'无效状态变更'},409);if(typeof x.note!=='string'||!x.note.trim()||x.note.length>2000)throw Error('请填写处理说明');f.history.push({from:f.state,to:x.state,note:x.note,at:new Date().toISOString()});f.state=x.state;await put(t.id,'task',t);return send(f)}}return send({error:'未找到'},404)}catch(e:any){return send({error:e.message||'处理失败'},400)}}
