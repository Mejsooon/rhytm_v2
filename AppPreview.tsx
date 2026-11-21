// AppPreview — a scroll story with the real rhytm COSS UI mockups (Rhytm Design artifact), running 1:1.
// While the section scrolls past, the app window stays pinned to the screen:
//   1. it zooms in from a slight tilt,
//   2. it slides to the right and the description appears on the left,
//   3. each further part of the scroll fades to the next screen (Today → Calendar → Sport → Habits → Pages).
// Narrow frames (under 900 px) put the text above the window; under 640 px the phone app is shown.
// The mockups stay clickable. In the Framer canvas the first screen is shown without the scroll story.
import * as React from "react"
import { createPortal } from "react-dom"
import { addPropertyControls, ControlType, RenderTarget } from "framer"
import { makeScreen, scopeCss } from "./DcMini.tsx"
import { FILES, CSS } from "./CossMockups.ts"

const STEPS = [
    { desktop: "CToday", phone: "CMToday", label: "Today", title: "Your whole day on one screen.", text: "Time blocks, tasks, habits and the week in numbers. Click a block to see its tasks and tick them off.", hint: "Try it: click the green block." },
    { desktop: "CCalendar", phone: "CMCalendarDay", label: "Calendar", title: "Plan the week in blocks.", text: "Day, week and month views with colour categories. Renewals from your pages show up on their date.", hint: "Try it: hide a category or open a block." },
    { desktop: "CSport", phone: "CMSport", label: "Sport", title: "Runs and the gym, in one place.", text: "Distance, pace, sets and records on one calendar. A workout template turns a session into one click.", hint: "Try it: switch between Run and Gym." },
    { desktop: "CHabits", phone: "CMHabits", label: "Habits and sleep", title: "Streaks you can actually see.", text: "Tick today's habits, log last night's sleep and watch a whole year of consistency in the heatmap.", hint: "Try it: tick a habit for today." },
    { desktop: "CMain", phone: "CMPages", label: "Pages", title: "Pages for everything else.", text: "Subscriptions, books, projects and passwords. Tables with typed fields, and a vault encrypted in your browser.", hint: "Try it: open Books or Passwords in the sidebar." },
]

// scroll lengths, in screen heights
const ZOOM = 0.9
const MOVE = 0.6
const STEP = 0.9

const KIT = makeScreen(FILES)
const BASE_CSS = scopeCss(CSS.replace(/@font-face\{[^}]*\}/g, ""))

