import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  User, Plus, Search, Calendar, Activity, AlertTriangle, ChevronLeft,
  X, Check, Clock, FileText, Phone, Trash2, CalendarPlus, Users,
  Cake, Stethoscope, Save, Loader2, ClipboardList, Mic, Printer, CalendarCheck
} from "lucide-react";
import { supabase } from "./supabaseClient";
import {
  connectGoogleCalendar,
  isGoogleConnected,
  getConnectedEmail,
  createGoogleEvent,
  updateGoogleEvent,
  deleteGoogleEvent,
} from "./googleCalendar";

// ---------- design tokens: RKFisioSport (azul ciano + verde) ----------
const COLOR = {
  ink: "#0B3B42",        // texto principal — azul petróleo profundo
  inkLight: "#4C7176",   // texto secundário
  paper: "#EAF5F5",      // fundo — ciano muito claro
  paperRaised: "#FFFFFF",
  border: "#CFE6E4",
  cyan: "#0891B2",       // marca primária — azul ciano
  cyanDark: "#075E6E",
  cyanBg: "#DEF2F5",
  sage: "#16A34A",       // marca secundária — verde (sessões concluídas)
  sageDark: "#0E7A38",
  sageBg: "#DEF3E4",
  clay: "#D9820C",       // alerta — âmbar (contraste proposital para chamar atenção)
  clayBg: "#FBEAD1",
  clayDark: "#9A5A08",
};
const FONT_DISPLAY = '"Iowan Old Style", "Palatino Linotype", Georgia, serif';
const FONT_BODY = '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';
const FONT_MONO = '"SF Mono", "Menlo", "Consolas", monospace';

const STORAGE_KEY = "rkfisiosport-pacientes";

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function fmtDateLong(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
}

// Cada paciente carrega seu próprio array `sessions`, então a contagem abaixo
// é sempre calculada isoladamente por paciente — nunca compartilhada entre eles.
function sessionsRealizadas(p) {
  return (p.sessions || []).filter((s) => s.status === "realizada").length;
}

function restantes(p) {
  return Math.max(0, (p.planTotal || 0) - sessionsRealizadas(p));
}

function googleCalendarLink(session, patient) {
  const dateStr = (session.date || todayISO()).replace(/-/g, "");
  const timeStr = (session.time || "09:00").replace(":", "") + "00";
  const start = `${dateStr}T${timeStr}`;
  // default duration 50 min
  const startDate = new Date(
    `${session.date || todayISO()}T${session.time || "09:00"}:00`
  );
  const endDate = new Date(startDate.getTime() + 50 * 60000);
  const pad = (n) => String(n).padStart(2, "0");
  const fmt = (d) =>
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(
      d.getHours()
    )}${pad(d.getMinutes())}00`;
  const text = encodeURIComponent(`Fisioterapia — ${patient.name}`);
  const details = encodeURIComponent(
    `Sessão de fisioterapia com Dr. Reinaldo — RKFisioSport.${
      session.notes ? "\n\nObs: " + session.notes : ""
    }`
  );
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${fmt(
    startDate
  )}/${fmt(endDate)}&details=${details}`;
}

// ---------- goniometer arc (signature element) ----------
function GoniometerArc({ value, max, size = 96 }) {
  const r = size / 2 - 10;
  const cx = size / 2;
  const cy = size / 2 + 4;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const circumference = Math.PI * r;
  const dashOffset = circumference * (1 - pct);
  const alert = max > 0 && max - value <= 2 && value < max;
  const done = max > 0 && value >= max;
  const arcColor = done ? COLOR.sage : alert ? COLOR.clay : COLOR.cyan;

  // tick marks like a goniometer, at 0/25/50/75/100%
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const angle = Math.PI - t * Math.PI; // 180deg -> 0deg
    const x1 = cx + Math.cos(angle) * (r + 4);
    const y1 = cy - Math.sin(angle) * (r + 4);
    const x2 = cx + Math.cos(angle) * (r + 8);
    const y2 = cy - Math.sin(angle) * (r + 8);
    return { x1, y1, x2, y2 };
  });

  return (
    <svg width={size} height={size / 2 + 22} style={{ overflow: "visible" }}>
      {ticks.map((t, i) => (
        <line
          key={i}
          x1={t.x1}
          y1={t.y1}
          x2={t.x2}
          y2={t.y2}
          stroke={COLOR.border}
          strokeWidth={1.5}
        />
      ))}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke={COLOR.border}
        strokeWidth={7}
        strokeLinecap="round"
      />
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke={arcColor}
        strokeWidth={7}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        style={{ transition: "stroke-dashoffset 0.4s ease" }}
      />
      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        style={{ fontFamily: FONT_MONO, fontSize: 18, fontWeight: 700, fill: COLOR.ink }}
      >
        {value}/{max}
      </text>
      <text
        x={cx}
        y={cy + 12}
        textAnchor="middle"
        style={{ fontFamily: FONT_BODY, fontSize: 10, fill: COLOR.inkLight }}
      >
        sessões
      </text>
    </svg>
  );
}

