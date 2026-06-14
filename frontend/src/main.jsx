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
  Trash2
} from "lucide-react";
import "./styles.css";

const API = "http://localhost:8590/api";

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Greska u komunikaciji sa API-jem" }));
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

function App() {
  const [active, setActive] = useState("dashboard");
  const [companies, setCompanies] = useState([]);
  const [positions, setPositions] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [reports, setReports] = useState([]);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadAll() {
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
    loadAll();
  }, []);

  const nav = [
    ["dashboard", "Dashboard", BarChart3],
    ["companies", "Firme", Building2],
    ["positions", "Pozicije", Container],
    ["entry", "Novi unos", FilePlus2],
    ["reports", "Izvjestaji", FileText]
  ];

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <Container size={26} />
          <div>
            <strong>Spedicija</strong>
            <span>Profit po kontejneru</span>
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
            <p>Pregled pozicija, faktura i profita po kontejneru.</p>
          </div>
          <button className="icon-button" onClick={loadAll} title="Osvjezi podatke">
            <RefreshCw size={18} />
            {loading ? "Ucitavanje" : "Osvjezi"}
          </button>
        </header>

        {message ? <div className="alert">{message}</div> : null}

        {active === "dashboard" && <Dashboard dashboard={dashboard} positions={positions} />}
        {active === "companies" && <Companies companies={companies} onSaved={loadAll} />}
        {active === "positions" && (
          <Positions
            positions={positions}
            companies={companies}
            selectedPosition={selectedPosition}
            setSelectedPosition={setSelectedPosition}
            onSaved={loadAll}
          />
        )}
        {active === "entry" && <NewEntryWizard companies={companies} positions={positions} onDone={loadAll} />}
        {active === "reports" && <Reports rows={reports} positions={positions} companies={companies} onSaved={loadAll} />}
      </main>
    </div>
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

function Companies({ companies, onSaved }) {
  const [form, setForm] = useState({ name: "", pib: "", companyType: "KLIJENT", email: "", phone: "" });
  const [error, setError] = useState("");

  async function save(event) {
    event.preventDefault();
    setError("");
    try {
      await request("/companies", { method: "POST", body: JSON.stringify(form) });
      setForm({ name: "", pib: "", companyType: "KLIJENT", email: "", phone: "" });
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
      </div>
      {!isClosed ? <QuickInvoice position={position} companies={companies} onSaved={onSaved} /> : null}
    </section>
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

function NewEntryWizard({ companies, positions, onDone }) {
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
    return <NewPositionStep companies={companies} onCreated={setPosition} />;
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

function NewPositionStep({ companies, onCreated }) {
  const [form, setForm] = useState({
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
        <label>
          Firma / klijent
          <select value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}>
            <option value="">Bez firme</option>
            {companies.map((company) => (
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

function Reports({ rows, positions, companies, onSaved }) {
  const [status, setStatus] = useState("SVE");
  const [selected, setSelected] = useState(null);
  const filteredRows = useMemo(() => {
    if (status === "SVE") return rows;
    return rows.filter((row) => row.status === status);
  }, [rows, status]);

  function exportCsv() {
    const params = new URLSearchParams({ format: "csv" });
    if (status !== "SVE") params.set("status", status);
    window.location.href = `${API}/reports/profit-by-container?${params.toString()}`;
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
          <h2>Profit po kontejneru</h2>
          <p>Klikni na red za detalje ulaznih i izlaznih racuna.</p>
        </div>
        <div className="report-actions">
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="SVE">Sve pozicije</option>
            <option value="OTVORENA">Otvorene</option>
            <option value="U_TOKU">U toku</option>
            <option value="FAKTURISANA">Fakturisane</option>
            <option value="NAPLACENA">Naplacene</option>
            <option value="ZATVORENA">Zatvorene</option>
            <option value="STORNIRANA">Stornirane</option>
          </select>
          <button className="secondary" onClick={exportCsv}>
            <Download size={18} />
            CSV
          </button>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Kontejner</th>
            <th>Firma</th>
            <th>Status</th>
            <th>Prihodi</th>
            <th>Troskovi</th>
            <th>Profit</th>
            <th>Marza</th>
          </tr>
        </thead>
        <tbody>
          {filteredRows.map((row) => (
            <tr key={row.positionId} onClick={() => setSelected(row)}>
              <td>{row.containerNumber}</td>
              <td>{row.company}</td>
              <td>{row.status}</td>
              <td>{money(row.totalRevenue)}</td>
              <td>{money(row.totalCosts)}</td>
              <td>{money(row.profit)}</td>
              <td>{row.margin}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!filteredRows.length ? <Empty text="Nema pozicija za izabrani filter." /> : null}
    </section>
  );
}

createRoot(document.getElementById("root")).render(<App />);
