import type { SharedCopy } from '../ui-copy';
export default {
  close: '閉じる', note: 'お知らせ', continueQuestion: '続けますか？', gotIt: '了解', continue: '続ける', cancel: 'キャンセル',
  file: { label: 'ここにファイルをドロップ', labelMany: 'ここにファイルをドロップ', choose: 'ファイルを選ぶ', chooseMany: 'ファイルを選ぶ', upTo: '最大', any: 'すべてのファイル', type: '対応していないファイル形式です。', size: 'ファイルサイズが次の上限を超えています：', count: 'ファイルが多すぎます。最大：', remove: '削除' },
  loader: { waiting: '読み込み待ち', loading: 'アセットを読み込み中…', verifying: 'アセットの整合性を確認中…', initializing: 'エンジンを準備中…', done: 'アセットの準備完了', error: 'アセットを読み込めませんでした', failed: '接続とアクセス許可を確認して再試行してください。入力は保持されています。' },
  table: { search: 'レコードを検索', columns: '列', rows: '行', density: '表示間隔', comfortable: 'ゆったり', compact: 'コンパクト', copy: 'コピー', page: 'ページ', of: '/', showing: '表示', noResults: '一致する行はありません。', previous: '前のページ', next: '次のページ', sortAsc: '昇順で並べ替え', sortDesc: '降順で並べ替え' },
  code: { copy: 'コードをコピー', copied: 'コピーしました', error: 'コピーできませんでした', unavailable: 'コピーの許可がありません', title: 'コード' }
} satisfies SharedCopy;
