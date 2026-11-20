// dcmini — a small runtime that runs the rhytm COSS mockups (*.dc.html) as they are:
// the same markup, CSS classes, inline styles and component logic as in the Rhytm Design artifact.
// A mockup is: <x-dc> template (with sc-for / sc-if / dc-import and {{bindings}}) + a class Component extends DCLogic.
import * as React from "react"

type Node = { t: "text"; v: string } | { t: "el"; tag: string; attrs: [string, string][]; kids: Node[] }
type Parsed = { tpl: Node[]; css: string; Comp: any; defaults: Record<string, any> }

const cache: Record<string, Parsed> = {}

const EVENTS: Record<string, string> = {}
"Click DoubleClick Change Input MouseDown MouseMove MouseUp MouseEnter MouseLeave MouseOver MouseOut KeyDown KeyUp KeyPress Blur Focus Drop DragStart DragOver DragEnd DragEnter DragLeave Submit ContextMenu PointerDown PointerMove PointerUp PointerEnter PointerLeave Scroll Wheel TouchStart TouchMove TouchEnd"
    .split(" ")
    .forEach((e) => (EVENTS["on" + e.toLowerCase()] = "on" + e))
EVENTS["ondblclick"] = "onDoubleClick"

const ATTRS: Record<string, string> = { class: "className", for: "htmlFor", tabindex: "tabIndex", readonly: "readOnly", maxlength: "maxLength", autocomplete: "autoComplete", autofocus: "autoFocus", colspan: "colSpan", rowspan: "rowSpan", spellcheck: "spellCheck", contenteditable: "contentEditable", viewbox: "viewBox", preserveaspectratio: "preserveAspectRatio", enterkeyhint: "enterKeyHint", inputmode: "inputMode", srcset: "srcSet", crossorigin: "crossOrigin" }

