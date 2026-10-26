/* Calendar Maker — day-number calendar maths (no Date drift), Hijri via Intl islamic-umalqura, print via @page, PNG via canvas. */
(function () {
  "use strict";
  var $ = S3.$, $$ = S3.$$, h = S3.h;
  var KEY = "cal.v1", EKEY = "cal.events";

  // ---------- calendar maths ----------
  function isLeap(y) { return y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0); }
  function dim(y, m) { return [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]; }
  function dfc(y, m, d) {
    y -= m <= 2 ? 1 : 0;
    var era = Math.floor(y / 400), yoe = y - era * 400, doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
    return era * 146097 + yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy - 719468;
  }
  function cfd(z) {
    z += 719468;
    var era = Math.floor(z / 146097), doe = z - era * 146097;
    var yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
    var doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100)), mp = Math.floor((5 * doy + 2) / 153), m = mp + (mp < 10 ? 3 : -9);
    return { y: yoe + era * 400 + (m <= 2 ? 1 : 0), m: m, d: doy - Math.floor((153 * mp + 2) / 5) + 1 };
  }
  function wd(z) { return ((z % 7) + 11) % 7; }            // 0 = Sunday
  function iso(y, m, d) { return y + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0"); }
  // The cells of a month grid, including the neighbouring months' days that fill the first and last week.
  function monthCells(y, m, weekStart) {
    var first = dfc(y, m, 1), lead = (wd(first) - weekStart + 7) % 7, n = dim(y, m), rows = Math.ceil((lead + n) / 7), cells = [];
    for (var i = 0; i < rows * 7; i++) { var z = first - lead + i, o = cfd(z); cells.push({ z: z, y: o.y, m: o.m, d: o.d, inMonth: o.m === m }); }
    return { lead: lead, rows: rows, cells: cells };
  }
  function asDate(z) { var o = cfd(z), d = new Date(0); d.setUTCFullYear(o.y, o.m - 1, o.d); return d; }
  var HP = null, HM = {};
  function hijriParts(z) {
    try {
      HP = HP || Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", { timeZone: "UTC", day: "numeric", month: "numeric", year: "numeric" });
      var p = {};
      HP.formatToParts(asDate(z)).forEach(function (x) { if (/^(year|month|day)$/.test(x.type)) p[x.type] = parseInt(x.value, 10); });
      return p.year ? { y: p.year, m: p.month, d: p.day } : null;
    } catch (e) { return null; }
  }
  function hijriMonthName(z, ar) {
    var k = ar ? "ar" : "en";
    try {
      HM[k] = HM[k] || Intl.DateTimeFormat((ar ? "ar" : "en") + "-u-ca-islamic-umalqura", { timeZone: "UTC", month: "long" });
      return HM[k].format(asDate(z));
    } catch (e) { return ""; }
  }

  // ---------- language ----------
  var L = {
    en: { months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
      days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], mini: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"], ah: "AH" },
    ar: { months: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
      days: ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"], mini: ["ح", "ن", "ث", "ر", "خ", "ج", "س"], ah: "هـ" }
  };
  L.lev = Object.assign({}, L.ar, { months: ["كانون الثاني", "شباط", "آذار", "نيسان", "أيار", "حزيران", "تموز", "آب", "أيلول", "تشرين الأول", "تشرين الثاني", "كانون الأول"] });

  // ---------- events (from localStorage or an imported file: always cleaned) ----------
  var COLORS = { teal: "#0f9e99", blue: "#3e63dd", purple: "#8e4ec6", red: "#e5484d", orange: "#ef6c1a", yellow: "#c98a00", green: "#2f9e5d" };
  function cleanEvents(list) {
    var out = [];
    (Array.isArray(list) ? list : []).slice(0, 1000).forEach(function (e) {
      if (!e || typeof e !== "object") return;
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(e.date);
      if (!m || +m[2] < 1 || +m[2] > 12 || +m[3] < 1 || +m[3] > dim(+m[1], +m[2])) return;
      var text = typeof e.text === "string" ? e.text.trim().slice(0, 60) : "";
      if (!text) return;
      out.push({ date: e.date, text: text, color: COLORS[e.color] ? e.color : "teal", yearly: e.yearly === true });
    });
    return out.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  }
  function eventsOn(evs, y, m, d) {
    var full = iso(y, m, d), md = full.slice(5);
    return evs.filter(function (e) { return e.date === full || (e.yearly && e.date.slice(5) === md && +e.date.slice(0, 4) <= y); });
  }

  // ---------- state ----------
  var now = new Date(), TODAY = dfc(now.getFullYear(), now.getMonth() + 1, now.getDate());
  var saved = S3.store(KEY) || {};
  var st = {
    view: saved.view === "year" ? "year" : "month",
    y: saved.y >= 1900 && saved.y <= 2100 ? saved.y : now.getFullYear(),
    m: saved.m >= 1 && saved.m <= 12 ? saved.m : now.getMonth() + 1,
    weekStart: [0, 1, 6].indexOf(saved.weekStart) >= 0 ? saved.weekStart : 6,
    lang: L[saved.lang] ? saved.lang : "en",
    hijri: saved.hijri === true, indic: saved.indic === true,
    paper: saved.paper === "Letter" ? "Letter" : "A4",
    orient: saved.orient === "portrait" ? "portrait" : "landscape",
    title: typeof saved.title === "string" ? saved.title.slice(0, 60) : ""
  };
  var events = cleanEvents(S3.store(EKEY));
  var evColor = "teal";
  function save() { S3.store(KEY, st); }
  function saveEvents() { if (S3.store(EKEY, events) === undefined && events.length) S3.toast("Couldn't save events in this browser", "error"); }

  var AR_D = "٠١٢٣٤٥٦٧٨٩";
  function dg(n) { var s = String(n); return st.indic && st.lang !== "en" ? s.replace(/\d/g, function (c) { return AR_D[+c]; }) : s; }
  function isAr() { return st.lang !== "en"; }
  function hijriRange(zFrom, zTo) {
    var a = hijriParts(zFrom), b = hijriParts(zTo), ar = isAr();
    if (!a || !b) return "";
    var na = hijriMonthName(zFrom, ar), nb = hijriMonthName(zTo, ar), suf = " " + L[st.lang].ah;
    return (a.m === b.m && a.y === b.y ? na + " " + dg(a.y) : na + (a.y !== b.y ? " " + dg(a.y) : "") + " – " + nb + " " + dg(b.y)) + suf;
  }

  // ---------- page size ----------
  var PAPER = { A4: [210, 297], Letter: [215.9, 279.4] }, MARGIN = 10;
  var pageStyle = document.head.appendChild(document.createElement("style"));
  function paperBox() { var p = PAPER[st.paper], w = p[0], hh = p[1]; if (st.orient === "landscape") { var t = w; w = hh; hh = t; } return { w: w - 2 * MARGIN, h: hh - 2 * MARGIN, pw: w, ph: hh }; }
  function applyPage() {
    var b = paperBox();
    pageStyle.textContent = "@page{size:" + st.paper + " " + st.orient + ";margin:" + MARGIN + "mm}" +
      "@media print{.cm-wrap{width:" + b.w + "mm!important}.cm-paper{height:" + (b.h - 1) + "mm!important;aspect-ratio:auto!important}}";
    $("#paperEl").style.aspectRatio = b.w + " / " + b.h;
  }

  // ---------- render ----------
  var paperEl = $("#paperEl");
  function weekdayOrder() { var a = []; for (var i = 0; i < 7; i++) a.push((st.weekStart + i) % 7); return a; }
  function renderMonth() {
    var lang = L[st.lang], g = monthCells(st.y, st.m, st.weekStart), ar = isAr();
    var first = dfc(st.y, st.m, 1), last = dfc(st.y, st.m, dim(st.y, st.m));
    var head = h("header", { "class": "cm-head" }, [
      h("div", {}, [st.title ? h("span", { "class": "cm-ttl", dir: "auto", text: st.title }) : null,
        h("h2", { "class": "cm-mname" }, [lang.months[st.m - 1] + " ", h("span", { text: dg(st.y) })])]),
      st.hijri ? h("span", { "class": "cm-hr", text: hijriRange(first, last) }) : null
    ]);
    var wk = h("div", { "class": "cm-wk" }, weekdayOrder().map(function (d) { return h("span", { text: lang.days[d] }); }));
    var grid = h("div", { "class": "cm-grid" });
    grid.style.gridTemplateRows = "repeat(" + g.rows + ", minmax(0, 1fr))";
    g.cells.forEach(function (c, i) {
      var cell = h("div", { "class": "cm-cell" + (c.inMonth ? "" : " cm-out") + (c.z === TODAY ? " today" : "") });
      cell.appendChild(h("span", { "class": "cm-d", text: dg(c.d) }));
      if (st.hijri && c.inMonth) {
        var hp = hijriParts(c.z);
        if (hp) cell.appendChild(h("span", { "class": "cm-hd", text: hp.d === 1 || c.d === 1 ? dg(hp.d) + " " + hijriMonthName(c.z, ar) : dg(hp.d) }));
      }
      if (c.inMonth) {
        var evs = eventsOn(events, c.y, c.m, c.d);
        if (evs.length) {
          var box = h("div", { "class": "cm-evs" });
          evs.forEach(function (e) { var chip = h("span", { "class": "cm-ev", dir: "auto", text: e.text }); chip.style.setProperty("--c", COLORS[e.color]); box.appendChild(chip); });
          cell.appendChild(box);
        }
      }
      grid.appendChild(cell);
    });
    return h("div", { "class": "cm-month" }, [head, wk, grid]);
  }
  function renderYear() {
    var lang = L[st.lang], ar = isAr(), months = h("div", { "class": "cm-months" });
    months.style.gridTemplateColumns = "repeat(" + (st.orient === "landscape" ? 4 : 3) + ", minmax(0, 1fr))";
    for (var m = 1; m <= 12; m++) {
      var g = monthCells(st.y, m, st.weekStart), grid = h("div", { "class": "cm-mgrid" });
      weekdayOrder().forEach(function (d) { grid.appendChild(h("span", { "class": "cm-mw", text: lang.mini[d] })); });
      g.cells.forEach(function (c) {
        if (!c.inMonth) { grid.appendChild(h("span")); return; }
        var evs = eventsOn(events, c.y, c.m, c.d), s = h("span", { "class": "cm-md" + (evs.length ? " ev" : "") + (c.z === TODAY ? " today" : ""), text: dg(c.d) });
        if (evs.length) { s.style.setProperty("--c", COLORS[evs[0].color]); s.title = evs.map(function (e) { return e.text; }).join(", "); }
        grid.appendChild(s);
      });
      for (var k = g.rows; k < 6; k++) for (var j = 0; j < 7; j++) grid.appendChild(h("span"));
      months.appendChild(h("div", { "class": "cm-mini" }, [
        h("b", { text: lang.months[m - 1] }),
        st.hijri ? h("small", { text: hijriRange(dfc(st.y, m, 1), dfc(st.y, m, dim(st.y, m))) }) : null,
        grid
      ]));
    }
    var yearEvents = events.filter(function (e) { return e.yearly || +e.date.slice(0, 4) === st.y; });
    var legend = yearEvents.length ? h("div", { "class": "cm-legend" }, yearEvents.slice(0, 24).map(function (e) {
      var it = h("span", { dir: "auto" }, [h("i"), h("bdi", { text: dg(+e.date.slice(8)) + " " + lang.months[+e.date.slice(5, 7) - 1].slice(0, ar ? 20 : 3) + " · " + e.text })]);
      it.style.setProperty("--c", COLORS[e.color]); return it;
    })) : null;
    return h("div", { "class": "cm-year" }, [
      h("header", { "class": "cm-head" }, [h("div", {}, [st.title ? h("span", { "class": "cm-ttl", dir: "auto", text: st.title }) : null, h("h2", { "class": "cm-mname", text: dg(st.y) })]),
        st.hijri ? h("span", { "class": "cm-hr", text: hijriRange(dfc(st.y, 1, 1), dfc(st.y, 12, 31)) }) : null]),
      months, legend
    ]);
  }
  function render() {
    save(); applyPage();
    paperEl.textContent = "";
    paperEl.setAttribute("dir", isAr() ? "rtl" : "ltr");
    paperEl.setAttribute("lang", isAr() ? "ar" : "en");
    paperEl.className = "cm-paper " + st.orient + " " + st.view;
    paperEl.appendChild(st.view === "month" ? renderMonth() : renderYear());
    $("#monthWrap").hidden = st.view !== "month";
    $("#png").disabled = false;
    $("#digitsWrap").hidden = !isAr();
    $("#month").value = String(st.m); $("#year").value = st.y;
  }

  // ---------- events UI ----------
  Object.keys(COLORS).forEach(function (c) {
    var b = h("button", { type: "button", "class": "cm-sw", "data-c": c, "aria-label": c, title: c, "aria-pressed": String(c === evColor) });
    b.style.setProperty("--c", COLORS[c]); $("#evColors").appendChild(b);
  });
  $("#evColors").addEventListener("click", function (e) {
    var b = e.target.closest("[data-c]"); if (!b) return;
    evColor = b.dataset.c; $$(".cm-sw").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
  });
  function renderEvents() {
    var ul = $("#evList"); ul.textContent = "";
    $("#evCount").textContent = events.length ? String(events.length) : "";
    if (!events.length) ul.appendChild(h("li", { "class": "faint", text: "No events yet. Add birthdays, holidays or deadlines." }));
    events.forEach(function (e, i) {
      var li = h("li", {}, [h("i"), h("span", { "class": "cm-evd", text: e.yearly ? e.date.slice(5) + " ↻" : e.date }), h("bdi", { "class": "grow", text: e.text }),
        h("button", { type: "button", "class": "btn ghost icon small", "data-del": i, "aria-label": "Delete event " + e.text, html: S3.icon("trash") })]);
      li.style.setProperty("--c", COLORS[e.color]); ul.appendChild(li);
    });
  }
  function addEvent() {
    var date = $("#evDate").value, text = $("#evText").value.trim();
    if (!date) return S3.toast("Pick a date for the event", "error");
    if (!text) return S3.toast("Type what the event is", "error");
    var add = cleanEvents([{ date: date, text: text, color: evColor, yearly: $("#evYearly").checked }]);
    if (!add.length) return S3.toast("That date isn't valid", "error");
    events = cleanEvents(events.concat(add)); saveEvents(); renderEvents();
    var p = date.split("-"); st.y = +p[0]; st.m = +p[1]; render();
    $("#evText").value = ""; $("#evText").focus();
  }
  $("#evAdd").addEventListener("click", addEvent);
  $("#evText").addEventListener("keydown", function (e) { if (e.key === "Enter") addEvent(); });
  $("#evList").addEventListener("click", function (e) {
    var b = e.target.closest("[data-del]"); if (!b) return;
    var gone = events.splice(+b.dataset.del, 1)[0]; saveEvents(); renderEvents(); render();
    var t = S3.toast("Event deleted ");
    t.appendChild(h("button", { "class": "btn small", text: "Undo", onclick: function () { events = cleanEvents(events.concat([gone])); saveEvents(); renderEvents(); render(); t.remove(); } }));
  });
  $("#evExport").addEventListener("click", function () {
    if (!events.length) return S3.toast("No events to export", "error");
    S3.download(JSON.stringify({ app: "s3-calendar-maker", version: 1, events: events }, null, 2), "calendar-events.json", "application/json"); S3.done();
  });
  $("#evImport input").addEventListener("change", function (e) {
    var f = e.target.files[0]; e.target.value = ""; if (!f) return;
    if (f.size > 2 * 1024 * 1024) return S3.toast("That file is too large", "error");
    S3.readFile(f, "text").then(function (t) {
      var d; try { d = JSON.parse(t); } catch (err) { return S3.toast("Not valid JSON", "error"); }
      var add = cleanEvents(Array.isArray(d) ? d : d && d.events);
      if (!add.length) return S3.toast("No valid events in that file", "error");
      var seen = {}; events = cleanEvents(events.concat(add)).filter(function (x) { var k = x.date + "|" + x.text; if (seen[k]) return false; seen[k] = 1; return true; });
      saveEvents(); renderEvents(); render(); S3.toast("Imported " + add.length + " event" + (add.length === 1 ? "" : "s"));
    });
  });

  // ---------- PNG of a month (drawn on a canvas, nothing leaves the page) ----------
  function fit(ctx, text, max) {
    if (ctx.measureText(text).width <= max) return text;
    var t = Array.from(text);
    while (t.length && ctx.measureText(t.join("") + "…").width > max) t.pop();
    return t.join("") + "…";
  }
  function monthPNG() {
    var land = st.orient === "landscape", W = land ? 1754 : 1240, H = land ? 1240 : 1754, M = 64, rtl = isAr(), lang = L[st.lang];
    var cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    var ctx = cv.getContext("2d"), font = rtl ? "Tahoma, 'Noto Sans Arabic', sans-serif" : "Inter, system-ui, sans-serif";
    ctx.direction = rtl ? "rtl" : "ltr";
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
    var g = monthCells(st.y, st.m, st.weekStart), top = M, x0 = rtl ? W - M : M;
    ctx.textAlign = rtl ? "right" : "left"; ctx.textBaseline = "alphabetic";
    if (st.title) { ctx.fillStyle = "#6b7280"; ctx.font = "600 26px " + font; ctx.fillText(st.title, x0, top + 22); top += 34; }
    ctx.fillStyle = "#0b6f6b"; ctx.font = "800 64px " + font;
    ctx.fillText(lang.months[st.m - 1] + " " + dg(st.y), x0, top + 58);
    if (st.hijri) {
      ctx.fillStyle = "#6b7280"; ctx.font = "500 26px " + font; ctx.textAlign = rtl ? "left" : "right";
      ctx.fillText(hijriRange(dfc(st.y, st.m, 1), dfc(st.y, st.m, dim(st.y, st.m))), rtl ? M : W - M, top + 56);
    }
    top += 96;
    var cw = (W - 2 * M) / 7, colX = function (c) { return rtl ? W - M - (c + 1) * cw : M + c * cw; };
    ctx.font = "700 22px " + font; ctx.fillStyle = "#374151"; ctx.textAlign = "center";
    weekdayOrder().forEach(function (d, c) { ctx.fillText(lang.days[d], colX(c) + cw / 2, top + 26); });
    top += 44;
    var ch = (H - M - top) / g.rows;
    ctx.strokeStyle = "#d1d5db"; ctx.lineWidth = 2;
    g.cells.forEach(function (c, i) {
      var col = i % 7, row = Math.floor(i / 7), x = colX(col), y = top + row * ch;
      ctx.strokeRect(x, y, cw, ch);
      ctx.textAlign = rtl ? "right" : "left"; ctx.fillStyle = c.inMonth ? "#111827" : "#c4c8cf"; ctx.font = "700 30px " + font;
      var tx = rtl ? x + cw - 14 : x + 14;
      ctx.fillText(dg(c.d), tx, y + 40);
      if (!c.inMonth) return;
      if (st.hijri) {
        var hp = hijriParts(c.z);
        if (hp) { ctx.textAlign = rtl ? "left" : "right"; ctx.fillStyle = "#9ca3af"; ctx.font = "500 18px " + font; ctx.fillText(dg(hp.d), rtl ? x + 12 : x + cw - 12, y + 36); }
      }
      var ey = y + 58;
      eventsOn(events, c.y, c.m, c.d).forEach(function (e) {
        if (ey + 28 > y + ch - 4) return;
        ctx.fillStyle = COLORS[e.color]; ctx.globalAlpha = .14; ctx.fillRect(x + 8, ey, cw - 16, 28); ctx.globalAlpha = 1;
        ctx.fillRect(rtl ? x + cw - 12 : x + 8, ey, 4, 28);
        ctx.fillStyle = "#111827"; ctx.font = "600 17px " + font; ctx.textAlign = rtl ? "right" : "left";
        ctx.fillText(fit(ctx, e.text, cw - 34), rtl ? x + cw - 20 : x + 20, ey + 20);
        ey += 32;
      });
    });
    return cv;
  }
  $("#png").addEventListener("click", function () {
    var go = function () {
      monthPNG().toBlob(function (b) { if (b) { S3.download(b, "calendar-" + iso(st.y, st.m, 1).slice(0, 7) + ".png", "image/png"); S3.done(); } }, "image/png");
    };
    if (document.fonts && document.fonts.load) document.fonts.load("700 30px Inter").then(go, go); else go();
  });

  // ---------- controls ----------
  function seg(el, value, onPick) {
    $$("button", el).forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.v === String(value)));
      b.addEventListener("click", function () { $$("button", el).forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); }); onPick(b.dataset.v); });
    });
  }
  L.en.months.forEach(function (n, i) { $("#month").appendChild(h("option", { value: i + 1, text: n })); });
  seg($("#view"), st.view, function (v) { st.view = v; render(); });
  seg($("#weekStart"), st.weekStart, function (v) { st.weekStart = +v; render(); });
  seg($("#lang"), st.lang, function (v) { st.lang = v; render(); });
  seg($("#orient"), st.orient, function (v) { st.orient = v; render(); });
  $("#paper").value = st.paper; $("#paper").addEventListener("change", function (e) { st.paper = e.target.value === "Letter" ? "Letter" : "A4"; render(); });
  $("#hijri").checked = st.hijri; $("#hijri").addEventListener("change", function (e) { st.hijri = e.target.checked; render(); });
  $("#indic").checked = st.indic; $("#indic").addEventListener("change", function (e) { st.indic = e.target.checked; render(); });
  $("#title").value = st.title; $("#title").addEventListener("input", S3.debounce(function (e) { st.title = e.target.value.slice(0, 60); render(); }, 150));
  $("#month").addEventListener("change", function (e) { st.m = +e.target.value; render(); });
  $("#year").addEventListener("change", function (e) { var y = parseInt(e.target.value, 10); if (y >= 1900 && y <= 2100) { st.y = y; render(); } else e.target.value = st.y; });
  function step(k) {
    if (st.view === "year") st.y = Math.min(2100, Math.max(1900, st.y + k));
    else { var t = st.y * 12 + st.m - 1 + k; if (t >= 1900 * 12 && t < 2101 * 12) { st.y = Math.floor(t / 12); st.m = t % 12 + 1; } }
    render();
  }
  $("#prev").addEventListener("click", function () { step(-1); });
  $("#next").addEventListener("click", function () { step(1); });
  $("#today").addEventListener("click", function () { st.y = now.getFullYear(); st.m = now.getMonth() + 1; render(); });
  $("#print").addEventListener("click", function () { window.print(); S3.done(); });
  document.addEventListener("keydown", function (e) {
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "ArrowLeft" || e.key === "PageUp") step(-1);
    if (e.key === "ArrowRight" || e.key === "PageDown") step(1);
  });
  $("#evDate").value = iso(st.y, st.m, 1);
  renderEvents(); render();

  window.S3_DEMO = function () {
    events = cleanEvents([
      { date: "2026-12-03", text: "Sara's birthday", color: "purple", yearly: true }, { date: "2026-12-10", text: "Dentist 4 pm", color: "blue" },
      { date: "2026-12-17", text: "Project deadline", color: "red" }, { date: "2026-12-24", text: "Secret Santa night", color: "green" },
      { date: "2026-12-25", text: "Christmas", color: "orange", yearly: true }, { date: "2026-12-31", text: "New Year's Eve party", color: "teal" },
      { date: "2026-12-14", text: "Swimming lesson", color: "yellow" }]);
    renderEvents();
    st.view = "month"; st.y = 2026; st.m = 12; st.hijri = true; st.lang = "en"; st.weekStart = 6; st.orient = "landscape"; st.title = "Family calendar";
    $("#title").value = st.title; $("#hijri").checked = true;
    $$("#view button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.v === "month")); });
    render();
  };

  window.S3_SELFTEST = function () {
    var a = monthCells(2027, 1, 6), b = monthCells(2027, 1, 0), c = monthCells(2027, 1, 1), f = monthCells(2026, 2, 0), au = monthCells(2026, 8, 0);
    var hp = hijriParts(dfc(2000, 1, 1)), hp2 = hijriParts(dfc(2026, 2, 18));
    var evs = cleanEvents([{ date: "2026-02-30", text: "x" }, { date: "2026-05-01", text: "  " }, { date: "2026-05-01", text: "<b>x</b>", color: "javascript:", yearly: "yes" },
      { date: "2024-02-29", text: "Leap", yearly: true }, 7]);
    return wd(dfc(2027, 1, 1)) === 5 && a.lead === 6 && b.lead === 5 && c.lead === 4 && a.cells[6].d === 1 && a.cells[0].m === 12 &&
      f.lead === 0 && f.rows === 4 && au.lead === 6 && au.rows === 6 && monthCells(2026, 8, 6).lead === 0 && wd(dfc(2026, 10, 26)) === 1 &&
      !!hp && hp.y === 1420 && hp.m === 9 && hp.d === 24 && !!hp2 && hp2.m === 9 && hp2.d === 1 && hijriMonthName(dfc(2000, 1, 1), false).indexOf("Ram") === 0 &&
      evs.length === 2 && evs[1].color === "teal" && evs[1].yearly === false && evs[1].text === "<b>x</b>" &&
      eventsOn(evs, 2028, 2, 29).length === 1 && eventsOn(evs, 2023, 2, 28).length === 0 &&
      L.lev.months[0] === "كانون الثاني" && L.ar.months.length === 12 && L.lev.months.length === 12;
  };
})();