// ---------- shared UI bits ----------
function Btn({ children, onClick, variant = "default", style, type = "button", disabled }) {
  const base = {
    fontFamily: FONT_BODY,
    fontSize: 14,
    fontWeight: 600,
    padding: "9px 16px",
    borderRadius: 8,
    border: "1px solid transparent",
    cursor: disabled ? "not-allowed" : "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    opacity: disabled ? 0.5 : 1,
    transition: "opacity 0.15s, transform 0.1s",
  };
  const variants = {
    default: { background: COLOR.cyanDark, color: "#fff" },
    outline: { background: "transparent", color: COLOR.ink, border: `1px solid ${COLOR.border}` },
    ghost: { background: "transparent", color: COLOR.inkLight },
    sage: { background: COLOR.sage, color: "#fff" },
    danger: { background: "transparent", color: COLOR.clayDark, border: `1px solid ${COLOR.clayBg}` },
  };
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={{ ...base, ...variants[variant], ...style }}
      onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.97)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
    >
      {children}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <span
        style={{
          display: "block",
          fontSize: 12,
          fontWeight: 600,
          color: COLOR.inkLight,
          marginBottom: 5,
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  fontFamily: FONT_BODY,
  fontSize: 14,
  padding: "9px 11px",
  borderRadius: 7,
  border: `1px solid ${COLOR.border}`,
  background: "#fff",
  color: COLOR.ink,
  outline: "none",
};

// Campo de texto com botão de ditado por voz (Web Speech API).
// Funciona bem no Chrome e Edge; em navegadores sem suporte, o botão
// de microfone simplesmente não aparece e o campo funciona normalmente.
function VoiceTextarea({ value, onChange, onBlur, placeholder, minHeight = 80 }) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  const supported =
    typeof window !== "undefined" &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => {
    if (!supported) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      const current = valueRef.current || "";
      const next =
        current && !current.endsWith(" ") ? current + " " + transcript : current + transcript;
      onChange(next);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    return () => {
      try {
        recognition.stop();
      } catch (e) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]);

  function toggle() {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setListening(true);
      } catch (e) {}
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        style={{
          ...inputStyle,
          minHeight,
          fontFamily: FONT_BODY,
          resize: "vertical",
          paddingRight: supported ? 38 : 11,
        }}
      />
      {supported && (
        <button
          type="button"
          onClick={toggle}
          title={listening ? "Parar ditado" : "Ditar por voz"}
          className="no-print"
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 26,
            height: 26,
            borderRadius: "50%",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: listening ? COLOR.clay : COLOR.cyanBg,
            color: listening ? "#fff" : COLOR.cyanDark,
            animation: listening ? "rkPulse 1.1s ease-in-out infinite" : "none",
          }}
        >
          <Mic size={13} />
        </button>
      )}
    </div>
  );
}

