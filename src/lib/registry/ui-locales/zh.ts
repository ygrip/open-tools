import type { SharedCopy } from '../ui-copy';
export default {
  close: '关闭', note: '提示', continueQuestion: '继续吗？', gotIt: '知道了', continue: '继续', cancel: '取消',
  file: { label: '将文件拖到此处', labelMany: '将多个文件拖到此处', choose: '选择文件', chooseMany: '选择多个文件', upTo: '最大', any: '任意文件', type: '不支持此文件类型。', size: '此文件大于', count: '文件过多。最多：', remove: '移除' },
  loader: { waiting: '准备加载', loading: '正在加载资源…', verifying: '正在检查资源完整性…', initializing: '正在准备引擎…', done: '资源已就绪', error: '无法加载资源', failed: '请检查连接与访问权限后重试，输入内容已保留。' },
  table: { search: '搜索记录', columns: '列', rows: '行', density: '显示密度', comfortable: '舒适', compact: '紧凑', copy: '复制', page: '页', of: '/', showing: '显示', noResults: '没有匹配的行。', previous: '上一页', next: '下一页', sortAsc: '升序排列', sortDesc: '降序排列' },
  code: { copy: '复制代码', copied: '已复制', error: '无法复制', unavailable: '未获得复制权限', title: '代码' }
} satisfies SharedCopy;
