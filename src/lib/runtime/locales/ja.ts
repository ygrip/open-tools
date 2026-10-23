import type { RuntimeStrings } from '../strings';

export default {
  cancel: 'キャンセル',
  camera: { help: '撮影した写真だけがこのツールに渡されます。', preview: 'カメラのプレビュー', capture: '写真を撮る', starting: 'カメラを起動中…' },
  trackerHelp: '公開URLをGoogle PageSpeed Insightsに送り、trick-it Workerでも調べます。Googleは隔離されたテストブラウザーでページのスクリプトを実行する場合があります。非公開URLや署名付きURLを送らないでください。',
  dnsHelp: 'ホスト名を公開DNS-over-HTTPSリゾルバー（セキュリティフィルター付きも含むCloudflareとGoogle）に送ります。対象サイトには接続しません。',
  wikiHelp: 'ブラウザーがこのWikiに直接接続します。サーバープロキシは使いません。',
  downloadSaving: 'ファイルを保存中', downloadFinishing: '保存を完了中', downloadDone: 'ブラウザーにファイルを送りました', downloadCancel: '保存をキャンセル', downloadNative: '端末のファイルに直接保存します。', downloadBuffered: 'このブラウザーではダウンロード前にメモリー内でファイルを作ります。', downloadLimit: '最大ファイルサイズ',
  languageFallback: 'ツールは対応する言語で表示されます。サイトの操作部分は選択した言語のままです。',
  zoomGroup: 'ツールの表示倍率', zoomIn: 'ツールを拡大', zoomOut: 'ツールを縮小', zoomReset: '表示倍率を100%に戻す', zoomLevel: '表示倍率',
  guide: 'ツールの使い方', permissions: 'このツールには追加の許可が必要です', permissionHelp: '自動で許可される項目はありません。開始には必須項目を選択してください。任意項目はオフにできます。選択はこのツール用に記憶され、「アクセスをリセット」でいつでも変更できます。',
  required: '必須', optional: '任意', start: '選択した許可で開始', revoke: 'アクセスをリセットして再起動', revokeShort: 'アクセスをリセット', sandboxed: '非公開の隔離領域', retry: '読み込みを再試行', retryAsset: 'アセットを再ダウンロード', assetReady: 'アセットの準備ができました。ツールの操作を再試行してください。',
  loading: '読み込み中', ready: 'ツールの準備完了', timeout: '読み込みがタイムアウトしました。再試行してください。', failed: 'ツールを読み込めませんでした。',
  assets: '追加のアセット', assetHelp: '公開アセットは許可した場合だけ取得し、SHA-256を検証して端末に保存する場合があります。スクリプトとワーカーは隔離されたツール内だけで動作し、サイト本体では実行しません。配信元にはIPアドレスが伝わります。', automatic: '起動前', deferred: '必要なとき', progress: '検証済みアセットをダウンロード中', cachedWarning: 'オフライン保存が使えません。検証済みファイルは使えますが、再ダウンロードが必要な場合があります。', corruptWarning: '不正なキャッシュを破棄し、再ダウンロードしています。',
  confirm: 'このツールの操作を許可しますか？', seoHelp: '公開URLをGoogle PageSpeed Insightsに送ると、Googleがそのページにアクセスします。trick-itもページ、robots.txt、llms.txtを1回読み取り、ヘッダーとメタデータを調べます。非公開URLや署名付きURLは許可しないでください。', confirmHelp: 'ブラウザーが別の許可を求める場合があります。', rememberHelp: '最初の回答をこのツール用に記憶します。「アクセスをリセット」でいつでも変更できます。', allow: '許可', deny: '許可しない', optionalOff: '選択していない任意機能は使えません。',
  verificationHelp: '続けるにはセキュリティ確認を完了してください。', verificationReady: 'セキュリティ確認が完了しました。', verificationFailed: 'セキュリティ確認ができませんでした。再試行してください。', verificationRetry: 'セキュリティ確認を再試行', serviceLimit: '期間ごとのリクエスト上限', seoMobile: 'モバイル', seoDesktop: 'デスクトップ',
  location: { locating: '位置情報を取得中です。先にブラウザーが許可を求める場合があります。', locatingShort: '位置を取得中…', blocked: 'このサイトの位置情報はブロックされています。ブラウザーのサイト設定（アドレスバーの横のアイコン）か端末の位置情報設定で許可して再試行してください。', retry: '再試行', preview: '以下で選択した位置情報だけがツールに渡されます：', precisionHelp: 'おおよその位置は約1 km単位です。時間帯、天気、地域の判定に使えます。', approximate: 'おおよその位置を共有', precise: '正確な位置を共有' },
  labels: { 'clipboard-read': 'クリップボードを読み取る', 'clipboard-write': 'クリップボードに書き込む', geolocation: '現在の位置を1回取得する', downloads: 'ファイルをダウンロードする', 'camera-capture': 'カメラで写真を1枚撮る', 'share-image': '作成したPNGを共有する', 'wiki-read': '公開Wiki記事を読む', 'dns-query': '公開DNSレコードを調べる', 'external-assets': '宣言された外部アセットを取得する', wasm: '隔離ツール内でWebAssemblyを実行する', workers: '隔離されたバックグラウンドワーカーを動かす', services: '宣言されたオンライン機能を使う' },
  errors: { request: 'リクエストに失敗しました。', 'invalid-bundle': 'ツールのバージョンがカタログと一致しません。サイトを再読み込みするか再試行してください。', integrity: 'ダウンロードした内容の整合性を確認できなかったため使用しませんでした。', size: 'ダウンロードした内容のサイズが一致しません。', 'invalid-asset': '無効なアセットです。', aborted: '操作をキャンセルしました。', denied: '許可されませんでした。', 'invalid-request': 'ツールが無効なリクエストを送りました。', busy: '別の操作が回答を待っています。', unsupported: 'このブラウザーでは使えません。', timeout: 'リクエストがタイムアウトしました。ツールの操作を再試行してください。', quota: '監査の上限に達しました。1分待って再試行してください。', unavailable: '監査サービスは一時的に使えません。後で再試行してください。', 'audit-failed': 'サイトの監査を完了できませんでした。公開ページか確認して再試行してください。', verification: 'セキュリティ確認が失敗または期限切れです。新しい確認で再試行してください。', 'stale-release': 'ツールが古いリリースです。trick-itを再読み込みして再試行してください。' }
} satisfies RuntimeStrings;
