// AppPreview — the real rhytm COSS UI mockups (from the Rhytm Design artifact), running 1:1:
// the same markup, CSS and component logic, so everything clickable in the mockups is clickable here.
// Wide frames show the desktop app (sidebar), frames narrower than 640 px show the phone app (tab bar).
// The screen is drawn at its design size and scaled to the width of the frame.
import * as React from "react"
import { createPortal } from "react-dom"
import { addPropertyControls, ControlType } from "framer"
import { makeScreen, scopeCss } from "./DcMini.tsx"
import { FILES, CSS } from "./CossMockups.ts"

const DESKTOP_START = { Today: "CToday", Calendar: "CCalendar", Sport: "CSport", Habits: "CHabits", Subscriptions: "CMain", Books: "CBooks", Projects: "CProjects", Passwords: "CPasswords" }
const PHONE_START = { Today: "CMToday", Calendar: "CMCalendarDay", Sport: "CMSport", Habits: "CMHabits", Subscriptions: "CMPages", Books: "CMPages", Projects: "CMPages", Passwords: "CMVault" }

/**
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 1100
 */
export default function AppPreview({ shadow, start, desktopHeight, style }: { shadow: boolean; start: string; desktopHeight: number; style?: React.CSSProperties }) {
    const box = React.useRef<HTMLDivElement>(null)
    const host = React.useRef<HTMLDivElement>(null)
    const [width, setWidth] = React.useState(1100)
    const [root, setRoot] = React.useState<any>(null)
    const phone = width < 640
    const first = (phone ? PHONE_START : DESKTOP_START)[start] || (phone ? "CMToday" : "CToday")
    const [screen, setScreen] = React.useState(first)
    const kit = React.useMemo(() => makeScreen(FILES), [])
    const ctx = React.useMemo(() => ({ Screen: kit.Screen, go: (n: string) => FILES[n] && setScreen(n) }), [kit])

    React.useEffect(() => {
        const el = box.current
        if (!el) return
        const observer = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width))
        observer.observe(el)
        return () => observer.disconnect()
    }, [])
    React.useEffect(() => {
        const el = host.current
        if (!el) return
        const r = el.shadowRoot || el.attachShadow({ mode: "open" })
        kit.DCLogic.root = r
        setRoot(r)
    }, [kit])
    // switching between the desktop and phone app starts from the matching screen
    React.useEffect(() => setScreen(first), [phone, start])

    const designW = phone ? 390 : 1440
    const designH = phone ? 844 : desktopHeight
    const scale = width / designW
    const css = scopeCss(CSS.replace(/@font-face\{[^}]*\}/g, "")) + ".dc-body .sb-col{position:sticky;top:0;align-self:flex-start;height:" + designH + "px;overflow-y:auto}.dc-body .shell{min-height:" + designH + "px!important}"

    return (
        <div ref={box} style={{ ...style, width: "100%", height: designH * scale, position: "relative" }}>
            <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400..700&display=swap" />
            <div
                ref={host}
                style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: phone ? 36 : 16,
                    overflow: "hidden",
                    border: "1px solid rgba(0,0,0,.08)",
                    boxShadow: shadow ? "0 1px 2px rgba(0,0,0,.04), 0 24px 64px rgba(0,0,0,.10)" : "none",
                    boxSizing: "border-box",
                    background: "#fff",
                }}
            />
            {root &&
                createPortal(
                    <div style={{ width: designW, height: designH, transform: "scale(" + scale + ")", transformOrigin: "0 0" }}>
                        <style>{css}</style>
                        <div className="dc-body" style={{ width: designW, height: designH, overflow: "auto", position: "relative", background: "#fff", fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif', color: "#262626", WebkitFontSmoothing: "antialiased" }}>
                            <kit.Screen key={screen + (phone ? "-p" : "-d")} name={screen} props={{}} ctx={ctx} />
                        </div>
                    </div>,
                    root
                )}
        </div>
    )
}

AppPreview.displayName = "App Preview"

addPropertyControls(AppPreview, {
    start: { type: ControlType.Enum, title: "Start", options: ["Today", "Calendar", "Sport", "Habits", "Subscriptions", "Books", "Projects", "Passwords"], defaultValue: "Today" },
    desktopHeight: { type: ControlType.Number, title: "Desktop H", min: 700, max: 1200, step: 10, defaultValue: 900 },
    shadow: { type: ControlType.Boolean, title: "Shadow", defaultValue: true },
})
