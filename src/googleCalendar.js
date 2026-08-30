// Integração com o Google Calendar usando Google Identity Services (GIS).
// Não precisa de servidor: o token de acesso é obtido direto no navegador
// (o usuário autoriza uma vez) e usado para criar, atualizar e apagar
// eventos via API REST do Google Calendar.

let tokenClient = null;
let currentToken = null; // { access_token, expires_at }
let connectedEmail = null;

function ensureGisLoaded() {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) {
      resolve();
      return;
    }
    const check = setInterval(() => {
      if (window.google && window.google.accounts && window.google.accounts.oauth2) {
        clearInterval(check);
        resolve();
      }
    }, 200);
    setTimeout(() => {
      clearInterval(check);
      reject(new Error("Google Identity Services não carregou a tempo."));
    }, 10000);
  });
}

export function isGoogleConnected() {
  return !!currentToken && Date.now() < currentToken.expires_at - 30000;
}

export function getConnectedEmail() {
  return isGoogleConnected() ? connectedEmail : null;
}

function allowedEmail() {
  return (import.meta.env.VITE_GOOGLE_ALLOWED_EMAIL || "").trim().toLowerCase();
}

async function fetchUserEmail(accessToken) {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.email || null;
  } catch (e) {
    return null;
  }
}

// Confere se a conta usada bate com VITE_GOOGLE_ALLOWED_EMAIL (se essa
// variável estiver configurada). Se não bater, revoga o acesso na hora e
// recusa a conexão — evita conectar com a conta errada por engano.
async function verifyAndStore(accessToken, expiresIn) {
  const email = await fetchUserEmail(accessToken);
  const required = allowedEmail();

  if (required && (!email || email.toLowerCase() !== required)) {
    try {
      window.google.accounts.oauth2.revoke(accessToken, () => {});
    } catch (e) {}
    currentToken = null;
    connectedEmail = null;
    const err = new Error("wrong-account");
    err.wrongAccount = true;
    err.email = email;
    err.required = required;
    throw err;
  }

  currentToken = { access_token: accessToken, expires_at: Date.now() + (expiresIn || 3500) * 1000 };
  connectedEmail = email;
  return accessToken;
}

// Pede autorização ao usuário (abre um popup do Google na primeira vez).
export async function connectGoogleCalendar() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error("Falta configurar VITE_GOOGLE_CLIENT_ID nas variáveis de ambiente.");
  }
  await ensureGisLoaded();

  return new Promise((resolve, reject) => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope:
        "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email",
      callback: async (response) => {
        if (response.error) {
          reject(response);
          return;
        }
        try {
          const token = await verifyAndStore(response.access_token, response.expires_in);
          resolve(token);
        } catch (e) {
          reject(e);
        }
      },
    });
    tokenClient.requestAccessToken({ prompt: "consent" });
  });
}

export function disconnectGoogleCalendar() {
  if (currentToken && window.google?.accounts?.oauth2) {
    try {
      window.google.accounts.oauth2.revoke(currentToken.access_token, () => {});
    } catch (e) {}
  }
  currentToken = null;
  connectedEmail = null;
}

// Tenta obter um token válido sem interromper o usuário com popup: usa o
// token atual se ainda for válido, ou tenta renovar silenciosamente. Se não
// conseguir (sessão do Google expirou de vez), retorna null.
async function ensureAccessToken() {
  if (isGoogleConnected()) return currentToken.access_token;
  if (!tokenClient) return null;
  return new Promise((resolve) => {
    const previousCallback = tokenClient.callback;
    tokenClient.callback = async (response) => {
      tokenClient.callback = previousCallback;
      if (response.error) {
        resolve(null);
        return;
      }
      try {
        const token = await verifyAndStore(response.access_token, response.expires_in);
        resolve(token);
      } catch (e) {
        resolve(null);
      }
    };
    try {
      tokenClient.requestAccessToken({ prompt: "" });
    } catch (e) {
      resolve(null);
    }
  });
}

function timeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo";
}

function eventPayload(session, patient) {
  const date = session.date;
  const time = session.time || "09:00";
  const startDate = new Date(`${date}T${time}:00`);
  const endDate = new Date(startDate.getTime() + 50 * 60000);
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}:00`;

  return {
    summary: `Fisioterapia — ${patient.name}`,
    description:
      `Sessão de fisioterapia com Dr. Reinaldo — RKFisioSport.` +
      (session.notes ? `\n\nObs: ${session.notes}` : ""),
    start: { dateTime: iso(startDate), timeZone: timeZone() },
    end: { dateTime: iso(endDate), timeZone: timeZone() },
  };
}

// Todas as funções abaixo NUNCA lançam exceção — se algo falhar (token
// expirado, sem internet, etc), retornam null/false silenciosamente, para
// que o resto do app (que salva no Supabase) nunca trave por causa do
// Google Calendar.

export async function createGoogleEvent(session, patient) {
  try {
    const token = await ensureAccessToken();
    if (!token) return null;
    const res = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(eventPayload(session, patient)),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.id || null;
  } catch (e) {
    return null;
  }
}

export async function updateGoogleEvent(eventId, session, patient) {
  try {
    const token = await ensureAccessToken();
    if (!token || !eventId) return false;
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(eventPayload(session, patient)),
      }
    );
    return res.ok;
  } catch (e) {
    return false;
  }
}

export async function deleteGoogleEvent(eventId) {
  try {
    const token = await ensureAccessToken();
    if (!token || !eventId) return false;
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
    );
    return res.ok || res.status === 410 || res.status === 404;
  } catch (e) {
    return false;
  }
}
