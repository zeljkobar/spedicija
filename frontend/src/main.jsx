import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BarChart3,
  Building2,
  Container,
  Download,
  Pencil,
  FilePlus2,
  FileText,
  Plus,
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
  Search,
  Trash2,
  Users
} from "lucide-react";
import "./styles.css";

const API = import.meta.env.VITE_API_URL || "/api";
const TOKEN_KEY = "spedicija_token";
const REPORT_CONFIG = {
  container: {
    title: "Profit po kontejneru",
    path: "/reports/profit-by-container",
    filename: "profit-po-kontejneru.csv"
  },
  company: {
    title: "Profit po firmi",
    path: "/reports/profit-by-company",
    filename: "profit-po-firmi.csv"
  },
  period: {
    title: "Profit po periodu",
    path: "/reports/profit-by-period",
    filename: "profit-po-periodu.csv"
  }
};

function authHeaders() {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(options.headers || {}) },
    ...options
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Greska u komunikaciji sa API-jem" }));
    if (response.status === 401) localStorage.removeItem(TOKEN_KEY);
    throw new Error(error.message || "Greska u komunikaciji sa API-jem");
  }

  if (response.status === 204) return null;
  return response.json();
}

function money(value) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}

function invoiceAmount(invoice) {
  const withoutVat = Number(invoice.amountWithoutVat || 0);
  return withoutVat > 0 ? withoutVat : Number(invoice.amountWithVat || 0);
}

function dateValue(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("sr-Latn-ME").format(new Date(value));
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Empty({ text }) {
  return <div className="empty">{text}</div>;
}

function organizationLabel(user) {
  if (user?.organization?.name) return user.organization.name;
  if (user?.role === "SUPER_ADMIN") return "Sve spedicije";
  return "Spedicija";
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [user, setUser] = useState(null);
  const [active, setActive] = useState("dashboard");
  const [companies, setCompanies] = useState([]);
  const [positions, setPositions] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [reports, setReports] = useState([]);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPasswordPanel, setShowPasswordPanel] = useState(false);

  async function loadAll() {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    setLoading(true);
    setMessage("");
    try {
      const [companiesRes, positionsRes, dashboardRes, reportRes] = await Promise.all([
        request("/companies"),
        request("/positions"),
        request("/reports/dashboard"),
        request("/reports/profit-by-container")
      ]);
      setCompanies(companiesRes.data);
      setPositions(positionsRes.data);
      setDashboard(dashboardRes.data);
      setReports(reportRes.data);
      if ((user?.role || localStorage.getItem("spedicija_role")) === "SUPER_ADMIN") {
        const organizationsRes = await request("/admin/organizations");
        setOrganizations(organizationsRes.data);
      }
      setSelectedPosition((current) => {
        if (!current) return null;
        return positionsRes.data.find((position) => position.id === current.id) || null;
      });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    loadAll();
    request("/auth/me")
      .then((result) => {
        localStorage.setItem("spedicija_role", result.data.role);
        setUser(result.data);
        if (result.data.role === "SUPER_ADMIN") {
          request("/admin/organizations").then((organizationsRes) => setOrganizations(organizationsRes.data));
        }
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken("");
        setUser(null);
      });
  }, [token]);

  async function handleLogin(credentials) {
    const result = await request("/auth/login", { method: "POST", body: JSON.stringify(credentials) });
    localStorage.setItem(TOKEN_KEY, result.data.token);
    localStorage.setItem("spedicija_role", result.data.user.role);
    setUser(result.data.user);
    setToken(result.data.token);
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("spedicija_role");
    setToken("");
    setUser(null);
    setCompanies([]);
    setPositions([]);
    setDashboard(null);
    setReports([]);
    setOrganizations([]);
    setSelectedPosition(null);
  }

  if (!token) return <LoginScreen onLogin={handleLogin} />;

  const nav = [
    ["dashboard", "Dashboard", BarChart3],
    ["companies", "Firme", Building2],
    ["positions", "Pozicije", Container],
    ["entry", "Novi unos", FilePlus2],
    ["reports", "Izvjestaji", FileText],
    ...(user?.role === "ADMIN" ? [["team", "Radnici", Users]] : []),
    ...(user?.role === "SUPER_ADMIN" ? [["admin", "Admin", Building2]] : [])
  ];

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <Container size={26} />
          <div>
            <strong>Spedicija</strong>
            <span>{organizationLabel(user)}</span>
          </div>
        </div>
        <nav>
          {nav.map(([id, label, Icon]) => (
            <button className={active === id ? "active" : ""} key={id} onClick={() => setActive(id)}>
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <h1>{nav.find(([id]) => id === active)?.[1]}</h1>
            <p>{organizationLabel(user)} · pregled pozicija, faktura i profita.</p>
          </div>
          <div className="topbar-actions">
            {user ? <span className="user-chip">{user.name}</span> : null}
            <button className="icon-button" onClick={loadAll} title="Osvjezi podatke">
              <RefreshCw size={18} />
              {loading ? "Ucitavanje" : "Osvjezi"}
            </button>
            <button className="secondary" onClick={() => setShowPasswordPanel((current) => !current)}>Lozinka</button>
            <button className="secondary" onClick={logout}>Odjava</button>
          </div>
        </header>

        {message ? <div className="alert">{message}</div> : null}
        {showPasswordPanel ? <ChangePasswordPanel onDone={() => setShowPasswordPanel(false)} /> : null}

        {active === "dashboard" && <Dashboard dashboard={dashboard} positions={positions} />}
        {active === "companies" && <Companies companies={companies} organizations={organizations} user={user} onSaved={loadAll} />}
        {active === "positions" && (
          <Positions
            positions={positions}
            companies={companies}
            selectedPosition={selectedPosition}
            setSelectedPosition={setSelectedPosition}
            onSaved={loadAll}
          />
        )}
        {active === "entry" && <NewEntryWizard companies={companies} positions={positions} organizations={organizations} user={user} onDone={loadAll} />}
        {active === "reports" && <Reports rows={reports} positions={positions} companies={companies} organizations={organizations} user={user} onSaved={loadAll} />}
        {active === "team" && user?.role === "ADMIN" && <TeamPanel user={user} />}
        {active === "admin" && user?.role === "SUPER_ADMIN" && (
          <AdminPanel organizations={organizations} onSaved={loadAll} />
        )}
      </main>
    </div>
  );
}

function ChangePasswordPanel({ onDone }) {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    setMessage("");
    setError("");

    if (form.newPassword !== form.confirmPassword) {
      setError("Nova lozinka i potvrda se ne poklapaju.");
      return;
    }

    setSaving(true);
    try {
      await request("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword
        })
      });
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setMessage("Lozinka je promijenjena.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel password-panel">
      <div className="panel-heading">
        <h2>Promjena lozinke</h2>
        <button className="small-action" onClick={onDone}>Zatvori</button>
      </div>
      {message ? <div className="success inline-alert">{message}</div> : null}
      {error ? <div className="alert inline-alert">{error}</div> : null}
      <form className="form" onSubmit={save}>
        <label>
          Trenutna lozinka
          <input type="password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} required />
        </label>
        <label>
          Nova lozinka
          <input type="password" minLength={6} value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} required />
        </label>
        <label>
          Potvrdi novu lozinku
          <input type="password" minLength={6} value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} required />
        </label>
        <button className="primary" disabled={saving}>{saving ? "Snimanje..." : "Promijeni lozinku"}</button>
      </form>
    </section>
  );
}