// the mockups style "body" and "html body"; inside the preview that is the .dc-body wrapper
export const scopeCss = (css: string) => css.replace(/:root/g, ".dc-body").replace(/html\s+body/g, ".dc-body").replace(/(^|[{},;\s])body(?=[\s{.,:#\[])/g, "$1.dc-body")

const camel = (s: string) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase())

// turns the template HTML into a tree; sc-for / sc-if / dc-import become <template> first, so the
// HTML parser keeps them in place even inside tables
function toTree(el: Element | DocumentFragment): Node[] {
    const out: Node[] = []
    el.childNodes.forEach((n: any) => {
        if (n.nodeType === 3) out.push({ t: "text", v: n.nodeValue })
        else if (n.nodeType === 1) {
            const tag = n.tagName.toLowerCase()
            const attrs: [string, string][] = []
            for (const a of Array.from(n.attributes) as Attr[]) attrs.push([a.name, a.value])
            const kind = tag === "template" ? n.getAttribute("data-dc") : null
            out.push({ t: "el", tag: kind || (n.namespaceURI === "http://www.w3.org/2000/svg" ? n.tagName : tag), attrs: attrs.filter((a) => a[0] !== "data-dc"), kids: toTree(tag === "template" && n.content ? n.content : n) })
        }
    })
    return out
}

export function parse(name: string, html: string, DCLogic: any): Parsed {
    if (cache[name]) return cache[name]
    const css = scopeCss((html.match(/<helmet>([\s\S]*?)<\/helmet>/) || ["", ""])[1].replace(/<\/?style>/g, ""))
    const body = (html.match(/<x-dc>([\s\S]*)<\/x-dc>/) || ["", ""])[1].replace(/<helmet>[\s\S]*?<\/helmet>/, "")
    const prepared = body.replace(/<(\/?)(sc-for|sc-if|dc-import)\b/g, (_m, slash, k) => (slash ? "</template" : '<template data-dc="' + k + '"'))
    const doc = new DOMParser().parseFromString("<body>" + prepared + "</body>", "text/html")
    const sm = html.match(/<script type="text\/x-dc"[^>]*data-props='([^']*)'[^>]*>([\s\S]*?)<\/script>/)
    const defaults: Record<string, any> = {}
    if (sm) {
        try {
            const p = JSON.parse(sm[1])
            for (const k of Object.keys(p)) if (p[k] && p[k].default !== undefined) defaults[k] = p[k].default
        } catch (e) {}
    }
    const code = (sm ? sm[2] : "class Component extends DCLogic { renderVals() { return {} } }").replace(/document\.getElementById\(/g, "__dcGet(")
    const Comp = new Function("DCLogic", "React", "__dcGet", code + "\n;return Component;")(DCLogic, React, (id: string) => (DCLogic.root ? DCLogic.root.getElementById(id) : null))
    cache[name] = { tpl: toTree(doc.body), css, Comp, defaults }
    return cache[name]
}

// {{a.b.c}} → value; text with bindings → string
function lookup(path: string, scope: any[]) {
    if (path === "true") return true
    if (path === "false") return false
    if (path === "null") return null
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path)
    const parts = path.split(".")
    for (const s of scope) {
        if (s && typeof s === "object" && parts[0] in s) {
            let v = s[parts[0]]
            for (let i = 1; i < parts.length; i++) v = v == null ? undefined : v[parts[i]]
            return v
        }
    }
    return undefined
}
function val(raw: string, scope: any[]) {
    const whole = raw.match(/^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/)
    if (whole) return lookup(whole[1], scope)
    if (raw.indexOf("{{") < 0) return raw
    return raw.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_m, p) => {
        const v = lookup(p, scope)
        return v == null || v === false ? "" : String(v)
    })
}
function styleObj(s: string) {
    const o: Record<string, string> = {}
    let depth = 0
    let cur = ""
    const parts: string[] = []
    for (const ch of s) {
        if (ch === "(") depth++
        if (ch === ")") depth--
        if (ch === ";" && depth === 0) {
            parts.push(cur)
            cur = ""
        } else cur += ch
    }
    parts.push(cur)
    for (const p of parts) {
        const i = p.indexOf(":")
        if (i < 0) continue
        const k = p.slice(0, i).trim()
        const v = p.slice(i + 1).trim()
        if (!k) continue
        o[k.startsWith("--") ? k : camel(k.replace(/^-ms-/, "ms-").replace(/^-(webkit|moz)-/, "$1-").replace(/^(webkit|moz)-/, (m) => m))] = v
    }
    // vendor prefixes: -webkit-x → WebkitX
    for (const k of Object.keys(o)) if (/^(webkit|moz)[A-Z]/.test(k)) {
        o[k[0].toUpperCase() + k.slice(1)] = o[k]
        delete o[k]
    }
    return o
}

