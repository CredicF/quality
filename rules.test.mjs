import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openRules} from './rules.mjs';

test('导入规则并编辑删除，历史版本独立，持久化可恢复',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'quality-rules-'));
  try{
    const path=join(dir,'rules.json');
    const store=await openRules(path);
    const preview=await store.handle('preview',{name:'规则.md',contentBase64:Buffer.from('异常流程必须记录错误码').toString('base64')});
    const [first]=await store.handle('save',{title:'接口规范',...preview});
    const snapshot=store.list();
    const [second]=await store.handle('save',{...first,text:'记录错误码和重试次数'});
    await assert.rejects(store.handle('delete',first),/已变更/);
    assert.equal((await openRules(path)).list()[0].revision,2);
    await store.handle('delete',second);
    assert.deepEqual(store.list(),[]);
    assert.equal(snapshot[0].text,'异常流程必须记录错误码');
  } finally {await rm(dir,{recursive:true,force:true})}
});
