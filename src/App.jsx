import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  User, Plus, Search, Calendar, Activity, AlertTriangle, ChevronLeft,
  X, Check, Clock, FileText, Phone, Trash2, CalendarPlus, Users,
  Cake, Stethoscope, Save, Loader2, ClipboardList, Waves
} from "lucide-react";
import { supabase } from "./supabaseClient";

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

  // Sessões são sempre adicionadas dentro do array do paciente cujo id foi passado,
  // garantindo que o contador de cada paciente nunca se mistura com o de outro.
  function addSession(patientId, session) {
    persist(
      patients.map((p) =>
        p.id === patientId
          ? { ...p, sessions: [...(p.sessions || []), { id: uid(), ...session }] }
          : p
      )
    );
    setSessionModalFor(null);
  }

  function updateSession(patientId, sessionId, patch) {
    persist(
      patients.map((p) =>
        p.id === patientId
          ? {
              ...p,
              sessions: p.sessions.map((s) => (s.id === sessionId ? { ...s, ...patch } : s)),
            }
          : p
      )
    );
  }

  function deleteSession(patientId, sessionId) {
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
      {/* header */}
      <div
        style={{
          padding: "22px 24px 0",
          background: `linear-gradient(135deg, ${COLOR.cyanDark} 0%, ${COLOR.cyan} 55%, ${COLOR.sage} 130%)`,
          borderBottom: `1px solid ${COLOR.border}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "rgba(255,255,255,0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Waves size={20} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 24, margin: 0, letterSpacing: 0.2, color: "#fff" }}>
                RKFisioSport
              </h1>
              <p style={{ margin: "3px 0 0", fontSize: 13, color: "rgba(255,255,255,0.85)" }}>
                Consultório Dr. Reinaldo · prontuários e controle de sessões
              </p>
            </div>
          </div>
          {saveError && (
            <span style={{ fontSize: 12, color: "#fff", background: "rgba(0,0,0,0.2)", padding: "4px 8px", borderRadius: 6 }}>
              Não foi possível salvar agora. Tentando novamente…
            </span>
          )}
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
          onSave={(session) => addSession(sessionModalFor, session)}
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
function PatientDetail({ patient, onBack, onUpdate, onAddSession, onUpdateSession, onDeleteSession, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(patient);

  useEffect(() => {
    setDraft(patient);
    setEditing(false);
  }, [patient.id]);

  const used = sessionsRealizadas(patient);
  const rem = restantes(patient);
  const alert = patient.planTotal > 0 && rem <= 2;
  const sortedSessions = [...(patient.sessions || [])].sort((a, b) =>
    (b.date + (b.time || "")).localeCompare(a.date + (a.time || ""))
  );

  function save() {
    onUpdate({
      name: draft.name,
      phone: draft.phone,
      birthdate: draft.birthdate,
      diagnosis: draft.diagnosis,
      planTotal: Number(draft.planTotal) || 0,
    });
    setEditing(false);
  }

  return (
    <div>
      <button
        onClick={onBack}
        style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: COLOR.inkLight, fontSize: 13, marginBottom: 16, padding: 0 }}
      >
        <ChevronLeft size={16} /> Todos os pacientes
      </button>

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
              </div>
            )}
            <div style={{ display: "flex", gap: 6 }}>
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
              <textarea
                style={{ ...inputStyle, minHeight: 90, fontFamily: FONT_BODY, resize: "vertical" }}
                value={draft.diagnosis || ""}
                onChange={(e) => setDraft({ ...draft, diagnosis: e.target.value })}
                placeholder="Diagnóstico, histórico, observações clínicas gerais…"
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
        <Btn onClick={onAddSession}><Plus size={14} /> Registrar sessão</Btn>
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

function SessionRow({ session, patient, onToggleStatus, onNotesChange, onDelete }) {
  const [notes, setNotes] = useState(session.notes || "");
  const done = session.status === "realizada";
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
            <Badge tone={done ? "default" : "neutral"}>{done ? "realizada" : "agendada"}</Badge>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {!done && (
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
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => onNotesChange(notes)}
        placeholder="Evolução clínica desta sessão…"
        style={{ ...inputStyle, marginTop: 10, minHeight: 50, fontFamily: FONT_BODY, resize: "vertical" }}
      />
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
                  <a href={googleCalendarLink(s, s.patient)} target="_blank" rel="noopener noreferrer">
                    <Btn variant="outline" style={{ fontSize: 12, padding: "6px 10px" }}>
                      <CalendarPlus size={13} /> Google Agenda
                    </Btn>
                  </a>
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
  const [form, setForm] = useState({ name: "", phone: "", birthdate: "", diagnosis: "", planTotal: 10 });
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
        <textarea
          style={{ ...inputStyle, minHeight: 80, fontFamily: FONT_BODY, resize: "vertical" }}
          value={form.diagnosis}
          onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
          placeholder="Lombalgia crônica, pós-operatório de joelho…"
        />
      </Field>
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
  const [form, setForm] = useState({ date: todayISO(), time: "09:00", status: "agendada", notes: "" });
  const [error, setError] = useState("");

  function submit() {
    if (!form.date) {
      setError("Escolha uma data.");
      return;
    }
    onSave(form);
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
      <Field label="Evolução clínica (opcional)">
        <textarea
          style={{ ...inputStyle, minHeight: 80, fontFamily: FONT_BODY, resize: "vertical" }}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Como o paciente respondeu, exercícios feitos, dor referida…"
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
