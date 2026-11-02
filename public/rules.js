const $ = selector => document.querySelector(selector);
let editing;
async function api(action='', data) {
  const response = await fetch('/api/rules'+(action?'/'+action:''),data?{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)
  }:{});
  const result = await response.json();
  if(!response.ok) throw Error(result.error);
  return result;
}
function edit(rule={}) {
  editing=rule;
  $('#title').value=rule.title||'';
  $('#text').value=rule.text||'';
  $('#error').textContent='';
  $('dialog').showModal();
}
async function refresh() {
  const rules=await api();
  $('#rows').replaceChildren();
  $('#status').textContent=rules.length?'共 '+rules.length+' 组规则':'暂无规则，可导入文档或手动新增。';
  for(const rule of rules) {
    const article=document.createElement('article');
    article.innerHTML='<div class="bar"><strong></strong><div><button>编辑</button> <button>删除</button></div></div><details><summary>查看正文</summary><pre></pre></details>';
    article.querySelector('strong').textContent=rule.title+' · V'+rule.revision;
    article.querySelector('pre').textContent=rule.text;
    const [update,remove]=article.querySelectorAll('button');
    update.onclick=()=>edit(rule);
    remove.onclick=async()=>{
      if(!confirm('删除“'+rule.title+'”？已发起的检测仍保留本次规则。'))return;
      try{await api('delete',rule);await refresh()}catch(e){$('#status').textContent=e.message}
    };
    $('#rows').append(article);
  }
}
$('#add').onclick=()=>edit();
$('#cancel').onclick=()=>$('dialog').close();
$('#import').onclick=()=>$('#file').click();
$('#file').onchange=async()=>{
  const file=$('#file').files[0];if(!file)return;
  try{
    if(file.size>10*1024*1024)throw Error('文件不能超过10MB');
    $('#import').disabled=true;
    const url=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('文件读取失败'));r.readAsDataURL(file)});
    const {text}=await api('preview',{name:file.name,contentBase64:url.split(',')[1]});
    edit({title:file.name,text});
  }catch(e){$('#status').textContent=e.message}finally{$('#import').disabled=false;$('#file').value=''}
};
$('form').onsubmit=async event=>{
  event.preventDefault();$('#save').disabled=true;
  try{await api('save',{...editing,title:$('#title').value,text:$('#text').value});$('dialog').close();await refresh()}
  catch(e){$('#error').textContent=e.message}finally{$('#save').disabled=false}
};
refresh().catch(e=>$('#status').textContent=e.message);
