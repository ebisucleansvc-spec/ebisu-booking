/**
 * えびすクリーンサービス 予約フォーム受付（Google Apps Script）
 * 予約を保存するスプレッドシートの「拡張機能 → Apps Script」に貼り付けて使います。
 * 手順は README.md を参照してください。
 */

// ===== 設定 =====
var SHOP_NAME   = 'えびすクリーンサービス';
var SHOP_PHONE  = '';   // 例：'090-0000-0000'（受付メールに記載）
var NOTIFY_TO   = '';   // 予約通知の送り先。空ならこのスクリプトの所有者のGmailに送ります
var SHEET_NAME  = '予約一覧';
var SPREADSHEET_ID = '';  // 保存先スプレッドシートのID（URLの /d/ と /edit の間）。空ならスクリプトを開いたスプレッドシート

// 料金（フロントの config.js と同じ金額にしてください）
var PRICES = {
  units:   { wall: ['エアコン（壁掛け）', 8900], autoClean: ['お掃除機能付き 追加', 6000] },
  options: { set3: ['おすすめ3点セット', 7000], coat: ['防カビ・抗菌コート', 3000],
             outdoor: ['室外機クリーニング', 4000], drain: ['ドレンホース洗浄', 2500] }
};

var HEADERS = ['受付番号', '受付日時', 'ステータス', 'お名前', '電話番号', 'メール', '郵便番号', 'エリア', 'ご住所',
  'お住まい', '壁掛け台数', 'うちお掃除機能付き', '3点セット', '防カビ抗菌', '室外機', 'ドレンホース', '概算金額',
  '第1希望', '第2希望', '第3希望', 'お支払い', '駐車場', 'その他のお掃除', 'ご要望・備考', '紹介コード', 'ブラウザ'];

/** 最初に1回だけ実行：シートと見出しを作ります */
function setup() {
  var sh = getSheet_();
  Logger.log('シート「' + SHEET_NAME + '」を準備しました: ' + sh.getParent().getUrl());
}

function ss_() {
  return SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet_() {
  var ss = ss_();
  var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#0e7c86').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    sh.getRange('C2:C').setDataValidation(SpreadsheetApp.newDataValidation()
      .requireValueInList(['未対応', '日程調整中', '確定', '完了', 'キャンセル'], true).build());
  }
  return sh;
}