function Modal({ title, onClose, children, width = 440 }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(11,59,66,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: COLOR.paperRaised,
          borderRadius: 14,
          padding: 24,
          width,
          maxWidth: "100%",
          maxHeight: "85vh",
          overflowY: "auto",
          boxShadow: "0 20px 50px rgba(11,59,66,0.25)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 20, margin: 0, color: COLOR.ink }}>{title}</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{ background: "none", border: "none", cursor: "pointer", color: COLOR.inkLight, padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Badge({ children, tone = "default" }) {
  const tones = {
    default: { bg: COLOR.cyanBg, color: COLOR.cyanDark },
    alert: { bg: COLOR.clayBg, color: COLOR.clayDark },
    neutral: { bg: "#E4EEEC", color: COLOR.inkLight },
  };
  const t = tones[tone];
  return (
    <span
      style={{
        background: t.bg,
        color: t.color,
        fontSize: 11,
        fontWeight: 700,
        padding: "3px 9px",
        borderRadius: 999,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        letterSpacing: 0.3,
      }}
    >
      {children}
    </span>
  );
}

// ---------- main app ----------
export default function ClinicaApp() {
  const [patients, setPatients] = useState(null); // null = loading
  const [saveError, setSaveError] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState("");
  const [googleConnecting, setGoogleConnecting] = useState(false);
  const [googleError, setGoogleError] = useState("");
  const [tab, setTab] = useState("pacientes");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [sessionModalFor, setSessionModalFor] = useState(null); // patient id
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("app_data")
        .select("value")
        .eq("key", STORAGE_KEY)
        .maybeSingle();
      if (error) {
        console.error("Erro ao carregar pacientes:", error);
        setPatients([]);
      } else {
        setPatients(data ? data.value : []);
      }
    })();
  }, []);

  async function persist(next) {
    setPatients(next);
    const { error } = await supabase
      .from("app_data")
      .upsert({ key: STORAGE_KEY, value: next, updated_at: new Date().toISOString() });
    setSaveError(!!error);
  }

  function addPatient(data) {
    const p = {
      id: uid(),
      name: data.name,
      phone: data.phone,
      birthdate: data.birthdate,
      diagnosis: data.diagnosis,
      planTotal: Number(data.planTotal) || 0,
      height: data.height || "",
      weight: data.weight || "",
      bodyFat: data.bodyFat || "",
      muscleMass: data.muscleMass || "",
      createdAt: todayISO(),
      sessions: [], // histórico de sessões exclusivo deste paciente
    };
    persist([p, ...patients]);
    setShowAddPatient(false);
    setSelectedId(p.id);
  }

  function updatePatient(id, patch) {
    persist(patients.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function deletePatient(id) {
    persist(patients.filter((p) => p.id !== id));
    setSelectedId(null);
    setConfirmDelete(null);
  }

  async function handleConnectGoogle() {
    setGoogleError("");
    setGoogleConnecting(true);
    try {
      await connectGoogleCalendar();
      setGoogleConnected(true);
      setGoogleEmail(getConnectedEmail() || "");
    } catch (e) {
      if (e?.wrongAccount) {
        setGoogleError(
          `Essa conta (${e.email || "desconhecida"}) não é a autorizada. Conecte com ${e.required}.`
        );
      } else if (e?.message?.includes("VITE_GOOGLE_CLIENT_ID")) {
        setGoogleError("O app ainda não tem a chave do Google configurada (VITE_GOOGLE_CLIENT_ID).");
      } else {
        setGoogleError("Não foi possível conectar ao Google Agenda. Tente de novo.");
      }
      setGoogleConnected(false);
    } finally {
      setGoogleConnecting(false);
    }
  }

  // Sessões são sempre adicionadas dentro do array do paciente cujo id foi passado,
  // garantindo que o contador de cada paciente nunca se mistura com o de outro.
  // Quando o Google Agenda está conectado, cada sessão "agendada" também vira um
  // evento automático no Google Calendar — sem precisar clicar em nada.
  // Aceita uma lista de sessões de uma vez, o que permite criar agendamentos
  // periódicos (semanal, quinzenal etc.) em uma única chamada.
  async function addSessions(patientId, sessionsList) {
    const patient = patients.find((p) => p.id === patientId);
    const newSessions = [];
    for (const session of sessionsList) {
      let googleEventId = null;
      if (googleConnected && session.status === "agendada" && patient) {
        googleEventId = await createGoogleEvent(session, patient);
        if (!googleEventId) setGoogleConnected(isGoogleConnected());
      }
      newSessions.push({ id: uid(), ...session, googleEventId });
    }
    persist(
      patients.map((p) =>
        p.id === patientId ? { ...p, sessions: [...(p.sessions || []), ...newSessions] } : p
      )
    );
    setSessionModalFor(null);
  }

  async function updateSession(patientId, sessionId, patch) {
    const patient = patients.find((p) => p.id === patientId);
    const session = patient?.sessions.find((s) => s.id === sessionId);
    let googleEventId = session?.googleEventId || null;

    if (patient && session) {
      const updated = { ...session, ...patch };
      if (googleConnected) {
        if (updated.status === "realizada" && googleEventId) {
          // sessão concluída: some do calendário, já que não é mais um compromisso futuro
          await deleteGoogleEvent(googleEventId);
          googleEventId = null;
        } else if (updated.status === "agendada") {
          if (googleEventId) {
            const ok = await updateGoogleEvent(googleEventId, updated, patient);
            if (!ok) setGoogleConnected(isGoogleConnected());
          } else {
            googleEventId = await createGoogleEvent(updated, patient);
          }
        }
      }
    }

    persist(
      patients.map((p) =>
        p.id === patientId
          ? {
              ...p,
              sessions: p.sessions.map((s) =>
                s.id === sessionId ? { ...s, ...patch, googleEventId } : s
              ),
            }
          : p
      )
    );
  }

  async function deleteSession(patientId, sessionId) {
    const patient = patients.find((p) => p.id === patientId);
    const session = patient?.sessions.find((s) => s.id === sessionId);
    if (googleConnected && session?.googleEventId) {
      await deleteGoogleEvent(session.googleEventId);
    }
    persist(
      patients.map((p) =>
        p.id === patientId
          ? { ...p, sessions: p.sessions.filter((s) => s.id !== sessionId) }
          : p
      )
    );
  }

  const filtered = useMemo(() => {
    if (!patients) return [];
    const q = query.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter((p) => p.name.toLowerCase().includes(q));
  }, [patients, query]);

  const selected = patients ? patients.find((p) => p.id === selectedId) : null;

  const upcomingSessions = useMemo(() => {
    if (!patients) return [];
    const list = [];
    patients.forEach((p) => {
      (p.sessions || []).forEach((s) => {
        if (s.status === "agendada") list.push({ ...s, patient: p });
      });
    });
    return list.sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
  }, [patients]);

  const alertCount = patients ? patients.filter((p) => p.planTotal > 0 && restantes(p) <= 2).length : 0;

  if (patients === null) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 60, fontFamily: FONT_BODY, color: COLOR.inkLight }}>
        <Loader2 size={22} className="spin" style={{ animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div
      style={{
        fontFamily: FONT_BODY,
        background: COLOR.paper,
        minHeight: 560,
        borderRadius: 16,
        padding: 0,
        color: COLOR.ink,
        border: `1px solid ${COLOR.border}`,
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes rkPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @media print {
          body * { visibility: hidden; }
          #printable-patient, #printable-patient * { visibility: visible; }
          #printable-patient {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 16px;
          }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
        }
        .print-only { display: none; }
      `}</style>
      {/* header */}
      <div
        style={{
          padding: "22px 24px 0",
          background: `linear-gradient(135deg, ${COLOR.cyanDark} 0%, ${COLOR.cyan} 55%, ${COLOR.sage} 130%)`,
          borderBottom: `1px solid ${COLOR.border}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                background: "#fff",
                borderRadius: 10,
                padding: "6px 10px",
                display: "flex",
                alignItems: "center",
                flexShrink: 0,
                boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
              }}
            >
              <img src="/logo.png" alt="RKFisioSport" style={{ height: 34, display: "block" }} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.9)", fontWeight: 600 }}>
                Consultório Dr. Reinaldo
              </p>
              <p style={{ margin: "1px 0 0", fontSize: 12, color: "rgba(255,255,255,0.8)" }}>
                Prontuários e controle de sessões
              </p>
            </div>
          </div>
          <div className="no-print" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            {googleConnected ? (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#fff",
                  background: "rgba(255,255,255,0.18)",
                  padding: "5px 10px",
                  borderRadius: 999,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <CalendarCheck size={13} /> Google Agenda{googleEmail ? ` · ${googleEmail}` : " conectada"}
              </span>
            ) : (
              <button
                onClick={handleConnectGoogle}
                disabled={googleConnecting}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: COLOR.cyanDark,
                  background: "#fff",
                  border: "none",
                  padding: "6px 12px",
                  borderRadius: 999,
                  cursor: googleConnecting ? "default" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  opacity: googleConnecting ? 0.7 : 1,
                }}
              >
                <CalendarCheck size={13} />
                {googleConnecting ? "Conectando…" : "Conectar Google Agenda"}
              </button>
            )}
            {saveError && (
              <span style={{ fontSize: 12, color: "#fff", background: "rgba(0,0,0,0.2)", padding: "4px 8px", borderRadius: 6 }}>
                Não foi possível salvar agora. Tentando novamente…
              </span>
            )}
            {googleError && (
              <span style={{ fontSize: 12, color: "#fff", background: "rgba(0,0,0,0.25)", padding: "4px 8px", borderRadius: 6, maxWidth: 220, textAlign: "right" }}>
                {googleError}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 18 }}>
          {[
            { id: "pacientes", label: "Pacientes", icon: Users },
            { id: "agenda", label: "Agenda", icon: Calendar },
          ].map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setTab(t.id);
                  setSelectedId(null);
                }}
                style={{
                  background: active ? "rgba(255,255,255,0.16)" : "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "10px 14px",
                  borderRadius: "8px 8px 0 0",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#fff",
                  borderBottom: active ? "2px solid #fff" : "2px solid transparent",
                }}
              >
                <Icon size={16} /> {t.label}
                {t.id === "pacientes" && alertCount > 0 && (
                  <span
                    style={{
                      background: COLOR.clay,
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 700,
                      borderRadius: 999,
                      padding: "1px 6px",
                    }}
                  >
                    {alertCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding: 24 }}>
        {tab === "pacientes" && !selected && (
          <PacientesList
            patients={filtered}
            totalCount={patients.length}
            alertCount={alertCount}
            query={query}
            setQuery={setQuery}
            onOpen={setSelectedId}
            onAdd={() => setShowAddPatient(true)}
          />
        )}

        {tab === "pacientes" && selected && (
          <PatientDetail
            patient={selected}
            onBack={() => setSelectedId(null)}
            onUpdate={(patch) => updatePatient(selected.id, patch)}
            onAddSession={() => setSessionModalFor(selected.id)}
            onUpdateSession={(sid, patch) => updateSession(selected.id, sid, patch)}
            onDeleteSession={(sid) => deleteSession(selected.id, sid)}
            onDelete={() => setConfirmDelete(selected.id)}
            googleConnected={googleConnected}
          />
        )}

        {tab === "agenda" && (
          <AgendaView sessions={upcomingSessions} onOpenPatient={(id) => {
            setTab("pacientes");
            setSelectedId(id);
          }} />
        )}
      </div>

      {showAddPatient && (
        <AddPatientModal onClose={() => setShowAddPatient(false)} onSave={addPatient} />
      )}

      {sessionModalFor && (
        <AddSessionModal
          onClose={() => setSessionModalFor(null)}
          onSave={(sessionsList) => addSessions(sessionModalFor, sessionsList)}
        />
      )}

      {confirmDelete && (
        <Modal title="Remover paciente" onClose={() => setConfirmDelete(null)} width={380}>
          <p style={{ fontSize: 14, color: COLOR.inkLight, lineHeight: 1.5 }}>
            Isso apaga o prontuário e o histórico de sessões deste paciente. Essa ação não pode ser desfeita.
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
            <Btn variant="outline" onClick={() => setConfirmDelete(null)}>Cancelar</Btn>
            <Btn variant="danger" style={{ background: COLOR.clay, color: "#fff", border: "none" }} onClick={() => deletePatient(confirmDelete)}>
              Remover
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------- pacientes list ----------
function StatCard({ icon: Icon, label, value, tone = "default" }) {
  const tones = {
    default: { bg: COLOR.paperRaised, color: COLOR.ink, border: COLOR.border },
    cyan: { bg: COLOR.cyanBg, color: COLOR.cyanDark, border: COLOR.cyanBg },
    sage: { bg: COLOR.sageBg, color: COLOR.sageDark, border: COLOR.sageBg },
    alert: { bg: COLOR.clayBg, color: COLOR.clayDark, border: COLOR.clayBg },
  };
  const t = tones[tone];
  return (
    <div
      style={{
        flex: "1 1 140px",
        background: t.bg,
        border: `1px solid ${t.border}`,
        borderRadius: 12,
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <Icon size={20} style={{ color: t.color, flexShrink: 0 }} />
      <div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 22, fontWeight: 700, color: t.color, lineHeight: 1.1 }}>
          {value}
        </div>
        <div style={{ fontSize: 12, color: t.color, opacity: 0.85 }}>{label}</div>
      </div>
    </div>
  );
}

function PacientesList({ patients, totalCount, alertCount, query, setQuery, onOpen, onAdd }) {
  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <StatCard icon={Users} label="Pacientes ativos" value={totalCount} tone="cyan" />
        <StatCard icon={AlertTriangle} label="Planos acabando" value={alertCount} tone={alertCount > 0 ? "alert" : "default"} />
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={15} style={{ position: "absolute", left: 11, top: 11, color: COLOR.inkLight }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar paciente…"
            style={{ ...inputStyle, paddingLeft: 32 }}
          />
        </div>
        <Btn onClick={onAdd}>
          <Plus size={16} /> Novo paciente
        </Btn>
      </div>

      {patients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum paciente por aqui"
          body="Cadastre o primeiro paciente para começar a controlar prontuário e sessões."
          action={<Btn onClick={onAdd}><Plus size={16} /> Novo paciente</Btn>}
        />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 14 }}>
          {patients.map((p) => {
            const used = sessionsRealizadas(p);
            const rem = restantes(p);
            const alert = p.planTotal > 0 && rem <= 2;
            const nextSession = (p.sessions || [])
              .filter((s) => s.status === "agendada")
              .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")))[0];
            return (
              <button
                key={p.id}
                onClick={() => onOpen(p.id)}
                style={{
                  textAlign: "left",
                  background: COLOR.paperRaised,
                  border: `1px solid ${alert ? COLOR.clay : COLOR.border}`,
                  borderRadius: 12,
                  padding: 16,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <GoniometerArc value={used} max={p.planTotal} size={92} />
                <div style={{ textAlign: "center", width: "100%" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 2 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</span>
                    <span
                      title="Sessões já realizadas"
                      style={{
                        fontFamily: FONT_MONO,
                        fontSize: 11,
                        fontWeight: 700,
                        color: COLOR.sageDark,
                        background: COLOR.sageBg,
                        borderRadius: 999,
                        padding: "1px 7px",
                        flexShrink: 0,
                      }}
                    >
                      {used}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: COLOR.inkLight, marginBottom: 6, minHeight: 16 }}>
                    {p.diagnosis || "—"}
                  </div>
                  {alert && <Badge tone="alert"><AlertTriangle size={11} /> plano acabando</Badge>}
                  {!alert && nextSession && (
                    <Badge tone="default"><Clock size={11} /> {fmtDate(nextSession.date)}</Badge>
                  )}
                  {!alert && !nextSession && p.planTotal > 0 && rem === 0 && (
                    <Badge tone="neutral">plano concluído</Badge>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, title, body, action }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "56px 20px",
        background: COLOR.paperRaised,
        borderRadius: 12,
        border: `1px dashed ${COLOR.border}`,
      }}
    >
      <Icon size={30} style={{ color: COLOR.inkLight, marginBottom: 10 }} />
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: COLOR.inkLight, marginBottom: 18, maxWidth: 340, marginLeft: "auto", marginRight: "auto" }}>
        {body}
      </div>
      {action}
    </div>
  );
}

// ---------- patient detail ----------
function PatientDetail({ patient, onBack, onUpdate, onAddSession, onUpdateSession, onDeleteSession, onDelete, googleConnected }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(patient);
  const [showAtestado, setShowAtestado] = useState(false);

  useEffect(() => {
    setDraft(patient);
    setEditing(false);
    setShowAtestado(false);
  }, [patient.id]);

  const used = sessionsRealizadas(patient);
  const rem = restantes(patient);
  const alert = patient.planTotal > 0 && rem <= 2;
  const sortedSessions = [...(patient.sessions || [])].sort((a, b) =>
    (b.date + (b.time || "")).localeCompare(a.date + (a.time || ""))
  );

  if (showAtestado) {
    return <AtestadoView patient={patient} onBack={() => setShowAtestado(false)} />;
  }

  function save() {
    onUpdate({
      name: draft.name,
      phone: draft.phone,
      birthdate: draft.birthdate,
      diagnosis: draft.diagnosis,
      planTotal: Number(draft.planTotal) || 0,
      height: draft.height || "",
      weight: draft.weight || "",
      bodyFat: draft.bodyFat || "",
      muscleMass: draft.muscleMass || "",
    });
    setEditing(false);
  }

  const hasBodyData = patient.height || patient.weight || patient.bodyFat || patient.muscleMass;

  return (
    <div id="printable-patient">
      <button
        onClick={onBack}
        className="no-print"
        style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: COLOR.inkLight, fontSize: 13, marginBottom: 16, padding: 0 }}
      >
        <ChevronLeft size={16} /> Todos os pacientes
      </button>

      <div className="print-only" style={{ marginBottom: 14 }}>
        <img src="/logo.png" alt="RKFisioSport" style={{ height: 54, display: "block" }} />
      </div>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 24 }}>
        <div
          style={{
            background: COLOR.paperRaised,
            border: `1px solid ${COLOR.border}`,
            borderRadius: 12,
            padding: 20,
            flex: "1 1 280px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            {!editing ? (
              <div>
                <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 22, margin: "0 0 4px" }}>{patient.name}</h2>
                <div style={{ fontSize: 13, color: COLOR.inkLight, display: "flex", gap: 14, flexWrap: "wrap" }}>
                  {patient.phone && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Phone size={13} /> {patient.phone}</span>}
                  {patient.birthdate && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Cake size={13} /> {fmtDate(patient.birthdate)}</span>}
                </div>
                {hasBodyData && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                    {patient.height && <Badge tone="neutral">Altura {patient.height} cm</Badge>}
                    {patient.weight && <Badge tone="neutral">Peso {patient.weight} kg</Badge>}
                    {patient.bodyFat && <Badge tone="neutral">Gordura {patient.bodyFat}%</Badge>}
                    {patient.muscleMass && <Badge tone="neutral">Músculo {patient.muscleMass}%</Badge>}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ flex: 1, marginRight: 12 }}>
                <Field label="Nome">
                  <input style={inputStyle} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                </Field>
                <div style={{ display: "flex", gap: 10 }}>
                  <Field label="Telefone">
                    <input style={inputStyle} value={draft.phone || ""} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
                  </Field>
                  <Field label="Nascimento">
                    <input type="date" style={inputStyle} value={draft.birthdate || ""} onChange={(e) => setDraft({ ...draft, birthdate: e.target.value })} />
                  </Field>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: COLOR.inkLight, textTransform: "uppercase", letterSpacing: 0.4, margin: "10px 0 6px" }}>
                  Composição corporal
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Field label="Altura (cm)">
                    <input
                      type="number"
                      min={0}
                      max={250}
                      style={{ ...inputStyle, width: 84 }}
                      value={draft.height || ""}
                      onChange={(e) => setDraft({ ...draft, height: e.target.value })}
                    />
                  </Field>
                  <Field label="Peso (kg)">
                    <input
                      type="number"
                      min={0}
                      max={400}
                      step="0.1"
                      style={{ ...inputStyle, width: 84 }}
                      value={draft.weight || ""}
                      onChange={(e) => setDraft({ ...draft, weight: e.target.value })}
                    />
                  </Field>
                  <Field label="% gordura">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      style={{ ...inputStyle, width: 84 }}
                      value={draft.bodyFat || ""}
                      onChange={(e) => setDraft({ ...draft, bodyFat: e.target.value })}
                    />
                  </Field>
                  <Field label="% músculo">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      style={{ ...inputStyle, width: 84 }}
                      value={draft.muscleMass || ""}
                      onChange={(e) => setDraft({ ...draft, muscleMass: e.target.value })}
                    />
                  </Field>
                </div>
              </div>
            )}
            <div className="no-print" style={{ display: "flex", gap: 6 }}>
              <Btn variant="outline" onClick={() => window.print()}><Printer size={14} /> Imprimir</Btn>
              <Btn variant="outline" onClick={() => setShowAtestado(true)}><FileText size={14} /> Atestado</Btn>
              {!editing ? (
                <Btn variant="outline" onClick={() => setEditing(true)}>Editar</Btn>
              ) : (
                <Btn onClick={save}><Save size={14} /> Salvar</Btn>
              )}
              <Btn variant="danger" onClick={onDelete}><Trash2 size={14} /></Btn>
            </div>
          </div>

          <div style={{ marginTop: 16, borderTop: `1px solid ${COLOR.border}`, paddingTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: COLOR.inkLight, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
              <Stethoscope size={13} /> Prontuário / diagnóstico
            </div>
            {!editing ? (
              <p style={{ fontSize: 14, lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>
                {patient.diagnosis || "Nenhuma anotação ainda."}
              </p>
            ) : (
              <VoiceTextarea
                value={draft.diagnosis || ""}
                onChange={(v) => setDraft({ ...draft, diagnosis: v })}
                placeholder="Diagnóstico, histórico, observações clínicas gerais…"
                minHeight={90}
              />
            )}
          </div>

          {editing && (
            <div style={{ marginTop: 14 }}>
              <Field label="Total de sessões do plano (0 a 20)">
                <input
                  type="number"
                  min={0}
                  max={20}
                  style={{ ...inputStyle, width: 100 }}
                  value={draft.planTotal}
                  onChange={(e) => setDraft({ ...draft, planTotal: Math.max(0, Math.min(20, Number(e.target.value))) })}
                />
              </Field>
            </div>
          )}
        </div>

        <div
          style={{
            background: COLOR.paperRaised,
            border: `1px solid ${alert ? COLOR.clay : COLOR.border}`,
            borderRadius: 12,
            padding: 20,
            width: 190,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          {/* Contador de sessões individual deste paciente — lido direto de patient.sessions */}
          <GoniometerArc value={used} max={patient.planTotal} size={110} />
          {alert ? (
            <Badge tone="alert"><AlertTriangle size={11} /> restam {rem} sessões</Badge>
          ) : patient.planTotal > 0 && rem === 0 ? (
            <Badge tone="neutral">plano concluído</Badge>
          ) : (
            <Badge tone="default">plano em dia</Badge>
          )}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 17, margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
          <ClipboardList size={16} /> Sessões
        </h3>
        <span className="no-print"><Btn onClick={onAddSession}><Plus size={14} /> Registrar sessão</Btn></span>
      </div>

      {sortedSessions.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="Nenhuma sessão registrada"
          body="Registre a primeira sessão para começar a acompanhar a evolução clínica do paciente."
          action={<Btn onClick={onAddSession}><Plus size={14} /> Registrar sessão</Btn>}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sortedSessions.map((s) => (
            <SessionRow
              key={s.id}
              session={s}
              patient={patient}
              googleConnected={googleConnected}
              onToggleStatus={() =>
                onUpdateSession(s.id, { status: s.status === "realizada" ? "agendada" : "realizada" })
              }
              onNotesChange={(notes) => onUpdateSession(s.id, { notes })}
              onDelete={() => onDeleteSession(s.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function defaultAtestadoText(patient, dias, dataISO) {
  const diasTexto = Number(dias) === 1 ? "1 (um) dia" : `${dias} (${dias}) dias`;
  return `Atesto, para os devidos fins, que o(a) paciente ${patient.name} esteve sob acompanhamento fisioterapêutico nesta clínica, necessitando de afastamento de suas atividades habituais pelo período de ${diasTexto}, a contar de ${fmtDate(
    dataISO
  )}.`;
}

// Tela de emissão de atestado: painel de edição (não imprime) + prévia em
// formato de papel timbrado (é essa parte que vai para o papel). Reaproveita
// o mesmo id="printable-patient" da ficha do paciente, já que só uma das
// duas telas fica montada por vez.
function AtestadoView({ patient, onBack }) {
  const [data, setData] = useState(todayISO());
  const [dias, setDias] = useState(3);
  const [cid, setCid] = useState("");
  const [texto, setTexto] = useState(() => defaultAtestadoText(patient, 3, todayISO()));

  function regenerarTexto() {
    setTexto(defaultAtestadoText(patient, dias, data));
  }

  return (
    <div id="printable-patient">
      <button
        onClick={onBack}
        className="no-print"
        style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: COLOR.inkLight, fontSize: 13, marginBottom: 16, padding: 0 }}
      >
        <ChevronLeft size={16} /> Voltar ao prontuário
      </button>

      <div
        className="no-print"
        style={{
          background: COLOR.paperRaised,
          border: `1px solid ${COLOR.border}`,
          borderRadius: 12,
          padding: 20,
          marginBottom: 20,
        }}
      >
        <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 17, margin: "0 0 14px" }}>
          Emitir atestado — {patient.name}
        </h3>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Field label="Data do atestado">
            <input type="date" style={inputStyle} value={data} onChange={(e) => setData(e.target.value)} />
          </Field>
          <Field label="Dias de afastamento">
            <input
              type="number"
              min={0}
              max={365}
              style={{ ...inputStyle, width: 90 }}
              value={dias}
              onChange={(e) => setDias(Math.max(0, Number(e.target.value) || 0))}
            />
          </Field>
          <Field label="CID (opcional)">
            <input style={inputStyle} value={cid} onChange={(e) => setCid(e.target.value)} placeholder="Ex: M54.5" />
          </Field>
        </div>
        <Btn variant="outline" onClick={regenerarTexto} style={{ marginBottom: 14 }}>
          Gerar texto padrão com esses dados
        </Btn>
        <Field label="Texto do atestado">
          <VoiceTextarea value={texto} onChange={setTexto} minHeight={130} placeholder="Texto do atestado…" />
        </Field>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Btn onClick={() => window.print()}>
            <Printer size={14} /> Imprimir atestado
          </Btn>
        </div>
      </div>

      {/* Prévia — é exatamente isto que sai impresso, em papel timbrado */}
      <div
        style={{
          background: "#fff",
          border: `1px solid ${COLOR.border}`,
          borderRadius: 12,
          padding: "40px 44px",
          minHeight: 480,
        }}
      >
        <img src="/logo.png" alt="RKFisioSport" style={{ height: 60, display: "block", marginBottom: 26 }} />
        <div style={{ textAlign: "right", fontSize: 13, color: COLOR.inkLight, marginBottom: 30 }}>
          {fmtDateLong(data)}
        </div>
        <h2
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 20,
            textAlign: "center",
            margin: "0 0 30px",
            letterSpacing: 1.5,
            textTransform: "uppercase",
          }}
        >
          Atestado
        </h2>
        <p style={{ fontSize: 15, lineHeight: 1.9, whiteSpace: "pre-wrap", textAlign: "justify", margin: 0 }}>
          {texto}
        </p>
        {cid && <p style={{ fontSize: 13, color: COLOR.inkLight, marginTop: 14 }}>CID: {cid}</p>}
        <div style={{ marginTop: 90, textAlign: "center" }}>
          <div style={{ borderTop: `1px solid ${COLOR.ink}`, width: 260, margin: "0 auto 6px" }} />
          <div style={{ fontSize: 13, fontWeight: 600 }}>Dr. Reinaldo</div>
          <div style={{ fontSize: 12, color: COLOR.inkLight }}>Fisioterapeuta — RKFisioSport</div>
        </div>
      </div>
    </div>
  );
}

function SessionRow({ session, patient, googleConnected, onToggleStatus, onNotesChange, onDelete }) {
  const [notes, setNotes] = useState(session.notes || "");
  const done = session.status === "realizada";
  const synced = googleConnected && !!session.googleEventId;
  return (
    <div
      style={{
        background: COLOR.paperRaised,
        border: `1px solid ${COLOR.border}`,
        borderRadius: 10,
        padding: 14,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={onToggleStatus}
            title={done ? "Marcar como agendada" : "Marcar como realizada"}
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              border: `1.5px solid ${done ? COLOR.sage : COLOR.border}`,
              background: done ? COLOR.sage : "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#fff",
              flexShrink: 0,
            }}
          >
            {done && <Check size={14} />}
          </button>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>
              {fmtDateLong(session.date)} {session.time && `· ${session.time}`}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
              <Badge tone={done ? "default" : "neutral"}>{done ? "realizada" : "agendada"}</Badge>
              {synced && (
                <Badge tone="default">
                  <CalendarCheck size={11} /> no Google Agenda
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="no-print" style={{ display: "flex", gap: 6 }}>
          {!done && !synced && (
            <a href={googleCalendarLink(session, patient)} target="_blank" rel="noopener noreferrer">
              <Btn variant="outline" style={{ fontSize: 12, padding: "6px 10px" }}>
                <CalendarPlus size={13} /> Google Agenda
              </Btn>
            </a>
          )}
          <Btn variant="danger" style={{ padding: "6px 8px" }} onClick={onDelete}>
            <Trash2 size={13} />
          </Btn>
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <VoiceTextarea
          value={notes}
          onChange={setNotes}
          onBlur={() => onNotesChange(notes)}
          placeholder="Evolução clínica desta sessão…"
          minHeight={50}
        />
      </div>
    </div>
  );
}

// ---------- agenda ----------
function AgendaView({ sessions, onOpenPatient }) {
  const groups = useMemo(() => {
    const m = {};
    sessions.forEach((s) => {
      m[s.date] = m[s.date] || [];
      m[s.date].push(s);
    });
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b));
  }, [sessions]);

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={Calendar}
        title="Nenhuma sessão agendada"
        body="Sessões marcadas como “agendada” no prontuário de cada paciente aparecem aqui, em ordem."
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {groups.map(([date, list]) => (
        <div key={date}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 15, marginBottom: 8, color: COLOR.ink, textTransform: "capitalize" }}>
            {fmtDateLong(date)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {list
              .sort((a, b) => (a.time || "").localeCompare(b.time || ""))
              .map((s) => (
                <div
                  key={s.id}
                  style={{
                    background: COLOR.paperRaised,
                    border: `1px solid ${COLOR.border}`,
                    borderRadius: 10,
                    padding: "10px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <button
                    onClick={() => onOpenPatient(s.patient.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: COLOR.inkLight, minWidth: 44 }}>
                      {s.time || "--:--"}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: 14, color: COLOR.ink }}>{s.patient.name}</span>
                  </button>
                  {s.googleEventId ? (
                    <Badge tone="default"><CalendarCheck size={11} /> no Google Agenda</Badge>
                  ) : (
                    <a href={googleCalendarLink(s, s.patient)} target="_blank" rel="noopener noreferrer">
                      <Btn variant="outline" style={{ fontSize: 12, padding: "6px 10px" }}>
                        <CalendarPlus size={13} /> Google Agenda
                      </Btn>
                    </a>
                  )}
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- modals ----------
function AddPatientModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    birthdate: "",
    diagnosis: "",
    planTotal: 10,
    height: "",
    weight: "",
    bodyFat: "",
    muscleMass: "",
  });
  const [error, setError] = useState("");

  function submit() {
    if (!form.name.trim()) {
      setError("Informe o nome do paciente.");
      return;
    }
    onSave(form);
  }

  return (
    <Modal title="Novo paciente" onClose={onClose}>
      <Field label="Nome completo">
        <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Maria da Silva" />
      </Field>
      <div style={{ display: "flex", gap: 10 }}>
        <Field label="Telefone">
          <input style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(11) 99999-0000" />
        </Field>
        <Field label="Nascimento">
          <input type="date" style={inputStyle} value={form.birthdate} onChange={(e) => setForm({ ...form, birthdate: e.target.value })} />
        </Field>
      </div>
      <Field label="Diagnóstico / observações">
        <VoiceTextarea
          value={form.diagnosis}
          onChange={(v) => setForm({ ...form, diagnosis: v })}
          placeholder="Lombalgia crônica, pós-operatório de joelho…"
          minHeight={80}
        />
      </Field>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Field label="Altura (cm)">
          <input
            type="number"
            min={0}
            max={250}
            style={{ ...inputStyle, width: 90 }}
            value={form.height}
            onChange={(e) => setForm({ ...form, height: e.target.value })}
            placeholder="172"
          />
        </Field>
        <Field label="Peso (kg)">
          <input
            type="number"
            min={0}
            max={400}
            step="0.1"
            style={{ ...inputStyle, width: 90 }}
            value={form.weight}
            onChange={(e) => setForm({ ...form, weight: e.target.value })}
            placeholder="78"
          />
        </Field>
        <Field label="% de gordura">
          <input
            type="number"
            min={0}
            max={100}
            step="0.1"
            style={{ ...inputStyle, width: 90 }}
            value={form.bodyFat}
            onChange={(e) => setForm({ ...form, bodyFat: e.target.value })}
            placeholder="18"
          />
        </Field>
        <Field label="% de músculo">
          <input
            type="number"
            min={0}
            max={100}
            step="0.1"
            style={{ ...inputStyle, width: 90 }}
            value={form.muscleMass}
            onChange={(e) => setForm({ ...form, muscleMass: e.target.value })}
            placeholder="42"
          />
        </Field>
      </div>
      <Field label="Total de sessões do plano (0 a 20)">
        <input
          type="number"
          min={0}
          max={20}
          style={{ ...inputStyle, width: 100 }}
          value={form.planTotal}
          onChange={(e) => setForm({ ...form, planTotal: Math.max(0, Math.min(20, Number(e.target.value))) })}
        />
      </Field>
      {error && <p style={{ color: COLOR.clayDark, fontSize: 13, marginTop: -6 }}>{error}</p>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
        <Btn variant="outline" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={submit}>Salvar paciente</Btn>
      </div>
    </Modal>
  );
}

function AddSessionModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    date: todayISO(),
    time: "09:00",
    status: "agendada",
    notes: "",
    repeat: "none",
    repeatCount: 4,
  });
  const [error, setError] = useState("");

  function submit() {
    if (!form.date) {
      setError("Escolha uma data.");
      return;
    }
    const stepDays = form.repeat === "weekly" ? 7 : form.repeat === "biweekly" ? 14 : 0;
    const count = form.repeat === "none" ? 1 : Math.max(2, Math.min(24, Number(form.repeatCount) || 2));
    const base = new Date(form.date + "T00:00:00");

    const sessions = [];
    for (let i = 0; i < count; i++) {
      const d = new Date(base.getTime() + i * stepDays * 86400000);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;
      sessions.push({
        date: iso,
        time: form.time,
        // só a primeira ocorrência pode já vir marcada como "realizada";
        // as próximas são sempre futuras, então ficam "agendada"
        status: i === 0 ? form.status : "agendada",
        notes: i === 0 ? form.notes : "",
      });
    }
    onSave(sessions);
  }

  return (
    <Modal title="Registrar sessão" onClose={onClose}>
      <div style={{ display: "flex", gap: 10 }}>
        <Field label="Data">
          <input type="date" style={inputStyle} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </Field>
        <Field label="Horário">
          <input type="time" style={inputStyle} value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
        </Field>
      </div>
      <Field label="Status">
        <select style={inputStyle} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
          <option value="agendada">Agendada</option>
          <option value="realizada">Já realizada</option>
        </select>
      </Field>
      <Field label="Repetir">
        <select style={inputStyle} value={form.repeat} onChange={(e) => setForm({ ...form, repeat: e.target.value })}>
          <option value="none">Não repetir — só esta sessão</option>
          <option value="weekly">Semanalmente</option>
          <option value="biweekly">A cada 15 dias</option>
        </select>
      </Field>
      {form.repeat !== "none" && (
        <Field label="Quantas sessões no total (incluindo essa)">
          <input
            type="number"
            min={2}
            max={24}
            style={{ ...inputStyle, width: 100 }}
            value={form.repeatCount}
            onChange={(e) =>
              setForm({ ...form, repeatCount: Math.max(2, Math.min(24, Number(e.target.value) || 2)) })
            }
          />
        </Field>
      )}
      <Field label="Evolução clínica (opcional)">
        <VoiceTextarea
          value={form.notes}
          onChange={(v) => setForm({ ...form, notes: v })}
          placeholder="Como o paciente respondeu, exercícios feitos, dor referida…"
          minHeight={80}
        />
      </Field>
      {error && <p style={{ color: COLOR.clayDark, fontSize: 13, marginTop: -6 }}>{error}</p>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
        <Btn variant="outline" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={submit}>Salvar</Btn>
      </div>
    </Modal>
  );
}
