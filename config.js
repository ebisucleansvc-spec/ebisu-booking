// ===== 設定ファイル：お店の情報・料金はここを書き換えてください =====
// ※料金を変えたら、GAS側（gas/Code.gs の PRICES）も同じ金額にしてください。
window.BOOKING_CONFIG = {
  // GASのウェブアプリURL（https://script.google.com/macros/s/xxxx/exec）
  // 空のままだと「デモモード」になり、送信しても保存・メール送信はされません。
  gasUrl: "https://script.google.com/macros/s/AKfycbxSnP3b6UpLTIx4V0tdnPvtYoqW3Wvo1EFQAdKyTmoykZpzz5Dc0zduQf8Sv9BCZbLmuw/exec",

  shopName: "えびすクリーンサービス",
  phone: "",            // 例："090-0000-0000"（空ならフッターに表示しません）
  businessHours: "",    // 例："受付 9:00〜18:00"

  // 台数（基本料金）
  units: [
    { id: "wall",      label: "エアコン台数（壁掛け）", price: 8900, min: 1, max: 10, note: "円/台" },
    { id: "autoClean", label: "うち、お掃除機能付き",   price: 6000, min: 0, max: 10, note: "円/台 追加", maxOf: "wall" }
  ],

  // オプション（1台ごと。台数を超えて選べません）
  options: [
    { id: "set3",    label: "おすすめ3点セット", price: 7000, desc: "防カビ抗菌コート＋室外機＋ドレンホース（別々なら9,500円）", badge: "お得" },
    { id: "coat",    label: "防カビ・抗菌コート", price: 3000 },
    { id: "outdoor", label: "室外機クリーニング", price: 4000 },
    { id: "drain",   label: "ドレンホース洗浄",   price: 2500 }
  ],

  areas: ["東京都", "神奈川県", "埼玉県", "千葉県", "その他（備考にご記入ください）"],
  houseTypes: ["戸建て", "マンション・アパート", "その他（店舗・事務所など）"],
  timeSlots: ["9時〜12時", "12時〜15時", "15時〜18時", "上記以外で相談したい"],
  payments: ["作業当日に現金", "作業当日にPayPay", "銀行振込", "クレジットカード（請求書払い）"],
  parking: ["敷地内に駐車可", "近隣コインパーキングを利用", "相談したい"],
  otherCleaning: ["お風呂・浴室", "キッチン・水回り", "洗濯機", "その他（備考にご記入ください）"],

  // 希望日として選べる範囲（今日から何日後〜何日後）
  minDaysAhead: 2,
  maxDaysAhead: 90
};
