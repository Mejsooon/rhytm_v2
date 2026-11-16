/* Minimal runtime for the rhytm mockups (.dc.html): renders the <x-dc> template
   with values from the page's Component class, re-renders on setState. */
(function () {
  var hideCss = document.createElement('style');
  hideCss.textContent = 'x-dc{display:none!important}';
  document.head.appendChild(hideCss);

  function DCLogic(props) { this.props = props || {}; this.state = {}; }
  DCLogic.prototype.setState = function (patch) {
    var next = typeof patch === 'function' ? patch(this.state) : patch;
    this.state = Object.assign({}, this.state, next);
    if (this.__rerender) this.__rerender();
  };
  window.DCLogic = DCLogic;

  var TABLE_TAGS = { 'dc-t-table': 'table', 'dc-t-thead': 'thead', 'dc-t-tbody': 'tbody', 'dc-t-tfoot': 'tfoot', 'dc-t-tr': 'tr', 'dc-t-td': 'td', 'dc-t-th': 'th', 'dc-t-colgroup': 'colgroup', 'dc-t-col': 'col', 'dc-t-caption': 'caption' };
  var HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;
  var ONLY_HOLE = /^\{\{\s*([^}]+?)\s*\}\}$/;

  function lookup(path, scopes) {
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (path === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    var parts = path.split('.');
    for (var i = scopes.length - 1; i >= 0; i--) {
      var sc = scopes[i];
      if (sc && Object.prototype.hasOwnProperty.call(sc, parts[0])) {
        var v = sc[parts[0]];
        for (var j = 1; j < parts.length; j++) { if (v == null) return undefined; v = v[parts[j]]; }
        return v;
      }
    }
    return undefined;
  }
  function interp(str, scopes) {
    return str.replace(HOLE, function (_, p) { var v = lookup(p, scopes); return v == null || v === false ? '' : String(v); });
  }
  function camel(s) { return s.replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); }); }

  // component definitions --------------------------------------------------
  var defs = {};
  function parseDef(doc) {
    var tpl = doc.querySelector('x-dc');
    var script = doc.querySelector('script[data-dc-script]');
    var props = {};
    if (script && script.getAttribute('data-props')) {
      try {
        var pd = JSON.parse(script.getAttribute('data-props'));
        Object.keys(pd).forEach(function (k) { if (k.charAt(0) !== '$' && pd[k] && 'default' in pd[k]) props[k] = pd[k].default; });
      } catch (e) {}
    }
    var Cls = DCLogic;
    if (script) {
      try { Cls = new Function('DCLogic', script.textContent + '\n;return Component;')(DCLogic); } catch (e) { console.error(e); }
    }
    var helmet = tpl ? tpl.querySelector('helmet') : null;
    return { tpl: tpl, helmet: helmet, Cls: Cls, props: props };
  }
  function addHelmet(def) {
    if (!def.helmet || def.helmetAdded) return;
    def.helmetAdded = true;
    Array.prototype.forEach.call(def.helmet.children, function (n) { document.head.appendChild(n.cloneNode(true)); });
  }
  function loadImports(root, done) {
    var names = {};
    Array.prototype.forEach.call(root.querySelectorAll('dc-import'), function (el) { var n = el.getAttribute('name'); if (n && !defs[n]) names[n] = 1; });
    var list = Object.keys(names);
    if (!list.length) return done();
    var left = list.length;
    list.forEach(function (n) {
      fetch(n + '.dc.html').then(function (r) { return r.text(); }).then(function (txt) {
        var doc = new DOMParser().parseFromString(txt, 'text/html');
        defs[n] = parseDef(doc);
        addHelmet(defs[n]);
        loadImports(defs[n].tpl, function () { if (--left === 0) done(); });
      }).catch(function () { if (--left === 0) done(); });
    });
  }

  // rendering --------------------------------------------------------------
  function renderChildren(src, out, scopes, ctx) {
    for (var c = src.firstChild; c; c = c.nextSibling) renderNode(c, out, scopes, ctx);
  }
  function renderNode(node, out, scopes, ctx) {
    if (node.nodeType === 3) { out.appendChild(document.createTextNode(node.nodeValue.indexOf('{{') < 0 ? node.nodeValue : interp(node.nodeValue, scopes))); return; }
    if (node.nodeType !== 1) return;
    var tag = node.localName;
    if (tag === 'helmet') return;
    if (tag === 'sc-for') {
      var lm = ONLY_HOLE.exec(node.getAttribute('list') || '');
      var list = lm ? lookup(lm[1], scopes) : null;
      var as = node.getAttribute('as') || 'item';
      if (list && list.length) {
        for (var i = 0; i < list.length; i++) { var s = {}; s[as] = list[i]; s[as + 'Index'] = i; renderChildren(node, out, scopes.concat([s]), ctx); }
      }
      return;
    }
    if (tag === 'sc-if') {
      var vm = ONLY_HOLE.exec(node.getAttribute('value') || '');
      var val = vm ? lookup(vm[1], scopes) : node.getAttribute('value');
      if (val && !(Array.isArray(val) && !val.length)) renderChildren(node, out, scopes, ctx);
      return;
    }
    if (tag === 'dc-import') {
      var def = defs[node.getAttribute('name')];
      if (!def) return;
      var props = Object.assign({}, def.props);
      Array.prototype.forEach.call(node.attributes, function (a) {
        if (a.name === 'name' || a.name.indexOf('hint-') === 0) return;
        var m = ONLY_HOLE.exec(a.value), v;
        if (m) v = lookup(m[1], scopes); else { v = interp(a.value, scopes); if (/^-?\d+(\.\d+)?$/.test(v)) v = Number(v); }
        props[camel(a.name)] = v;
      });
      var inst = new def.Cls(props);
      inst.props = props;
      var wrap = document.createElement('div');
      wrap.style.display = 'contents';
      renderChildren(def.tpl, wrap, [inst.renderVals ? inst.renderVals() : {}], ctx);
      out.appendChild(wrap);
      return;
    }
    var el;
    if (TABLE_TAGS[tag]) el = document.createElement(TABLE_TAGS[tag]);
    else el = node.cloneNode(false);
    if (TABLE_TAGS[tag]) Array.prototype.forEach.call(node.attributes, function (a) { el.setAttribute(a.name, a.value); });
    var attrs = Array.prototype.slice.call(el.attributes);
    attrs.forEach(function (a) {
      var name = a.name;
      if (name.indexOf('hint-') === 0) { el.removeAttribute(name); return; }
      if (a.value.indexOf('{{') < 0) {
        if (name === 'defaultchecked') { el.removeAttribute(name); el.checked = true; }
        return;
      }
      var m = ONLY_HOLE.exec(a.value);
      if (m) {
        var v = lookup(m[1], scopes);
        if (name.indexOf('on') === 0 && name.length > 2) {
          el.removeAttribute(name);
          if (typeof v === 'function') {
            var ev = name.slice(2);
            if (ev === 'change' && (el.type === 'checkbox' || el.type === 'radio' || el.localName === 'select')) ev = 'change';
            el.addEventListener(ev, function (e) { v(e); });
          }
          return;
        }
        if (name === 'checked' || name === 'defaultchecked' || name === 'selected' || name === 'disabled' || name === 'open' || name === 'hidden' || name === 'required') {
          el.removeAttribute(name);
          var prop = name === 'defaultchecked' ? 'checked' : name;
          if (v) { el[prop] = true; if (prop !== 'checked' && prop !== 'selected') el.setAttribute(prop, ''); }
          return;
        }
        if (name === 'value') { el.setAttribute('value', v == null ? '' : String(v)); el.value = v == null ? '' : String(v); return; }
        if (v == null || v === false) { el.removeAttribute(name); return; }
        el.setAttribute(name, String(v));
        return;
      }
      el.setAttribute(name, interp(a.value, scopes));
    });
    if (el.localName === 'select') ctx.selects.push(el);
    renderChildren(node, el, scopes, ctx);
    out.appendChild(el);
  }

  function mount() {
    var tpl = document.querySelector('x-dc');
    if (!tpl) return;
    var page = parseDef(document);
    addHelmet(page);
    var host = document.createElement('div');
    host.className = 'dc-root';
    tpl.parentNode.insertBefore(host, tpl);
    var inst = new page.Cls(Object.assign({}, page.props));
    inst.props = Object.assign({}, page.props, inst.props);
    if (!inst.state) inst.state = {};
    var queued = false;
    function render() {
      queued = false;
      var vals = {};
      try { vals = inst.renderVals ? inst.renderVals() : {}; } catch (e) { console.error(e); }
      var frag = document.createDocumentFragment();
      var ctx = { selects: [] };
      renderChildren(tpl, frag, [vals], ctx);
      var active = document.activeElement, activeId = active && active.getAttribute && active.getAttribute('aria-label');
      host.textContent = '';
      host.appendChild(frag);
      if (activeId) { var again = host.querySelector('[aria-label="' + activeId.replace(/"/g, '\\"') + '"]'); if (again && again.focus) again.focus(); }
    }
    inst.__rerender = function () { if (!queued) { queued = true; requestAnimationFrame(render); } };
    loadImports(tpl, render);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