function doGet() {
  return json_({ ok: true, message: SHOP_NAME + ' 予約受付API は動作中です' });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var d = JSON.parse(e.postData.contents);
    if (d.website) return json_({ ok: true, id: 'OK' });          // ボット対策（隠し項目に入力あり）
    var err = validate_(d);
    if (err) return json_({ ok: false, error: err });

    var est = estimate_(d);
    lock.waitLock(20000);
    var sh = getSheet_();
    var now = new Date();
    var id = 'R' + Utilities.formatDate(now, 'Asia/Tokyo', 'yyMMdd') + '-' + ('000' + sh.getLastRow()).slice(-3);
    var wish = function (w) { return w.date.replace(/-/g, '/') + ' ' + w.time; };
    var u = d.units || {}, o = d.options || {};
    sh.appendRow([id, now, '未対応', d.name, "'" + d.tel, d.email, d.zip ? "'" + d.zip : '', d.area, d.address,
      d.houseType, n_(u.wall), n_(u.autoClean), n_(o.set3), n_(o.coat), n_(o.outdoor), n_(o.drain), est.total,
      wish(d.wishes[0]), wish(d.wishes[1]), wish(d.wishes[2]), d.payment, d.parking,
      (d.otherCleaning || []).join('、'), d.message || '', d.referral || '', String(d.userAgent || '').slice(0, 200)]);
    sh.getRange(sh.getLastRow(), 2).setNumberFormat('yyyy/mm/dd hh:mm');
    sh.getRange(sh.getLastRow(), 17).setNumberFormat('¥#,##0');
    lock.releaseLock();

    var body = summary_(id, d, est, wish);
    MailApp.sendEmail({
      to: d.email, name: SHOP_NAME,
      subject: '【' + SHOP_NAME + '】ご予約を受け付けました（受付番号 ' + id + '）',
      body: d.name + ' 様\n\nこの度は' + SHOP_NAME + 'にご予約いただき、ありがとうございます。\n' +
        '以下の内容で受け付けました。作業日は担当者よりご連絡のうえ確定いたします。\n' +
        'ご希望日での対応が難しい場合は、1〜2日以内に日程調整のご連絡をいたします。\n\n' + body +
        '\n\n※このメールは送信専用です。ご不明点は' + (SHOP_PHONE ? 'お電話（' + SHOP_PHONE + '）または' : '') +
        'このメールへの返信でお問い合わせください。\n\n' + SHOP_NAME + (SHOP_PHONE ? '\nTEL ' + SHOP_PHONE : '')
    });
    MailApp.sendEmail({
      to: NOTIFY_TO || Session.getEffectiveUser().getEmail(), replyTo: d.email,
      subject: '【新規予約】' + id + ' ' + d.name + ' 様（' + d.area + '）概算 ¥' + est.total.toLocaleString(),
      body: '新しい予約が入りました。\n\n' + body + '\n\nスプレッドシート：' + ss_().getUrl()
    });
    return json_({ ok: true, id: id });
  } catch (ex) {
    console.error(ex);
    return json_({ ok: false, error: 'server' });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

function n_(v) { v = Number(v); return isFinite(v) && v >= 0 ? Math.floor(v) : 0; }

function validate_(d) {
  if (!d.name || !d.tel || !d.email || !d.area || !d.address || !d.houseType || !d.payment || !d.parking) return 'required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return 'email';
  if (!d.wishes || d.wishes.length !== 3) return 'wishes';
  for (var i = 0; i < 3; i++) if (!d.wishes[i].date || !d.wishes[i].time) return 'wishes';
  if (n_((d.units || {}).wall) < 1) return 'units';
  return '';
}

// 金額はサーバー側で計算し直す（ブラウザから送られた金額は使わない）
function estimate_(d) {
  var lines = [], total = 0, u = d.units || {}, o = d.options || {};
  var wall = Math.min(n_(u.wall), 10);
  var cnt = { wall: wall, autoClean: Math.min(n_(u.autoClean), wall) };
  var set3 = Math.min(n_(o.set3), wall);
  cnt.set3 = set3;
  ['coat', 'outdoor', 'drain'].forEach(function (k) { cnt[k] = Math.min(n_(o[k]), wall - set3); });
  [['units', 'wall'], ['units', 'autoClean'], ['options', 'set3'], ['options', 'coat'], ['options', 'outdoor'], ['options', 'drain']]
    .forEach(function (p) {
      var item = PRICES[p[0]][p[1]], n = cnt[p[1]];
      if (n > 0) { lines.push(item[0] + ' × ' + n + '台　¥' + (item[1] * n).toLocaleString()); total += item[1] * n; }
    });
  return { lines: lines, total: total };
}

function summary_(id, d, est, wish) {
  return [
    '■受付番号：' + id,
    '■お名前：' + d.name + ' 様',
    '■電話番号：' + d.tel,
    '■メール：' + d.email,
    '■ご住所：' + (d.zip ? '〒' + d.zip + ' ' : '') + d.area + ' ' + d.address,
    '■お住まい：' + d.houseType,
    '',
    '■ご依頼内容',
    est.lines.map(function (l) { return '　' + l; }).join('\n'),
    '　概算金額：¥' + est.total.toLocaleString() + '（税込・駐車場代別）',
    '',
    '■ご希望日時',
    '　第1希望：' + wish(d.wishes[0]),
    '　第2希望：' + wish(d.wishes[1]),
    '　第3希望：' + wish(d.wishes[2]),
    '',
    '■お支払い方法：' + d.payment,
    '■駐車場：' + d.parking,
    '■その他のお掃除のご相談：' + ((d.otherCleaning || []).join('、') || 'なし'),
    '■ご要望・備考：' + (d.message || 'なし'),
    '■紹介コード：' + (d.referral || 'なし')
  ].join('\n');
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