export function render(nodes: Node[], scope: any[], ctx: any, keyPrefix = "", parent = ""): any[] {
    const tableish = /^(table|thead|tbody|tfoot|tr|colgroup)$/.test(parent)
    const out: any[] = []
    nodes.forEach((n, i) => {
        const key = keyPrefix + i
        if (n.t === "text") {
            if (n.v.indexOf("{{") < 0) {
                if (!(tableish && !n.v.trim())) out.push(n.v.replace(/\s+/g, " "))
            } else out.push(String(val(n.v, scope) ?? ""))
            return
        }
        const a: Record<string, string> = {}
        n.attrs.forEach(([k, v]) => (a[k] = v))
        if (n.tag === "sc-for") {
            const list = val(a.list || "", scope) || []
            const as = a.as || "item"
            ;(list as any[]).forEach((item, j) => out.push(...render(n.kids, [{ [as]: item }, ...scope], ctx, key + "-" + j + "-", parent)))
            return
        }
        if (n.tag === "sc-if") {
            if (val(a.value || "", scope)) out.push(...render(n.kids, scope, ctx, key + "-", parent))
            return
        }
        if (n.tag === "dc-import") {
            const props: Record<string, any> = {}
            for (const [k, v] of n.attrs) if (k !== "name" && !k.startsWith("hint-")) props[camel(k)] = val(v, scope)
            out.push(React.createElement(ctx.Screen, { key, name: a.name, props, ctx }))
            return
        }
        const p: Record<string, any> = { key }
        let hasChange = false
        for (const [k, raw] of n.attrs) if (k === "onchange" || k === "oninput") hasChange = true
        for (const [k, raw] of n.attrs) {
            if (k.startsWith("hint-")) continue
            const v = val(raw, scope)
            if (EVENTS[k]) {
                if (typeof v === "function") p[EVENTS[k]] = v
                continue
            }
            if (k === "style") {
                p.style = styleObj(String(v ?? ""))
                continue
            }
            if (k === "ref") {
                if (typeof v === "function") p.ref = v
                continue
            }
            if (k === "checked") {
                p[hasChange ? "checked" : "defaultChecked"] = v === true || v === "true" || v === "" || v === "checked"
                continue
            }
            if (k === "value" && (n.tag === "input" || n.tag === "textarea" || n.tag === "select")) {
                p[hasChange ? "value" : "defaultValue"] = v ?? ""
                continue
            }
            if (k === "disabled" || k === "hidden" || k === "open" || k === "multiple" || k === "required" || k === "selected") {
                p[k] = !(v === false || v === "false" || v == null)
                continue
            }
            const name = ATTRS[k] || (k.startsWith("aria-") || k.startsWith("data-") ? k : k.indexOf("-") > 0 || k.indexOf(":") > 0 ? camel(k.replace(":", "-")) : k)
            if (v === false || v == null) continue
            p[name] = typeof v === "function" ? v : v === true ? "true" : v
        }
        // links between mockups: stay inside the preview
        if (n.tag === "a" && typeof p.href === "string" && /\.dc\.html/.test(p.href)) {
            const target = p.href.replace(/^\.\//, "").replace(/\.dc\.html.*$/, "")
            const own = p.onClick
            p.onClick = (e: any) => {
                e.preventDefault()
                if (own) own(e)
                ctx.go(target)
            }
            p.href = "#"
        }
        const kids = n.tag === "textarea" ? [] : render(n.kids, scope, ctx, key + "-", n.tag)
        if (n.tag === "textarea" && p.defaultValue === undefined && p.value === undefined) p.defaultValue = n.kids.map((k: any) => (k.t === "text" ? val(k.v, scope) : "")).join("")
        const VOID = /^(input|img|br|hr|meta|link|source|col|area|wbr)$/
        out.push(VOID.test(n.tag) ? React.createElement(n.tag, p) : React.createElement(n.tag, p, ...kids))
    })
    return out
}

// one mockup on screen (a full screen or an imported part like the sidebar)
export function makeScreen(files: Record<string, string>) {
    class DCLogic extends React.Component<any, any> {
        static root: any = null
        constructor(props: any) {
            super(props)
            this.state = this.state || {}
        }
        renderVals(): any {
            return {}
        }
        render() {
            const vals = this.renderVals() || {}
            const self: any = this
            return React.createElement(React.Fragment, null, ...render(self.__tpl, [vals, this.props], self.__ctx))
        }
    }
    function Screen({ name, props, ctx }: any) {
        const html = files[name]
        if (!html) return null
        const parsed = parse(name, html, DCLogic)
        const P = React.useMemo(() => {
            class Bound extends parsed.Comp {}
            ;(Bound.prototype as any).__tpl = parsed.tpl
            ;(Bound.prototype as any).__ctx = ctx
            return Bound
        }, [name])
        return React.createElement(React.Fragment, null, parsed.css ? React.createElement("style", null, parsed.css) : null, React.createElement(P as any, { ...parsed.defaults, ...props }))
    }
    return { Screen, DCLogic }
}
