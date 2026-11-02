import { readFile, writeFile, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { extractDocument } from './documents.mjs';

export async function openRules(path = 'data/rules.json') {
  let rules = [];
  try { rules = JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  let pending = Promise.resolve();
  function change(transform) {
    const operation = pending.then(async () => {
      const next = transform(rules);
      if (next.reduce((n, r) => n + r.text.length, 0) > 50000)
        throw Error('规则正文合计不能超过50000字');
      await writeFile(path + '.tmp', JSON.stringify(next));
      await rename(path + '.tmp', path);
      rules = next;
      return next;
    });
    pending = operation.catch(() => {});
    return operation;
  }
  return {
    list: () => structuredClone(rules),
    async handle(action, data) {
      if (action === 'preview') return {text: await extractDocument(data.name, data.contentBase64)};
      if (!['save','delete'].includes(action)) throw Error('未知操作');
      return change(current => {
        const previous = current.find(r => r.id === data.id);
        if (data.id && (!previous || previous.revision !== data.revision))
          throw Error('规则已变更，请刷新后再操作');
        if (action === 'delete') {
          if (!previous) throw Error('规则不存在');
          return current.filter(r => r.id !== data.id);
        }
        const title = typeof data.title === 'string' && data.title.trim();
        const text = typeof data.text === 'string' && data.text.trim();
        if (!title || title.length > 240 || !text) throw Error('请填写规则名称和正文');
        const rule = {id: previous?.id || randomUUID(), title, text, revision:(previous?.revision || 0)+1};
        return previous ? current.map(r => r.id === rule.id ? rule : r) : [...current,rule];
      });
    }
  };
}