// one live mockup in its own shadow root, drawn at design size and scaled to `width`
const Layer = React.memo(function Layer({ start, designW, designH, width, radius, shadow }: any) {
    const host = React.useRef<HTMLDivElement>(null)
    const [root, setRoot] = React.useState<any>(null)
    const [screen, setScreen] = React.useState(start)
    const ctx = React.useMemo(() => ({ Screen: KIT.Screen, go: (n: string) => FILES[n] && setScreen(n) }), [])

    React.useEffect(() => {
        const el = host.current
        if (!el) return
        const r = el.shadowRoot || el.attachShadow({ mode: "open" })
        KIT.DCLogic.roots.push(r)
        setRoot(r)
        return () => {
            KIT.DCLogic.roots = KIT.DCLogic.roots.filter((x: any) => x !== r)
        }
    }, [])
    React.useEffect(() => setScreen(start), [start])

    const scale = width / designW
    const css = BASE_CSS + ".dc-body .sb-col{position:sticky;top:0;align-self:flex-start;height:" + designH + "px;overflow-y:auto}.dc-body .shell{min-height:" + designH + "px!important}"

    return (
        <div
            ref={host}
            style={{
                width,
                height: designH * scale,
                borderRadius: radius,
                overflow: "hidden",
                border: "1px solid rgba(0,0,0,.08)",
                boxShadow: shadow ? "0 1px 2px rgba(0,0,0,.04), 0 32px 80px -12px rgba(0,0,0,.18)" : "none",
                boxSizing: "border-box",
                background: "#fff",
            }}
        >
            {root &&
                createPortal(
                    <div style={{ width: designW, height: designH, transform: "scale(" + scale + ")", transformOrigin: "0 0" }}>
                        <style>{css}</style>
                        <div className="dc-body" style={{ width: designW, height: designH, overflow: "hidden", position: "relative", background: "#fff", fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif', color: "#262626", WebkitFontSmoothing: "antialiased" }}>
                            <KIT.Screen key={screen} name={screen} props={{}} ctx={ctx} />
                        </div>
                    </div>,
                    root
                )}
        </div>
    )
})

/**
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 1200
 */
export default function AppPreview({ shadow, desktopHeight, style }: { shadow: boolean; desktopHeight: number; style?: React.CSSProperties }) {
    const wrap = React.useRef<HTMLDivElement>(null)
    const stage = React.useRef<HTMLDivElement>(null)
    const [W, setW] = React.useState(1200)
    const [vh, setVh] = React.useState(800)
    const [u, setU] = React.useState(0)
    const [manual, setManual] = React.useState(false)
    const [reduced, setReduced] = React.useState(false)
    const canvas = RenderTarget.current() === RenderTarget.canvas

    const n = STEPS.length
    const total = ZOOM + MOVE + STEP * n
    const wrapH = canvas ? 0 : Math.round((total + 1) * vh)

    React.useEffect(() => {
        const el = wrap.current
        if (!el) return
        const observer = new ResizeObserver((entries) => setW(entries[0].contentRect.width))
        observer.observe(el)
        const onResize = () => setVh(window.innerHeight)
        onResize()
        window.addEventListener("resize", onResize)
        setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches)
        return () => {
            observer.disconnect()
            window.removeEventListener("resize", onResize)
        }
    }, [])

    React.useEffect(() => {
        if (canvas) return
        let frame = 0
        const onScroll = () => {
            cancelAnimationFrame(frame)
            frame = requestAnimationFrame(() => {
                const el = wrap.current
                if (!el) return
                const r = el.getBoundingClientRect()
                const h = window.innerHeight
                setU(Math.max(0, Math.min(total, -r.top / h)))
                // if a parent blocks position: sticky, pin the stage by hand
                const s = stage.current
                if (s && !manual && r.top < -40 && r.bottom > h + 40 && Math.abs(s.getBoundingClientRect().top) > 4) setManual(true)
            })
        }
        onScroll()
        window.addEventListener("scroll", onScroll, { passive: true })
        return () => {
            cancelAnimationFrame(frame)
            window.removeEventListener("scroll", onScroll)
        }
    }, [canvas, manual, total])

    const clamp = (x: number) => Math.min(1, Math.max(0, x))
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t

    const phone = W < 640
    const side = W >= 900
    const designW = phone ? 390 : 1440
    const designH = phone ? 844 : desktopHeight
    const aspect = designW / designH
    const stageH = canvas ? (side ? Math.round(W * 0.42) + 80 : Math.round(Math.min(W, 420) / aspect) + 300) : vh

    const zoomT = canvas || reduced ? 1 : ease(clamp(u / ZOOM))
    const moveT = canvas || reduced ? 1 : ease(clamp((u - ZOOM) / MOVE))
    const stepF = canvas ? 0 : (u - ZOOM - MOVE) / STEP

    // window size: big (centred, full width) and side (right column) / stacked (under the text)
    const textH = side ? 0 : phone ? 190 : 170
    const bigW = side ? Math.min(W, (stageH - 120) * aspect) : Math.min(W, (stageH - textH - 48) * aspect)
    const smallW = side ? Math.min(W * 0.62, (stageH - 140) * aspect) : bigW * 0.94
    const curW = lerp(bigW * lerp(0.78, 1, zoomT), smallW, moveT)
    const k = curW / bigW
    const cx = side ? lerp(W / 2, W - smallW / 2, moveT) : W / 2
    const cy = side ? stageH / 2 : lerp(stageH / 2, textH + (stageH - textH) / 2, moveT)
    const tilt = lerp(16, 0, zoomT)

    // how visible step i is (screens and texts cross-fade between steps)
    const weight = (i: number) => {
        const enter = i === 0 ? 1 : clamp((stepF - i + 0.2) / 0.3)
        const leave = i === n - 1 ? 1 : clamp((i + 1 - stepF + 0.1) / 0.3)
        return Math.min(enter, leave)
    }
    const active = Math.max(0, Math.min(n - 1, Math.floor(stepF + 0.05)))

    const stageStyle: React.CSSProperties = manual
        ? { position: "absolute", left: 0, right: 0, top: Math.round(Math.max(0, Math.min(wrapH - vh, u * vh))), height: stageH }
        : { position: canvas ? "relative" : "sticky", top: 0, height: stageH }

    return (
        <div ref={wrap} style={{ ...style, width: "100%", height: canvas ? stageH : wrapH, position: "relative" }}>
            <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400..700&display=swap" />
            <div ref={stage} style={{ ...stageStyle, width: "100%", perspective: 1800, fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif' }}>
                {/* the texts */}
                <div style={{ position: "absolute", left: 0, top: side ? 0 : phone ? 16 : 24, width: side ? Math.max(260, W - smallW - 64) : W, height: side ? stageH : textH, pointerEvents: "none" }}>
                    {STEPS.map((s, i) => {
                        const o = weight(i) * clamp((moveT - 0.55) / 0.45)
                        return (
                            <div key={s.label} style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: side ? "center" : "flex-start", alignItems: side ? "flex-start" : "center", textAlign: side ? "left" : "center", gap: phone ? 10 : 14, opacity: o, transform: "translateY(" + (1 - o) * 20 + "px)", pointerEvents: o > 0.6 ? "auto" : "none" }}>
                                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 28, padding: "0 12px 0 10px", borderRadius: 999, border: "1px solid #EAEAEA", background: "#fff", fontSize: 13, fontWeight: 500, color: "#404040" }}>
                                    <span style={{ width: 8, height: 8, borderRadius: 2, background: "#15803D" }} />
                                    {String(i + 1).padStart(2, "0")} · {s.label}
                                </div>
                                <div style={{ fontSize: side ? Math.min(44, W * 0.032) : phone ? 26 : 32, lineHeight: 1.08, fontWeight: 600, letterSpacing: "-0.035em", color: "#171717", maxWidth: side ? 420 : 560 }}>{s.title}</div>
                                <div style={{ fontSize: phone ? 15 : 17, lineHeight: 1.5, color: "#666", maxWidth: side ? 400 : 520 }}>{s.text}</div>
                                {side && <div style={{ fontSize: 13, color: "#15803D", fontWeight: 500 }}>{s.hint}</div>}
                            </div>
                        )
                    })}
                    {/* progress: one bar per screen */}
                    {side && (
                        <div style={{ position: "absolute", left: 0, bottom: 56, display: "flex", gap: 6, opacity: moveT }}>
                            {STEPS.map((s, i) => (
                                <span key={s.label} style={{ width: i === active ? 28 : 12, height: 4, borderRadius: 2, background: i === active ? "#171717" : "#D4D4D4", transition: "width .3s, background .3s" }} />
                            ))}
                        </div>
                    )}
                </div>

                {/* the app window */}
                <div
                    style={{
                        position: "absolute",
                        left: cx - bigW / 2,
                        top: cy - bigW / aspect / 2,
                        width: bigW,
                        height: bigW / aspect,
                        transform: "scale(" + k + ") rotateX(" + tilt + "deg)",
                        transformOrigin: "50% 50%",
                        willChange: "transform",
                    }}
                >
                    {STEPS.map((s, i) => {
                        const o = canvas ? (i === 0 ? 1 : 0) : weight(i)
                        return (
                            <div key={s.label} style={{ position: "absolute", inset: 0, opacity: o, transform: "translateY(" + (1 - o) * 16 + "px) scale(" + (0.985 + o * 0.015) + ")", pointerEvents: o > 0.6 ? "auto" : "none", zIndex: i === active ? 2 : 1 }}>
                                <Layer start={phone ? s.phone : s.desktop} designW={designW} designH={designH} width={bigW} radius={phone ? 36 : 16} shadow={shadow} />
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

AppPreview.displayName = "App Preview"

addPropertyControls(AppPreview, {
    desktopHeight: { type: ControlType.Number, title: "Desktop H", min: 700, max: 1200, step: 10, defaultValue: 900 },
    shadow: { type: ControlType.Boolean, title: "Shadow", defaultValue: true },
})
