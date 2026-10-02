(function () {
  "use strict";
  var C = window.BOOKING_CONFIG;
  var $ = function (id) { return document.getElementById(id); };
  var yen = function (n) { return "¥" + n.toLocaleString("ja-JP"); };
  var counts = {};

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ---------- 台数・オプション ----------
  function stepperRow(item, isOption) {
    var price = isOption ? item.price.toLocaleString("ja-JP") + "円/台" : item.price.toLocaleString("ja-JP") + item.note;
    var plus = item.id === "autoClean" ? "＋" : "";
    return '<div class="row">' +
      '<div class="row-text"><span class="row-label">' + esc(item.label) +
      (item.badge ? ' <span class="badge">' + esc(item.badge) + "</span>" : "") + "</span>" +
      '<span class="row-price">' + plus + price + "</span>" +
      (item.desc ? '<span class="row-desc">' + esc(item.desc) + "</span>" : "") + "</div>" +
      '<div class="stepper" data-id="' + item.id + '">' +
      '<button type="button" class="minus" aria-label="' + esc(item.label) + 'を減らす">−</button>' +
      '<output aria-live="polite" id="cnt-' + item.id + '">0</output>' +
      '<button type="button" class="plus" aria-label="' + esc(item.label) + 'を増やす">＋</button>' +
      "</div></div>";
  }

  function maxFor(id) {
    var wall = counts.wall || 0;
    var unit = C.units.filter(function (u) { return u.id === id; })[0];
    if (unit) return unit.maxOf ? Math.min(unit.max, wall) : unit.max;
    // オプション：3点セットに含まれる個別項目は、セット分と合わせて台数まで
    if (id === "set3") return wall - Math.max(counts.coat || 0, counts.outdoor || 0, counts.drain || 0);
    return wall - (counts.set3 || 0);
  }

  function clampAll() {
    C.units.concat(C.options).forEach(function (it) {
      var mn = it.min || 0;
      counts[it.id] = Math.max(mn, Math.min(counts[it.id], Math.max(mn, maxFor(it.id))));
    });
  }

  function calc() {
    var lines = [], total = 0;
    C.units.concat(C.options).forEach(function (it) {
      var n = counts[it.id];
      if (n > 0) { lines.push([it.label + " × " + n, it.price * n]); total += it.price * n; }
    });
    return { lines: lines, total: total };
  }

  function render() {
    clampAll();
    C.units.concat(C.options).forEach(function (it) {
      $("cnt-" + it.id).textContent = counts[it.id];
      var box = document.querySelector('.stepper[data-id="' + it.id + '"]');
      box.querySelector(".minus").disabled = counts[it.id] <= (it.min || 0);
      box.querySelector(".plus").disabled = counts[it.id] >= maxFor(it.id);
    });
    var r = calc();
    $("estimateTotal").textContent = yen(r.total);
    $("estimateDetail").innerHTML = r.lines.map(function (l) {
      return "<li><span>" + esc(l[0]) + "</span><span>" + yen(l[1]) + "</span></li>";
    }).join("");
  }

  $("unitRows").innerHTML = C.units.map(function (u) { counts[u.id] = u.min || 0; return stepperRow(u, false); }).join("");
  $("optionRows").innerHTML = C.options.map(function (o) { counts[o.id] = 0; return stepperRow(o, true); }).join("");
  document.addEventListener("click", function (e) {
    var b = e.target.closest(".stepper button");
    if (!b) return;
    var id = b.parentNode.dataset.id;
    counts[id] += b.classList.contains("plus") ? 1 : -1;
    render();
  });
  $("toggleDetail").addEventListener("click", function () {
    var d = $("estimateDetail"), open = d.hidden;
    d.hidden = !open; this.setAttribute("aria-expanded", open); this.textContent = open ? "内訳を閉じる" : "内訳を見る";
  });

  // ---------- 選択肢 ----------
  C.areas.forEach(function (a) { var o = document.createElement("option"); o.textContent = a; o.value = a; $("area").appendChild(o); });
  var chipSets = { houseType: C.houseTypes, payment: C.payments, parking: C.parking, otherCleaning: C.otherCleaning };
  Object.keys(chipSets).forEach(function (name) {
    var box = document.querySelector('.chips[data-name="' + name + '"]');
    var multi = box.classList.contains("multi");
    box.innerHTML = chipSets[name].map(function (v) {
      return '<label class="chip"><input type="' + (multi ? "checkbox" : "radio") + '" name="' + name + '" value="' + esc(v) + '">' +
        "<span>" + esc(v) + "</span></label>";
    }).join("");
  });

  var d0 = new Date(); d0.setHours(0, 0, 0, 0);
  function iso(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  var minD = new Date(d0); minD.setDate(minD.getDate() + C.minDaysAhead);
  var maxD = new Date(d0); maxD.setDate(maxD.getDate() + C.maxDaysAhead);
  var labels = ["第1希望", "第2希望", "第3希望"];
  $("dateRows").innerHTML = labels.map(function (l, i) {
    return '<div class="date-row"><span class="date-label">' + l + "</span>" +
      '<input type="date" id="date' + (i + 1) + '" required min="' + iso(minD) + '" max="' + iso(maxD) + '" aria-label="' + l + 'の日付">' +
      '<select id="time' + (i + 1) + '" required aria-label="' + l + 'の時間帯"><option value="">時間帯</option>' +
      C.timeSlots.map(function (t) { return "<option>" + esc(t) + "</option>"; }).join("") + "</select></div>";
  }).join("");

  // 郵便番号から住所を補完（zipcloud）
  $("zip").addEventListener("blur", function () {
    var z = this.value.replace(/[^0-9０-９]/g, "").replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); });
    if (z.length !== 7 || $("address").value) return;
    fetch("https://zipcloud.ibsnet.co.jp/api/search?zipcode=" + z).then(function (r) { return r.json(); }).then(function (j) {
      if (!j.results) return;
      var a = j.results[0];
      if (!$("address").value) $("address").value = a.address2 + a.address3;
      var pref = a.address1;
      var match = C.areas.filter(function (x) { return x === pref; })[0];
      if (match && !$("area").value) $("area").value = match;
    }).catch(function () {});
  });

  if (C.phone) $("footerContact").innerHTML = '☎ <a href="tel:' + esc(C.phone.replace(/[^0-9]/g, "")) + '">' + esc(C.phone) + "</a>" + (C.businessHours ? "　" + esc(C.businessHours) : "");

  // ---------- 送信 ----------
  function radio(name) { var c = document.querySelector('input[name="' + name + '"]:checked'); return c ? c.value : ""; }
  function checks(name) { return Array.prototype.map.call(document.querySelectorAll('input[name="' + name + '"]:checked'), function (c) { return c.value; }); }

  function validate() {
    var errs = [], first = null;
    function bad(el, msg) { errs.push(msg); if (el) { el.classList.add("invalid"); el.setAttribute("aria-invalid", "true"); first = first || el; } }
    document.querySelectorAll(".invalid").forEach(function (el) { el.classList.remove("invalid"); el.removeAttribute("aria-invalid"); });
    if (!$("name").value.trim()) bad($("name"), "お名前を入力してください。");
    if ($("tel").value.replace(/[^0-9０-９]/g, "").length < 10) bad($("tel"), "電話番号を正しく入力してください。");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test($("email").value.trim())) bad($("email"), "メールアドレスを正しく入力してください。");
    if (!$("area").value) bad($("area"), "エリアを選択してください。");
    if (!$("address").value.trim()) bad($("address"), "ご住所を入力してください。");
    if (!radio("houseType")) bad(document.querySelector('[data-name="houseType"]'), "お住まいのタイプを選択してください。");
    var seen = {};
    for (var i = 1; i <= 3; i++) {
      var d = $("date" + i), t = $("time" + i);
      if (!d.value) bad(d, labels[i - 1] + "の日付を選択してください。");
      else if (d.value < d.min || d.value > d.max) bad(d, labels[i - 1] + "は " + d.min.replace(/-/g, "/") + "〜" + d.max.replace(/-/g, "/") + " の間で選択してください。");
      if (!t.value) bad(t, labels[i - 1] + "の時間帯を選択してください。");
      if (d.value && t.value) { var k = d.value + t.value; if (seen[k]) bad(d, labels[i - 1] + "が他の希望日時と同じです。"); seen[k] = 1; }
    }
    if (!radio("payment")) bad(document.querySelector('[data-name="payment"]'), "お支払い方法を選択してください。");
    if (!radio("parking")) bad(document.querySelector('[data-name="parking"]'), "駐車場を選択してください。");
    if (!$("agree").checked) bad($("agree").parentNode, "個人情報の取り扱いへの同意にチェックしてください。");
    return { errs: errs, first: first };
  }

  $("bookingForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var v = validate(), box = $("errors");
    if (v.errs.length) {
      box.innerHTML = "<p>入力内容をご確認ください</p><ul>" + v.errs.map(function (m) { return "<li>" + esc(m) + "</li>"; }).join("") + "</ul>";
      box.hidden = false; box.scrollIntoView({ behavior: "smooth", block: "center" });
      if (v.first && v.first.focus) setTimeout(function () { v.first.focus({ preventScroll: true }); }, 400);
      return;
    }
    box.hidden = true;
    var r = calc();
    var data = {
      units: {}, options: {},
      estimate: r.total,
      name: $("name").value.trim(), tel: $("tel").value.trim(), email: $("email").value.trim(),
      zip: $("zip").value.trim(), area: $("area").value, address: $("address").value.trim(),
      houseType: radio("houseType"),
      wishes: [1, 2, 3].map(function (i) { return { date: $("date" + i).value, time: $("time" + i).value }; }),
      payment: radio("payment"), parking: radio("parking"), otherCleaning: checks("otherCleaning"),
      message: $("message").value.trim(), referral: $("referral").value.trim(),
      website: $("website").value, userAgent: navigator.userAgent
    };
    C.units.forEach(function (u) { data.units[u.id] = counts[u.id]; });
    C.options.forEach(function (o) { data.options[o.id] = counts[o.id]; });

    var btn = $("submitBtn");
    btn.disabled = true; btn.textContent = "送信中…";

    function finish(id, msg) {
      $("bookingForm").hidden = true;
      $("doneId").textContent = id;
      if (msg) $("doneMsg").textContent = msg;
      $("done").hidden = false; $("done").focus(); window.scrollTo({ top: 0, behavior: "smooth" });
    }
    function fail() {
      btn.disabled = false; btn.textContent = "この内容で予約を申し込む";
      box.innerHTML = "<p>送信できませんでした。時間をおいて再度お試しください。</p>" + (C.phone ? "<p>お急ぎの場合はお電話（" + esc(C.phone) + "）でご連絡ください。</p>" : "");
      box.hidden = false; box.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    if (!C.gasUrl) {
      setTimeout(function () { finish("DEMO-0000", "【デモモード】GASのURLが未設定のため、保存・メール送信は行っていません。config.js の gasUrl を設定してください。"); }, 600);
      return;
    }
    // text/plain で送るとプリフライトなしでGASに届く
    fetch(C.gasUrl, { method: "POST", body: JSON.stringify(data) })
      .then(function (res) { return res.json(); })
      .then(function (j) { if (j && j.ok) finish(j.id); else fail(); })
      .catch(fail);
  });

  render();
})();
