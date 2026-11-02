import mammoth from 'mammoth';
import WordExtractor from 'word-extractor';
import {convert} from 'html-to-text';


export async function extractDocument(name,base64){
 if(typeof name!=='string'||name.length>240||typeof base64!=='string'||!base64.length||base64.length>14000000||!/^[A-Za-z0-9+/]*={0,2}$/.test(base64))throw Error('文档格式或大小无效（最大10MB）');
 const buffer=Buffer.from(base64,'base64');if(buffer.length>10*1024*1024)throw Error('文档不能超过10MB');
 const ext=name.split('.').pop().toLowerCase();let text;
 try{if(ext==='docx')text=(await mammoth.extractRawText({buffer})).value;else if(ext==='doc')text=(await new WordExtractor().extract(buffer)).getBody();else if(['html','htm','md','markdown','txt'].includes(ext)){text=new TextDecoder('utf-8',{fatal:true}).decode(buffer);if(['html','htm'].includes(ext))text=convert(text,{wordwrap:false,selectors:[{selector:'script',format:'skip'},{selector:'style',format:'skip'},{selector:'img',format:'skip'},{selector:'a',options:{ignoreHref:true}}]})}else throw Error('unsupported')}catch{throw Error('无法解析文档，请确认是有效的 DOCX、DOC、HTML、Markdown 或 UTF-8 TXT 文件')}
 text=text.trim();if(!text)throw Error('文档没有可分析的正文，暂不支持仅含图片的文档');if(text.length>50000)throw Error('文档正文超过50000字，请拆分后上传');return text;
}
