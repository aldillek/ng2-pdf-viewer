(() => {
  'use strict';
  var e,
    i = {},
    _ = {};
  function n(e) {
    var f = _[e];
    if (void 0 !== f) return f.exports;
    var r = (_[e] = { exports: {} });
    return i[e](r, r.exports, n), r.exports;
  }
  (n.m = i),
    (e = []),
    (n.O = (f, r, u, l) => {
      if (!r) {
        var c = 1 / 0;
        for (a = 0; a < e.length; a++) {
          for (var [r, u, l] = e[a], v = !0, o = 0; o < r.length; o++)
            (!1 & l || c >= l) && Object.keys(n.O).every((p) => n.O[p](r[o]))
              ? r.splice(o--, 1)
              : ((v = !1), l < c && (c = l));
          if (v) {
            e.splice(a--, 1);
            var t = u();
            void 0 !== t && (f = t);
          }
        }
        return f;
      }
      l = l || 0;
      for (var a = e.length; a > 0 && e[a - 1][2] > l; a--) e[a] = e[a - 1];
      e[a] = [r, u, l];
    }),
    (n.d = (e, f) => {
      for (var r in f)
        n.o(f, r) &&
          !n.o(e, r) &&
          Object.defineProperty(e, r, { enumerable: !0, get: f[r] });
    }),
    (n.o = (e, f) => Object.prototype.hasOwnProperty.call(e, f)),
    (n.r = (e) => {
      typeof Symbol < 'u' &&
        Symbol.toStringTag &&
        Object.defineProperty(e, Symbol.toStringTag, { value: 'Module' }),
        Object.defineProperty(e, '__esModule', { value: !0 });
    }),
    (() => {
      var e = { 666: 0 };
      n.O.j = (u) => 0 === e[u];
      var f = (u, l) => {
          var o,
            t,
            [a, c, v] = l,
            d = 0;
          if (a.some((b) => 0 !== e[b])) {
            for (o in c) n.o(c, o) && (n.m[o] = c[o]);
            if (v) var s = v(n);
          }
          for (u && u(l); d < a.length; d++)
            n.o(e, (t = a[d])) && e[t] && e[t][0](), (e[t] = 0);
          return n.O(s);
        },
        r = (self.webpackChunkng2_pdf_viewer =
          self.webpackChunkng2_pdf_viewer || []);
      r.forEach(f.bind(null, 0)), (r.push = f.bind(null, r.push.bind(r)));
    })();
})();
