"use client";

import { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

const modes = {
  everyday: {
    label: "Everyday",
    delay: "24 hours",
    helper: "A polished default follow-up for day-to-day introductions.",
  },
  event: {
    label: "Event",
    delay: "48 hours",
    helper: "Use a separate message and timing for conferences or networking events.",
  },
};

type ModeKey = keyof typeof modes;

const demoConnections = [
  { name: "Alex Smith", meta: "Today · Everyday", status: "Scheduled tomorrow" },
  { name: "Mike Jones", meta: "Today · NYC Fintech Summit", status: "Scheduled in 48h" },
  { name: "Sarah Brown", meta: "Yesterday · Everyday", status: "✓ Sent" },
];

export default function Home() {
  const [mode, setMode] = useState<ModeKey>("everyday");
  const [automationOn, setAutomationOn] = useState(true);
  const [eventName, setEventName] = useState("NYC Fintech Summit");

  const publicUrl = useMemo(() => {
    if (typeof window === "undefined") return "https://biz-card.vercel.app/ross";
    return `${window.location.origin}/ross`;
  }, []);

  return (
    <main className="shell">
      <div className="topbar">
        <div className="brand">Biz Card</div>
        <div className="avatar">RC</div>
      </div>

      <div className="eyebrow">Your smart card</div>
      <h1 className="heroTitle">Meet once.<br />Follow up automatically.</h1>
      <p className="heroCopy">Choose the context, show your QR, and the follow-up workflow starts when someone swaps contacts with you.</p>

      <section className="card sectionGap stack">
        <div>
          <div className="miniLabel">Current mode</div>
          <div className="modeTabs" style={{ marginTop: 10 }}>
            {(Object.keys(modes) as ModeKey[]).map((key) => (
              <button key={key} className={`modeTab ${mode === key ? "active" : ""}`} onClick={() => setMode(key)}>
                {modes[key].label}
              </button>
            ))}
          </div>
        </div>

        {mode === "event" && (
          <div className="field">
            <label htmlFor="event-name">Event name</label>
            <input id="event-name" className="input" value={eventName} onChange={(event) => setEventName(event.target.value)} />
          </div>
        )}

        <div className="qrWrap">
          <QRCodeSVG value={publicUrl} level="M" marginSize={1} />
        </div>

        <div className="statusPill">
          <span className="statusDot" />
          {automationOn ? `${modes[mode].label} · follow-up in ${modes[mode].delay}` : "Automation paused"}
        </div>
        <div className="helper">Have them scan this. They share their info, then save yours.</div>

        <a className="primaryButton" href="/ross">Preview scan experience</a>
        <button className="secondaryButton" onClick={() => setAutomationOn((value) => !value)}>
          {automationOn ? "Pause automatic follow-up" : "Turn automatic follow-up on"}
        </button>
      </section>

      <section className="sectionGap automationCard">
        <div className="automationIcon">↗</div>
        <div>
          <strong>{automationOn ? "Automatic follow-up is on" : "Automatic follow-up is paused"}</strong>
          <p>{automationOn ? `${modes[mode].helper} The message will send ${modes[mode].delay} after a new connection.` : "New connections can still swap contact information, but no message will be scheduled."}</p>
        </div>
      </section>

      <section className="card sectionGap">
        <div className="miniLabel">Recent connections</div>
        {demoConnections.map((connection) => (
          <div className="connectionRow" key={connection.name}>
            <div>
              <div className="connectionName">{connection.name}</div>
              <div className="connectionMeta">{connection.meta}</div>
            </div>
            <div className="connectionStatus">{connection.status}</div>
          </div>
        ))}
      </section>
    </main>
  );
}