function LoginScreen({ onLogin }) {
  const [form, setForm] = useState({ email: "admin@spedicija.local", password: "admin12345" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      await onLogin(form);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="brand login-brand">
          <Container size={30} />
          <div>
            <strong>Spedicija</strong>
            <span>Prijava u sistem</span>
          </div>
        </div>
        {error ? <div className="alert">{error}</div> : null}
        <form className="form" onSubmit={submit}>
          <label>
            Email
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </label>
          <label>
            Lozinka
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </label>
          <button className="primary" disabled={loading}>{loading ? "Prijava..." : "Prijavi se"}</button>
        </form>
      </section>
    </main>
  );
}

function Dashboard({ dashboard, positions }) {
  if (!dashboard) return <Empty text="Nema podataka za prikaz." />;
  return (
    <>
      <section className="stats-grid">
        <Stat label="Otvorene pozicije" value={dashboard.openPositions} />
        <Stat label="Zatvorene pozicije" value={dashboard.closedPositions} />
        <Stat label="Ukupni prihodi" value={money(dashboard.totalRevenue)} />
        <Stat label="Ukupni troskovi" value={money(dashboard.totalCosts)} />
        <Stat label="Profit" value={money(dashboard.profit)} />
        <Stat label="Pozicije u gubitku" value={dashboard.loss} />
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Posljednje pozicije</h2>
        </div>
        <PositionTable rows={positions.slice(0, 8)} />
      </section>
    </>
  );
}

function Companies({ companies, organizations, user, onSaved }) {
  const [form, setForm] = useState({
    organizationId: organizations[0]?.id || "",
    name: "",
    pib: "",
    companyType: "KLIJENT",
    email: "",
    phone: ""
  });
  const [error, setError] = useState("");

  async function save(event) {
    event.preventDefault();
    setError("");
    try {
      await request("/companies", { method: "POST", body: JSON.stringify(form) });
      setForm({ organizationId: organizations[0]?.id || "", name: "", pib: "", companyType: "KLIJENT", email: "", phone: "" });
      await onSaved();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="split">
      <section className="panel">
        <div className="panel-heading">
          <h2>Nova firma</h2>
        </div>
        {error ? <div className="alert">{error}</div> : null}
        <form className="form" onSubmit={save}>
          <label>
            Naziv firme
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          {user?.role === "SUPER_ADMIN" ? (
            <label>
              Spedicija
              <select value={form.organizationId} onChange={(e) => setForm({ ...form, organizationId: e.target.value })} required>
                <option value="">Izaberi spediciju</option>
                {organizations.map((organization) => (
                  <option value={organization.id} key={organization.id}>{organization.name}</option>
                ))}
              </select>
            </label>
          ) : null}
          <label>
            PIB
            <input value={form.pib} onChange={(e) => setForm({ ...form, pib: e.target.value })} />
          </label>
          <label>
            Tip firme
            <select value={form.companyType} onChange={(e) => setForm({ ...form, companyType: e.target.value })}>
              {["KLIJENT", "DOBAVLJAC", "BRODAR", "PREVOZNIK", "LUKA", "AGENT", "OSTALO"].map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <label>
            Email
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label>
            Telefon
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
          <button className="primary">
            <Plus size={18} />
            Snimi firmu
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Firme</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>Naziv</th>
              <th>PIB</th>
              <th>Tip</th>
              <th>Kontakt</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((company) => (
              <tr key={company.id}>
                <td>{company.name}</td>
                <td>{company.pib}</td>
                <td>{company.companyType}</td>
                <td>{company.email || company.phone}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Positions({ positions, companies, selectedPosition, setSelectedPosition, onSaved }) {
  const activePositions = positions.filter((position) => position.status !== "ZATVORENA");

  if (selectedPosition) {
    return (
      <div className="stack">
        <button className="secondary back-button" onClick={() => setSelectedPosition(null)}>
          <ArrowLeft size={18} />
          Nazad na spisak kontejnera
        </button>
        <PositionDetails
          position={selectedPosition}
          companies={companies}
          onSaved={onSaved}
          onClosed={() => setSelectedPosition(null)}
        />
      </div>
    );
  }

  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Spisak kontejnera</h2>
            <p>Klikni na red za prikaz detalja, ulaznih i izlaznih racuna.</p>
          </div>
        </div>
        <PositionTable rows={activePositions} onSelect={setSelectedPosition} />
      </section>
    </div>
  );
}

function PositionTable({ rows, onSelect }) {
  if (!rows.length) return <Empty text="Nema unesenih pozicija." />;
  return (
    <table>
      <thead>
        <tr>
          <th>Kontejner</th>
          <th>Firma</th>
          <th>Status</th>
          <th>Prihodi</th>
          <th>Troskovi</th>
          <th>Profit</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} onClick={() => onSelect?.(row)}>
            <td><strong>{row.containerNumber}</strong></td>
            <td>{row.company?.name || ""}</td>
            <td><span className="badge">{row.status}</span></td>
            <td>{money(row.financial?.totalRevenue)}</td>
            <td>{money(row.financial?.totalCosts)}</td>
            <td className={Number(row.financial?.profit) < 0 ? "negative" : "positive"}>
              {money(row.financial?.profit)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PositionDetails({ position, companies, onSaved, onClosed }) {
  if (!position) return <section className="panel"><Empty text="Izaberi poziciju za detalje." /></section>;
  const incoming = position.invoices?.filter((invoice) => invoice.invoiceType === "ULAZNA") || [];
  const outgoing = position.invoices?.filter((invoice) => invoice.invoiceType === "IZLAZNA") || [];
  const costs = position.additionalCosts || [];
  const isClosed = position.status === "ZATVORENA";

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Detalji pozicije: {position.containerNumber}</h2>
          <p>{position.company?.name || "Bez firme"} · {position.status}</p>
        </div>
        {!isClosed ? <ClosePositionButton position={position} onSaved={onSaved} onClosed={onClosed} /> : null}
      </div>

      <div className="mini-stats">
        <Stat label="Prihodi" value={money(position.financial?.totalRevenue)} />
        <Stat label="Troskovi" value={money(position.financial?.totalCosts)} />
        <Stat label="Profit" value={money(position.financial?.profit)} />
      </div>

      <div className="invoice-sections">
        <InvoiceTable title="Ulazni racuni" rows={incoming} tone="cost" companies={companies} onSaved={onSaved} />
        <InvoiceTable title="Izlazni racuni" rows={outgoing} tone="revenue" companies={companies} onSaved={onSaved} />
        <AdditionalCosts position={position} rows={costs} onSaved={onSaved} isClosed={isClosed} />
      </div>
      {!isClosed ? <QuickInvoice position={position} companies={companies} onSaved={onSaved} /> : null}
    </section>
  );
}

function AdditionalCosts({ position, rows, onSaved, isClosed }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="invoice-box cost">
      <div className="invoice-box-heading">
        <h3>Dodatni troskovi</h3>
        <span>{rows.length}</span>
      </div>
      {!rows.length ? (
        <div className="empty compact">Nema dodatnih troskova za ovu poziciju.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Opis</th>
              <th>Datum</th>
              <th>Iznos</th>
              <th>Valuta</th>
              <th>Napomena</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((cost) => (
              <tr key={cost.id}>
                <td><strong>{cost.description}</strong></td>
                <td>{dateValue(cost.costDate)}</td>
                <td>{money(cost.amount)}</td>
                <td>{cost.currency}</td>
                <td>{cost.note || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!isClosed ? (
        open ? (
          <AdditionalCostForm
            position={position}
            onCancel={() => setOpen(false)}
            onSaved={async () => {
              setOpen(false);
              await onSaved();
            }}
          />
        ) : (
          <div className="box-action">
            <button className="secondary" onClick={() => setOpen(true)}>
              <Plus size={18} />
              Dodaj trosak
            </button>
          </div>
        )
      ) : null}
    </section>
  );
}

function AdditionalCostForm({ position, onCancel, onSaved }) {
  const [form, setForm] = useState({
    positionId: position.id,
    description: "",
    costDate: new Date().toISOString().slice(0, 10),
    amount: "",
    currency: "EUR",
    note: ""
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await request("/costs", { method: "POST", body: JSON.stringify(form) });
      await onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <form className="edit-form" onSubmit={save}>
      <div className="edit-form-heading">
        <strong>Novi dodatni trosak</strong>
        <button type="button" className="small-action" onClick={onCancel}>Zatvori</button>
      </div>
      {error ? <div className="alert inline-alert">{error}</div> : null}
      <div className="edit-grid">
        <label>
          Opis
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
        </label>
        <label>
          Datum
          <input type="date" value={form.costDate} onChange={(e) => setForm({ ...form, costDate: e.target.value })} required />
        </label>
        <label>
          Iznos
          <input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
        </label>
        <label>
          Valuta
          <input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
        </label>
      </div>
      <label>
        Napomena
        <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
      </label>
      <div className="form-actions">
        <button type="button" className="secondary" onClick={onCancel}>Odustani</button>
        <button className="primary" disabled={saving}>{saving ? "Snimanje..." : "Snimi trosak"}</button>
      </div>
    </form>
  );
}

function ClosePositionButton({ position, onSaved, onClosed }) {
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState("");

  async function closePosition() {
    const confirmed = window.confirm(`Zatvoriti poziciju ${position.containerNumber}?`);
    if (!confirmed || closing) return;

    setClosing(true);
    setError("");
    try {
      await request(`/positions/${position.id}/close`, { method: "POST" });
      await onSaved();
      onClosed?.();
    } catch (err) {
      setError(err.message);
      setClosing(false);
    }
  }

  return (
    <div className="close-position">
      {error ? <span>{error}</span> : null}
      <button className="primary close-button" onClick={closePosition} disabled={closing}>
        <CheckCircle2 size={18} />
        {closing ? "Zatvaranje..." : "Zatvori poziciju"}
      </button>
    </div>
  );
}

function InvoiceTable({ title, rows, tone, companies, onSaved }) {
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");

  async function removeInvoice(invoice) {
    const confirmed = window.confirm(`Obrisati fakturu ${invoice.invoiceNumber}?`);
    if (!confirmed) return;

    setError("");
    try {
      await request(`/invoices/${invoice.id}`, { method: "DELETE" });
      await onSaved();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className={`invoice-box ${tone}`}>
      <div className="invoice-box-heading">
        <h3>{title}</h3>
        <span>{rows.length}</span>
      </div>
      {error ? <div className="alert inline-alert">{error}</div> : null}
      {!rows.length ? (
        <div className="empty compact">Nema racuna za ovu grupu.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Broj</th>
              <th>Firma</th>
              <th>Datum</th>
              <th>Bez PDV</th>
              <th>PDV</th>
              <th>Sa PDV</th>
              <th>Za obracun</th>
              <th>Status</th>
              <th>Akcije</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((invoice) => (
              <tr key={invoice.id}>
                <td><strong>{invoice.invoiceNumber}</strong></td>
                <td>{invoice.company?.name}</td>
                <td>{dateValue(invoice.invoiceDate)}</td>
                <td>{money(invoice.amountWithoutVat)}</td>
                <td>{money(invoice.vatAmount)}</td>
                <td>{money(invoice.amountWithVat)}</td>
                <td>{money(invoiceAmount(invoice))}</td>
                <td><span className="badge">{invoice.paymentStatus}</span></td>
                <td>
                  <div className="row-actions">
                    <button className="small-action" onClick={() => setEditing(invoice)} title="Izmijeni fakturu">
                      <Pencil size={15} />
                      Edit
                    </button>
                    <button className="small-action danger" onClick={() => removeInvoice(invoice)} title="Obrisi fakturu">
                      <Trash2 size={15} />
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editing ? (
        <EditInvoiceForm
          invoice={editing}
          companies={companies}
          onCancel={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await onSaved();
          }}
        />
      ) : null}
    </section>
  );
}

function isoDate(value) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function EditInvoiceForm({ invoice, companies, onCancel, onSaved }) {
  const [form, setForm] = useState({
    companyId: invoice.companyId || "",
    invoiceType: invoice.invoiceType,
    invoiceNumber: invoice.invoiceNumber || "",
    invoiceDate: isoDate(invoice.invoiceDate),
    dueDate: isoDate(invoice.dueDate),
    amountWithoutVat: invoice.amountWithoutVat || "",
    vatAmount: invoice.vatAmount || "",
    amountWithVat: invoice.amountWithVat || "",
    paymentStatus: invoice.paymentStatus || "NEPLACENO",
    note: invoice.note || ""
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");

    try {
      await request(`/invoices/${invoice.id}`, { method: "PUT", body: JSON.stringify(form) });
      await onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <form className="edit-form" onSubmit={save}>
      <div className="edit-form-heading">
        <strong>Izmjena fakture {invoice.invoiceNumber}</strong>
        <button type="button" className="small-action" onClick={onCancel}>Zatvori</button>
      </div>
      {error ? <div className="alert inline-alert">{error}</div> : null}
      <div className="edit-grid">
        <label>
          Tip
          <select value={form.invoiceType} onChange={(e) => setForm({ ...form, invoiceType: e.target.value })}>
            <option value="ULAZNA">ULAZNA</option>
            <option value="IZLAZNA">IZLAZNA</option>
          </select>
        </label>
        <label>
          Firma
          <select value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })} required>
            <option value="">Izaberi firmu</option>
            {companies.map((company) => (
              <option value={company.id} key={company.id}>{company.name}</option>
            ))}
          </select>
        </label>
        <label>
          Broj
          <input value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} required />
        </label>
        <label>
          Datum
          <input type="date" value={form.invoiceDate} onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })} required />
        </label>
        <label>
          Bez PDV
          <input type="number" step="0.01" value={form.amountWithoutVat} onChange={(e) => setForm({ ...form, amountWithoutVat: e.target.value })} />
        </label>
        <label>
          PDV
          <input type="number" step="0.01" value={form.vatAmount} onChange={(e) => setForm({ ...form, vatAmount: e.target.value })} />
        </label>
        <label>
          Sa PDV
          <input type="number" step="0.01" value={form.amountWithVat} onChange={(e) => setForm({ ...form, amountWithVat: e.target.value })} />
        </label>
        <label>
          Status
          <select value={form.paymentStatus} onChange={(e) => setForm({ ...form, paymentStatus: e.target.value })}>
            <option value="NEPLACENO">NEPLACENO</option>
            <option value="DJELIMICNO_PLACENO">DJELIMICNO_PLACENO</option>
            <option value="PLACENO">PLACENO</option>
            <option value="STORNIRANO">STORNIRANO</option>
          </select>
        </label>
      </div>
      <div className="form-actions">
        <button type="button" className="secondary" onClick={onCancel}>Odustani</button>
        <button className="primary" disabled={saving}>{saving ? "Snimanje..." : "Snimi izmjene"}</button>
      </div>
    </form>
  );
}

function QuickInvoice({ position, companies, onSaved }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button className="secondary full" onClick={() => setOpen(true)}>
        <Plus size={18} />
        Dodaj fakturu
      </button>
    );
  }
  return (
    <InvoiceStep
      position={position}
      companies={companies}
      onDone={async () => {
        await onSaved();
        setOpen(false);
      }}
    />
  );
}

function NewEntryWizard({ companies, positions, organizations, user, onDone }) {
  const [mode, setMode] = useState("");
  const [position, setPosition] = useState(null);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const openPositions = useMemo(() => positions.filter((position) => position.status !== "ZATVORENA"), [positions]);
  const filtered = useMemo(() => {
    const needle = search.trim().toUpperCase();
    if (!needle) return openPositions;
    return openPositions.filter((item) =>
      [item.containerNumber, item.company?.name, item.status].some((value) =>
        String(value || "").toUpperCase().includes(needle)
      )
    );
  }, [openPositions, search]);

  if (!mode) {
    return (
      <>
        {notice ? <div className="success">{notice}</div> : null}
        <section className="choice-grid">
          <button className="choice" onClick={() => { setNotice(""); setMode("new"); }}>
            <Plus size={28} />
            <strong>Nova pozicija / novi kontejner</strong>
            <span>Prvo otvaras poziciju, zatim unosis fakturu.</span>
          </button>
          <button className="choice" onClick={() => { setNotice(""); setMode("existing"); }}>
            <Search size={28} />
            <strong>Postojeca pozicija</strong>
            <span>Pronadji kontejner i dodaj novu fakturu.</span>
          </button>
        </section>
      </>
    );
  }

  if (mode === "new" && !position) {
    return <NewPositionStep companies={companies} organizations={organizations} user={user} onCreated={setPosition} />;
  }

  if (mode === "existing" && !position) {
    return (
      <section className="panel">
        <div className="panel-heading">
          <h2>Izbor postojece pozicije</h2>
        </div>
        <label className="search">
          <Search size={18} />
          <input placeholder="Pretrazi broj kontejnera, firmu ili status" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <PositionTable rows={filtered} onSelect={setPosition} />
      </section>
    );
  }

  return (
    <InvoiceStep
      position={position}
      companies={companies}
      onDone={async () => {
        await onDone();
        setMode("");
        setPosition(null);
        setSearch("");
        setNotice("Faktura je snimljena. Mozes poceti novi unos.");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
    />
  );
}

function NewPositionStep({ companies, organizations, user, onCreated }) {
  const [form, setForm] = useState({
    organizationId: organizations[0]?.id || "",
    containerNumber: "",
    companyId: "",
    openingDate: new Date().toISOString().slice(0, 10),
    note: ""
  });
  const [error, setError] = useState("");

  async function save(event) {
    event.preventDefault();
    setError("");
    try {
      const result = await request("/positions", { method: "POST", body: JSON.stringify(form) });
      onCreated({ ...result.data, company: companies.find((company) => company.id === Number(form.companyId)), invoices: [], financial: {} });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="panel narrow">
      <div className="panel-heading">
        <h2>Nova pozicija</h2>
      </div>
      {error ? <div className="alert">{error}</div> : null}
      <form className="form" onSubmit={save}>
        <label>
          Broj kontejnera
          <input value={form.containerNumber} onChange={(e) => setForm({ ...form, containerNumber: e.target.value })} required />
        </label>
        {user?.role === "SUPER_ADMIN" ? (
          <label>
            Spedicija
            <select value={form.organizationId} onChange={(e) => setForm({ ...form, organizationId: e.target.value, companyId: "" })} required>
              <option value="">Izaberi spediciju</option>
              {organizations.map((organization) => (
                <option value={organization.id} key={organization.id}>{organization.name}</option>
              ))}
            </select>
          </label>
        ) : null}
        <label>
          Firma / klijent
          <select value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}>
            <option value="">Bez firme</option>
            {companies
              .filter((company) => !form.organizationId || company.organizationId === Number(form.organizationId))
              .map((company) => (
              <option value={company.id} key={company.id}>{company.name}</option>
            ))}
          </select>
        </label>
        <label>
          Datum otvaranja
          <input type="date" value={form.openingDate} onChange={(e) => setForm({ ...form, openingDate: e.target.value })} />
        </label>
        <label>
          Napomena
          <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </label>
        <button className="primary">Nastavi na fakturu</button>
      </form>
    </section>
  );
}

function InvoiceStep({ position, companies, onDone }) {
  const defaultCompany = position.companyId || position.company?.id || "";
  const [form, setForm] = useState({
    positionId: position.id,
    companyId: defaultCompany,
    invoiceType: "IZLAZNA",
    invoiceNumber: "",
    invoiceDate: new Date().toISOString().slice(0, 10),
    amountWithoutVat: "",
    vatAmount: "",
    amountWithVat: "",
    currency: "EUR",
    paymentStatus: "NEPLACENO"
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    setError("");
    setSaving(true);
    try {
      await request("/invoices", { method: "POST", body: JSON.stringify(form) });
      await onDone();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <section className="panel narrow">
      <div className="context">
        <span>Pozicija</span>
        <strong>{position.containerNumber}</strong>
        <span>{position.company?.name || "Bez firme"} · {position.status || "OTVORENA"}</span>
      </div>
      {error ? <div className="alert">{error}</div> : null}
      <form className="form" onSubmit={save}>
        <label>
          Tip fakture
          <select value={form.invoiceType} onChange={(e) => setForm({ ...form, invoiceType: e.target.value })}>
            <option value="ULAZNA">ULAZNA</option>
            <option value="IZLAZNA">IZLAZNA</option>
          </select>
        </label>
        <label>
          Firma
          <select value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })} required>
            <option value="">Izaberi firmu</option>
            {companies.map((company) => (
              <option value={company.id} key={company.id}>{company.name}</option>
            ))}
          </select>
        </label>
        <label>
          Broj fakture
          <input value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} required />
        </label>
        <label>
          Datum fakture
          <input type="date" value={form.invoiceDate} onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })} required />
        </label>
        <label>
          Iznos bez PDV-a
          <input type="number" step="0.01" value={form.amountWithoutVat} onChange={(e) => setForm({ ...form, amountWithoutVat: e.target.value })} />
        </label>
        <label>
          PDV
          <input type="number" step="0.01" value={form.vatAmount} onChange={(e) => setForm({ ...form, vatAmount: e.target.value })} />
        </label>
        <label>
          Iznos sa PDV-om
          <input type="number" step="0.01" value={form.amountWithVat} onChange={(e) => setForm({ ...form, amountWithVat: e.target.value })} />
        </label>
        <button className="primary" disabled={saving}>
          {saving ? "Snimanje..." : "Snimi fakturu"}
        </button>
      </form>
    </section>
  );
}

function Reports({ rows: initialRows, positions, companies, organizations, user, onSaved }) {
  const [type, setType] = useState("container");
  const [status, setStatus] = useState("SVE");
  const [organizationId, setOrganizationId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [rows, setRows] = useState(initialRows);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const params = useMemo(() => {
    const next = new URLSearchParams();
    if (status !== "SVE") next.set("status", status);
    if (organizationId) next.set("organizationId", organizationId);
    if (companyId) next.set("companyId", companyId);
    if (dateFrom) next.set("dateFrom", dateFrom);
    if (dateTo) next.set("dateTo", dateTo);
    return next;
  }, [status, organizationId, companyId, dateFrom, dateTo]);

  useEffect(() => {
    let activeRequest = true;
    setLoading(true);
    setError("");
    request(`${REPORT_CONFIG[type].path}?${params.toString()}`)
      .then((result) => {
        if (activeRequest) setRows(result.data);
      })
      .catch((err) => {
        if (activeRequest) setError(err.message);
      })
      .finally(() => {
        if (activeRequest) setLoading(false);
      });
    return () => {
      activeRequest = false;
    };
  }, [type, params, positions]);

  async function exportCsv() {
    const csvParams = new URLSearchParams(params);
    csvParams.set("format", "csv");
    const response = await fetch(`${API}${REPORT_CONFIG[type].path}?${csvParams.toString()}`, {
      headers: authHeaders()
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({ message: "CSV export nije uspio." }));
      setError(result.message || "CSV export nije uspio.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = REPORT_CONFIG[type].filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  if (selected) {
    const position = positions.find((item) => item.id === selected.positionId);
    return (
      <div className="stack">
        <button className="secondary back-button" onClick={() => setSelected(null)}>
          <ArrowLeft size={18} />
          Nazad na izvjestaj
        </button>
        {position ? (
          <PositionDetails position={position} companies={companies} onSaved={onSaved} />
        ) : (
          <section className="panel">
            <Empty text="Detalji za ovu poziciju nijesu trenutno ucitani. Klikni Osvjezi pa pokusaj ponovo." />
          </section>
        )}
      </div>
    );
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>{REPORT_CONFIG[type].title}</h2>
          <p>{type === "container" ? "Klikni na red za detalje ulaznih i izlaznih racuna." : "Pregled zbirnih prihoda, troskova i profita."}</p>
        </div>
        <div className="report-actions">
          <select value={type} onChange={(event) => { setType(event.target.value); setSelected(null); }}>
            <option value="container">Po kontejneru</option>
            <option value="company">Po firmi</option>
            <option value="period">Po periodu</option>
          </select>
          {user?.role === "SUPER_ADMIN" ? (
            <select value={organizationId} onChange={(event) => { setOrganizationId(event.target.value); setCompanyId(""); }}>
              <option value="">Sve spedicije</option>
              {organizations.map((organization) => (
                <option value={organization.id} key={organization.id}>{organization.name}</option>
              ))}
            </select>
          ) : null}
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="SVE">Sve pozicije</option>
            <option value="OTVORENA">Otvorene</option>
            <option value="U_TOKU">U toku</option>
            <option value="FAKTURISANA">Fakturisane</option>
            <option value="NAPLACENA">Naplacene</option>
            <option value="ZATVORENA">Zatvorene</option>
            <option value="STORNIRANA">Stornirane</option>
          </select>
          <select value={companyId} onChange={(event) => setCompanyId(event.target.value)}>
            <option value="">Sve firme</option>
            {companies
              .filter((company) => !organizationId || company.organizationId === Number(organizationId))
              .map((company) => (
              <option value={company.id} key={company.id}>{company.name}</option>
            ))}
          </select>
          <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} title="Od datuma" />
          <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} title="Do datuma" />
          <button className="secondary" onClick={exportCsv}>
            <Download size={18} />
            CSV
          </button>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            {type === "container" ? (
              <>
                <th>Kontejner</th>
                <th>Firma</th>
                <th>Status</th>
              </>
            ) : null}
            {type === "company" ? (
              <>
                <th>Firma</th>
                <th>Pozicija</th>
              </>
            ) : null}
            {type === "period" ? (
              <>
                <th>Period</th>
                <th>Pozicija</th>
              </>
            ) : null}
            <th>Prihodi</th>
            <th>Troskovi</th>
            <th>Profit</th>
            <th>Marza</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.positionId || row.company || row.period} onClick={() => type === "container" ? setSelected(row) : null}>
              {type === "container" ? (
                <>
                  <td>{row.containerNumber}</td>
                  <td>{row.company}</td>
                  <td>{row.status}</td>
                </>
              ) : null}
              {type === "company" ? (
                <>
                  <td>{row.company}</td>
                  <td>{row.positionsCount}</td>
                </>
              ) : null}
              {type === "period" ? (
                <>
                  <td>{row.period}</td>
                  <td>{row.positionsCount}</td>
                </>
              ) : null}
              <td>{money(row.totalRevenue)}</td>
              <td>{money(row.totalCosts)}</td>
              <td>{money(row.profit)}</td>
              <td>{row.margin}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      {loading ? <Empty text="Ucitavanje izvjestaja..." /> : null}
      {error ? <div className="alert inline-alert">{error}</div> : null}
      {!loading && !rows.length ? <Empty text="Nema podataka za izabrani filter." /> : null}
    </section>
  );
}

function AdminPanel({ organizations, onSaved }) {
  const [organizationForm, setOrganizationForm] = useState({
    name: "",
    pib: "",
    city: "",
    country: "Crna Gora",
    email: "",
    phone: ""
  });
  const [workerForm, setWorkerForm] = useState({
    organizationId: organizations[0]?.id || "",
    name: "",
    email: "",
    password: "",
    role: "USER"
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!workerForm.organizationId && organizations[0]?.id) {
      setWorkerForm((current) => ({ ...current, organizationId: organizations[0].id }));
    }
  }, [organizations, workerForm.organizationId]);

  async function saveOrganization(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await request("/admin/organizations", { method: "POST", body: JSON.stringify(organizationForm) });
      setOrganizationForm({ name: "", pib: "", city: "", country: "Crna Gora", email: "", phone: "" });
      setMessage("Spedicija je kreirana.");
      await onSaved();
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveWorker(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await request("/admin/workers", { method: "POST", body: JSON.stringify(workerForm) });
      setWorkerForm({ organizationId: workerForm.organizationId, name: "", email: "", password: "", role: "USER" });
      setMessage("Radnik je dodat u spediciju.");
      await onSaved();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="stack">
      {message ? <div className="success">{message}</div> : null}
      {error ? <div className="alert">{error}</div> : null}
      <div className="split">
        <section className="panel">
          <div className="panel-heading">
            <h2>Nova spedicija</h2>
          </div>
          <form className="form" onSubmit={saveOrganization}>
            <label>
              Naziv spedicije
              <input value={organizationForm.name} onChange={(e) => setOrganizationForm({ ...organizationForm, name: e.target.value })} required />
            </label>
            <label>
              PIB
              <input value={organizationForm.pib} onChange={(e) => setOrganizationForm({ ...organizationForm, pib: e.target.value })} />
            </label>
            <label>
              Grad
              <input value={organizationForm.city} onChange={(e) => setOrganizationForm({ ...organizationForm, city: e.target.value })} />
            </label>
            <label>
              Drzava
              <input value={organizationForm.country} onChange={(e) => setOrganizationForm({ ...organizationForm, country: e.target.value })} />
            </label>
            <label>
              Email
              <input value={organizationForm.email} onChange={(e) => setOrganizationForm({ ...organizationForm, email: e.target.value })} />
            </label>
            <label>
              Telefon
              <input value={organizationForm.phone} onChange={(e) => setOrganizationForm({ ...organizationForm, phone: e.target.value })} />
            </label>
            <button className="primary">
              <Plus size={18} />
              Kreiraj spediciju
            </button>
          </form>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h2>Novi radnik</h2>
          </div>
          <form className="form" onSubmit={saveWorker}>
            <label>
              Spedicija
              <select value={workerForm.organizationId} onChange={(e) => setWorkerForm({ ...workerForm, organizationId: e.target.value })} required>
                <option value="">Izaberi spediciju</option>
                {organizations.map((organization) => (
                  <option value={organization.id} key={organization.id}>{organization.name}</option>
                ))}
              </select>
            </label>
            <label>
              Ime radnika
              <input value={workerForm.name} onChange={(e) => setWorkerForm({ ...workerForm, name: e.target.value })} required />
            </label>
            <label>
              Email
              <input type="email" value={workerForm.email} onChange={(e) => setWorkerForm({ ...workerForm, email: e.target.value })} required />
            </label>
            <label>
              Privremena lozinka
              <input type="password" value={workerForm.password} onChange={(e) => setWorkerForm({ ...workerForm, password: e.target.value })} required />
            </label>
            <label>
              Uloga
              <select value={workerForm.role} onChange={(e) => setWorkerForm({ ...workerForm, role: e.target.value })}>
                <option value="ADMIN">ADMIN</option>
                <option value="USER">USER</option>
                <option value="VIEWER">VIEWER</option>
              </select>
            </label>
            <button className="primary">
              <Plus size={18} />
              Dodaj radnika
            </button>
          </form>
        </section>
      </div>

      <section className="panel">
        <div className="panel-heading">
          <h2>Spedicije i radnici</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>Spedicija</th>
              <th>Kontakt</th>
              <th>Firme</th>
              <th>Pozicije</th>
              <th>Radnici</th>
            </tr>
          </thead>
          <tbody>
            {organizations.map((organization) => (
              <tr key={organization.id}>
                <td>
                  <strong>{organization.name}</strong>
                  <div className="muted-list">
                    {organization.users.map((worker) => (
                      <span key={worker.id}>{worker.name} · {worker.role} · {worker.email}</span>
                    ))}
                  </div>
                </td>
                <td>{organization.email || organization.phone || ""}</td>
                <td>{organization._count?.companies || 0}</td>
                <td>{organization._count?.positions || 0}</td>
                <td>{organization._count?.users || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!organizations.length ? <Empty text="Nema kreiranih spedicija." /> : null}
      </section>
    </div>
  );
}

function TeamPanel({ user }) {
  const [workers, setWorkers] = useState([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "USER"
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadWorkers() {
    setLoading(true);
    setError("");
    try {
      const result = await request("/team/workers");
      setWorkers(result.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWorkers();
  }, []);

  async function saveWorker(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await request("/team/workers", { method: "POST", body: JSON.stringify(form) });
      setForm({ name: "", email: "", password: "", role: "USER" });
      setMessage("Radnik je dodat.");
      await loadWorkers();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleWorker(worker) {
    setError("");
    setMessage("");
    try {
      await request(`/team/workers/${worker.id}`, {
        method: "PUT",
        body: JSON.stringify({ active: !worker.active })
      });
      setMessage(worker.active ? "Radnik je deaktiviran." : "Radnik je aktiviran.");
      await loadWorkers();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="stack">
      <section className="panel narrow">
        <div className="panel-heading">
          <div>
            <h2>Radnici</h2>
            <p>{user.organization?.name || "Tvoja spedicija"}</p>
          </div>
        </div>
        {message ? <div className="success inline-alert">{message}</div> : null}
        {error ? <div className="alert inline-alert">{error}</div> : null}
        <form className="form" onSubmit={saveWorker}>
          <label>
            Ime radnika
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label>
            Email
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </label>
          <label>
            Privremena lozinka
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </label>
          <label>
            Uloga
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="ADMIN">ADMIN</option>
              <option value="USER">USER</option>
              <option value="VIEWER">VIEWER</option>
            </select>
          </label>
          <button className="primary">
            <Plus size={18} />
            Dodaj radnika
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Radnici spedicije</h2>
          <button className="secondary" onClick={loadWorkers} disabled={loading}>
            <RefreshCw size={18} />
            {loading ? "Ucitavanje" : "Osvjezi"}
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Ime</th>
              <th>Email</th>
              <th>Uloga</th>
              <th>Status</th>
              <th>Akcije</th>
            </tr>
          </thead>
          <tbody>
            {workers.map((worker) => (
              <tr key={worker.id}>
                <td><strong>{worker.name}</strong></td>
                <td>{worker.email}</td>
                <td>{worker.role}</td>
                <td><span className="badge">{worker.active ? "AKTIVAN" : "NEAKTIVAN"}</span></td>
                <td>
                  <button className="small-action" onClick={() => toggleWorker(worker)}>
                    {worker.active ? "Deaktiviraj" : "Aktiviraj"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!workers.length ? <Empty text="Nema radnika za ovu spediciju." /> : null}
      </section>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
