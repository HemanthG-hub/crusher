import { useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle, ArrowDownToLine, ArrowUpRight, Boxes, ClipboardList, Gauge, Plus, RotateCcw,
  Send, Settings, ShieldCheck, Sparkles, Truck, X,
} from "lucide-react";
import {
  demoStorageKey, getFuelReadings, initialDemoRecords, moduleConfigs, recordNetTonnes,
  stockAvailable, vehicleFuelAlertPercent, type DemoField, type DemoRecord, type DemoValue, type ModuleKey,
} from "./demoData";

type ModuleWorkspaceProps = {
  page: string;
  records: DemoRecord[];
  onRecordsChange: (records: DemoRecord[]) => void;
  onNavigate: (path: string) => void;
};

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const quantity = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });
const today = () => new Date().toISOString().slice(0, 10);

function displayValue(key: string, value: DemoValue | undefined, record?: DemoRecord): string {
  if (key === "net_t" && record?.module === "weighbridge") return quantity.format(recordNetTonnes(record));
  if (key === "available_t" && record?.module === "stock") return quantity.format(stockAvailable(record));
  if (value === undefined || value === "") return "—";
  if (key.endsWith("_inr") || key.endsWith("_salary") || key === "amount_inr" || key === "gross_salary" || key === "net_salary") {
    return currency.format(Number(value));
  }
  if (typeof value === "number") return quantity.format(value);
  return value;
}

function metricValue(records: DemoRecord[], module: ModuleKey, key: string, total = false): number {
  const values = records.filter((record) => record.module === module);
  if (total) return values.reduce((sum, record) => sum + Number(record.values[key] ?? 0), 0);
  return values.length;
}

function exportCsv(records: DemoRecord[]) {
  const columns = ["Module", "Record ID", "Date", "Description", "Status", "Amount / Quantity"];
  const rows = records.map((record) => {
    const config = moduleConfigs[record.module];
    const summaryField = config.columns[0]?.key ?? "";
    const amountKey = record.module === "stock"
      ? "available_t"
      : record.module === "weighbridge"
        ? "net_t"
        : ["amount_inr", "tonnes", "cost_inr"].find((key) => key in record.values);
    return [
      config.title,
      record.id,
      String(record.values.date ?? record.values.next_service ?? ""),
      String(record.values[summaryField] ?? ""),
      String(record.values.status ?? ""),
      amountKey ? displayValue(amountKey, record.values[amountKey], record) : "",
    ];
  });
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const csv = [columns, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `quarry-one-demo-report-${today()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function OperationsOverview({ records, onNavigate }: Pick<ModuleWorkspaceProps, "records" | "onNavigate">) {
  const tickets = records.filter((record) => record.module === "weighbridge");
  const production = records.filter((record) => record.module === "production");
  const dispatch = records.filter((record) => record.module === "dispatch");
  return (
    <>
      <div className="module-stats">
        <article className="module-stat"><span>Weighbridge tickets</span><strong>{tickets.length}</strong><small>{quantity.format(tickets.reduce((sum, item) => sum + recordNetTonnes(item), 0))} t net recorded</small></article>
        <article className="module-stat"><span>Production entries</span><strong>{production.length}</strong><small>{quantity.format(metricValue(records, "production", "tonnes", true))} t output recorded</small></article>
        <article className="module-stat"><span>Dispatches</span><strong>{dispatch.length}</strong><small>{quantity.format(metricValue(records, "dispatch", "tonnes", true))} t scheduled or delivered</small></article>
        <article className="module-stat"><span>Open maintenance</span><strong>{records.filter((item) => item.module === "maintenance" && item.values.status !== "Completed").length}</strong><small>Work orders to monitor</small></article>
      </div>
      <div className="module-card">
        <div className="module-card-heading"><div><h2>Recent site activity</h2><p>Demo weighments and shift production</p></div></div>
        <div className="overview-links">
          <button onClick={() => onNavigate("/weighbridge")}><Gauge size={17} /> Open weighbridge <ArrowUpRight size={14} /></button>
          <button onClick={() => onNavigate("/production")}><Boxes size={17} /> Review production <ArrowUpRight size={14} /></button>
          <button onClick={() => onNavigate("/dispatch-transport")}><Truck size={17} /> Track dispatches <ArrowUpRight size={14} /></button>
        </div>
        <div className="module-table-wrap">
          <table className="module-table">
            <thead><tr><th>Activity</th><th>Reference</th><th>Product / material</th><th>Quantity</th><th>Status</th></tr></thead>
            <tbody>
              {[...tickets.slice(0, 3), ...production.slice(0, 2)].map((item) => {
                const isTicket = item.module === "weighbridge";
                return <tr key={item.id}>
                  <td>{isTicket ? "Weighbridge" : "Production"}</td>
                  <td>{String(item.values.ticket ?? item.values.shift)}</td>
                  <td>{String(item.values.material ?? item.values.product)}</td>
                  <td>{quantity.format(isTicket ? recordNetTonnes(item) : Number(item.values.tonnes))} t</td>
                  <td><span className="status-pill">{String(item.values.status)}</span></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function ReportsView({ records }: { records: DemoRecord[] }) {
  const totals = useMemo(() => ({
    production: metricValue(records, "production", "tonnes", true),
    dispatched: metricValue(records, "dispatch", "tonnes", true),
    sales: metricValue(records, "sales", "amount_inr", true),
    expenses: records.filter((item) => item.module === "accounts" && item.values.type === "Expense")
      .reduce((sum, item) => sum + Number(item.values.amount_inr ?? 0), 0),
    fuel: records.filter((item) => item.module === "diesel_fuel")
      .reduce((sum, item) => sum + Number(item.values.litres ?? 0), 0),
    stock: records.filter((item) => item.module === "stock").reduce((sum, item) => sum + stockAvailable(item), 0),
  }), [records]);
  return (
    <>
      <div className="module-stats">
        <article className="module-stat"><span>Production recorded</span><strong>{quantity.format(totals.production)} t</strong><small>Sum of production entries</small></article>
        <article className="module-stat"><span>Dispatch quantity</span><strong>{quantity.format(totals.dispatched)} t</strong><small>Sum of dispatch entries</small></article>
        <article className="module-stat"><span>Invoice value</span><strong>{currency.format(totals.sales)}</strong><small>Includes all invoice statuses</small></article>
        <article className="module-stat"><span>Expenses entered</span><strong>{currency.format(totals.expenses)}</strong><small>Includes all expense statuses</small></article>
        <article className="module-stat"><span>Diesel logged</span><strong>{quantity.format(totals.fuel)} L</strong><small>Vehicle and machine fuel entries</small></article>
        <article className="module-stat"><span>Stock on hand</span><strong>{quantity.format(totals.stock)} t</strong><small>Calculated from opening + produced − dispatched ± adjustment</small></article>
      </div>
      <div className="module-card report-note">
        <ClipboardList size={21} />
        <div><h2>Operational summary</h2><p>Totals are calculated from the sample records currently saved in this browser. Download the combined CSV to inspect the underlying demo entries.</p></div>
      </div>
    </>
  );
}

function AssistantView({ records }: { records: DemoRecord[] }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const respond = (prompt: string) => {
    const q = prompt.toLowerCase();
    if (q.includes("stock") || q.includes("inventory")) {
      const byProduct = records.filter((item) => item.module === "stock")
        .map((item) => `${item.values.product}: ${quantity.format(stockAvailable(item))} t`);
      setAnswer(byProduct.length ? `Current sample stock balances — ${byProduct.join("; ")}.` : "There are no stock records in this browser yet.");
    } else if (q.includes("production")) {
      setAnswer(`There are ${metricValue(records, "production", "tonnes", true).toLocaleString("en-IN")} t across ${metricValue(records, "production", "tonnes")} production entries in the sample data.`);
    } else if (q.includes("sale") || q.includes("invoice") || q.includes("revenue")) {
      setAnswer(`${currency.format(metricValue(records, "sales", "amount_inr", true))} is represented by ${metricValue(records, "sales", "amount_inr")} sample invoices.`);
    } else if (q.includes("maintenance") || q.includes("service")) {
      const due = records.filter((item) => item.module === "maintenance" && (item.values.status === "Overdue" || item.values.status === "Scheduled"));
      setAnswer(`${due.length} sample work orders are scheduled or overdue: ${due.map((item) => String(item.values.asset)).join(", ") || "none"}.`);
    } else if (q.includes("dispatch") || q.includes("truck")) {
      setAnswer(`The sample workspace has ${metricValue(records, "dispatch", "tonnes")} dispatch records totaling ${quantity.format(metricValue(records, "dispatch", "tonnes", true))} t.`);
    } else if (q.includes("diesel") || q.includes("fuel")) {
      const fuel = getFuelReadings(records);
      const vehicles = fuel.filter((item) => item.record.values.asset_type === "Vehicle");
      const machines = fuel.filter((item) => item.record.values.asset_type === "Plant machine");
      const alerts = fuel.filter((item) => item.alert);
      setAnswer(`Sample fuel logged: ${quantity.format(vehicles.reduce((sum, item) => sum + Number(item.record.values.litres), 0))} L for vehicles and ${quantity.format(machines.reduce((sum, item) => sum + Number(item.record.values.litres), 0))} L for machines. ${alerts.length} vehicle consumption alert${alerts.length === 1 ? "" : "s"} flagged.`);
    } else {
      setAnswer("Try asking about stock, production, sales, dispatch, or maintenance. Answers use the local sample records only.");
    }
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (question.trim()) respond(question.trim());
  };
  return (
    <div className="module-card assistant-card">
      <div className="assistant-intro"><div className="module-icon"><Sparkles size={20} /></div><div><h2>Local demo insights</h2><p>This rule-based preview answers a few questions from the sample data. No external AI service is connected.</p></div></div>
      <div className="assistant-prompts">
        {["What is the stock level?", "How much was produced?", "Show sales totals", "Which maintenance is due?"].map((item) => <button key={item} onClick={() => { setQuestion(item); respond(item); }}>{item}</button>)}
      </div>
      {answer && <div className="assistant-answer"><Sparkles size={16} /><span>{answer}</span></div>}
      <form className="assistant-form" onSubmit={submit}>
        <input aria-label="Ask about demo operations" placeholder="Ask about stock, production, sales..." value={question} onChange={(event) => setQuestion(event.target.value)} />
        <button className="primary-button" aria-label="Ask question"><Send size={16} /></button>
      </form>
    </div>
  );
}

function DieselFuelView({
  records, onRecordsChange,
}: Pick<ModuleWorkspaceProps, "records" | "onRecordsChange">) {
  const readings = getFuelReadings(records);
  const fuelRecords = records.filter((record) => record.module === "diesel_fuel");
  const vehicles = new Map<string, DemoRecord[]>();
  const machines = new Map<string, DemoRecord[]>();
  for (const record of fuelRecords) {
    const collection = record.values.asset_type === "Vehicle" ? vehicles : machines;
    const name = String(record.values.asset).trim();
    collection.set(name, [...(collection.get(name) ?? []), record]);
  }
  const latestByAsset = new Map<string, (typeof readings)[number]>();
  for (const reading of readings) {
    const key = `${reading.record.values.asset_type}:${String(reading.record.values.asset).trim().toLowerCase()}`;
    const current = latestByAsset.get(key);
    if (!current
      || String(reading.record.values.date) > String(current.record.values.date)
      || (String(reading.record.values.date) === String(current.record.values.date)
        && Number(reading.record.values.meter) > Number(current.record.values.meter))) {
      latestByAsset.set(key, reading);
    }
  }
  const alerts = [...latestByAsset.values()].filter((item) => item.alert);
  const totalLitres = (items: DemoRecord[]) => items.reduce((sum, item) => sum + Number(item.values.litres ?? 0), 0);
  const totalIntervals = (items: DemoRecord[], type: "Vehicle" | "Plant machine") =>
    readings.filter((item) => item.record.values.asset_type === type && items.some((record) => record.id === item.record.id && item.interval > 0));
  const averageRate = (items: DemoRecord[], type: "Vehicle" | "Plant machine") => {
    const intervals = totalIntervals(items, type);
    const meterTotal = intervals.reduce((sum, item) => sum + item.interval, 0);
    const litresTotal = intervals.reduce((sum, item) => sum + Number(item.record.values.litres ?? 0), 0);
    if (!meterTotal) return null;
    return type === "Vehicle" ? litresTotal * 100 / meterTotal : litresTotal / meterTotal;
  };
  const totalVehicleLitres = [...vehicles.values()].reduce((sum, items) => sum + totalLitres(items), 0);
  const totalMachineLitres = [...machines.values()].reduce((sum, items) => sum + totalLitres(items), 0);
  const quantityFormat = (value: number | null, digits = 1) => value === null ? "Not enough readings" : new Intl.NumberFormat("en-IN", { maximumFractionDigits: digits }).format(value);

  return (
    <>
      <div className="notice warning fuel-rule-note">
        <AlertTriangle size={16} />
        <span>Vehicle alert rule: alert when the latest calculated fuel rate is over {vehicleFuelAlertPercent}% above that vehicle’s average of at least two earlier measured intervals. Rates use consecutive odometer readings; machine rates use engine-hour readings.</span>
      </div>
      <div className="module-stats">
        <article className="module-stat"><span>Vehicle fuel logged</span><strong>{quantity.format(totalVehicleLitres)} L</strong><small>{vehicles.size} vehicles · all recorded refuels</small></article>
        <article className="module-stat"><span>Machine fuel logged</span><strong>{quantity.format(totalMachineLitres)} L</strong><small>{machines.size} plant machines · all recorded refuels</small></article>
        <article className="module-stat fuel-alert-stat"><span>Vehicle consumption alerts</span><strong>{alerts.length}</strong><small>{alerts.length ? "Review latest readings below" : "No unusual latest readings detected"}</small></article>
      </div>
      {alerts.length > 0 && (
        <section className="fuel-alert-list" aria-label="Unusual vehicle fuel consumption alerts">
          {alerts.map((item) => (
            <article key={item.record.id} className="fuel-alert">
              <AlertTriangle size={18} />
              <div><strong>Unusual fuel increase: {String(item.record.values.asset)}</strong><span>Latest rate {quantity.format(item.rate ?? 0)} L/100 km vs prior average {quantity.format(item.baseline ?? 0)} L/100 km ({quantity.format(((item.rate ?? 0) / (item.baseline ?? 1) - 1) * 100)}% higher).</span></div>
              <span className="status-pill status-overdue">Review</span>
            </article>
          ))}
        </section>
      )}
      <section className="module-card fuel-summary-card">
        <div className="module-card-heading"><div><h2>Vehicle consumption by vehicle</h2><p>Each vehicle is listed separately; consumption rate is based on measured intervals between fuel entries.</p></div></div>
        <div className="module-table-wrap">
          <table className="module-table">
            <thead><tr><th>Vehicle</th><th>Fuel logged (L)</th><th>Measured distance (km)</th><th>Average consumption (L/100 km)</th><th>Latest rate</th><th>Alert</th></tr></thead>
            <tbody>{[...vehicles.entries()].map(([vehicle, items]) => {
              const intervals = totalIntervals(items, "Vehicle");
              const distance = intervals.reduce((sum, item) => sum + item.interval, 0);
              const latest = latestByAsset.get(`Vehicle:${vehicle.toLowerCase()}`);
              return <tr key={vehicle}><td>{vehicle}</td><td>{quantity.format(totalLitres(items))}</td><td>{quantity.format(distance)}</td><td>{quantityFormat(averageRate(items, "Vehicle"))}</td><td>{latest?.rate === null || latest?.rate === undefined ? "Not enough readings" : `${quantity.format(latest.rate)} L/100 km`}</td><td>{latest?.alert ? <span className="status-pill status-overdue">Alert</span> : <span className="status-pill status-approved">Normal</span>}</td></tr>;
            })}{vehicles.size === 0 && <tr><td className="empty-table" colSpan={6}>No vehicle fuel records yet.</td></tr>}</tbody>
          </table>
        </div>
      </section>
      <section className="module-card fuel-summary-card">
        <div className="module-card-heading"><div><h2>Plant machine consumption</h2><p>Machine fuel rates use engine hours between fuel entries.</p></div></div>
        <div className="module-table-wrap">
          <table className="module-table">
            <thead><tr><th>Machine</th><th>Fuel logged (L)</th><th>Measured hours</th><th>Average consumption (L/hour)</th><th>Latest rate</th></tr></thead>
            <tbody>{[...machines.entries()].map(([machine, items]) => {
              const intervals = totalIntervals(items, "Plant machine");
              const hours = intervals.reduce((sum, item) => sum + item.interval, 0);
              const latest = latestByAsset.get(`Plant machine:${machine.toLowerCase()}`);
              return <tr key={machine}><td>{machine}</td><td>{quantity.format(totalLitres(items))}</td><td>{quantity.format(hours)}</td><td>{quantityFormat(averageRate(items, "Plant machine"))}</td><td>{latest?.rate === null || latest?.rate === undefined ? "Not enough readings" : `${quantity.format(latest.rate)} L/hour`}</td></tr>;
            })}{machines.size === 0 && <tr><td className="empty-table" colSpan={5}>No plant-machine fuel records yet.</td></tr>}</tbody>
          </table>
        </div>
      </section>
      <section className="fuel-records">
        <div className="fuel-records-heading"><div><h2>Fuel entries</h2><p>Log fuel fills against each vehicle or machine.</p></div></div>
        <RecordsView module="diesel_fuel" records={records} onRecordsChange={onRecordsChange} />
      </section>
      <p className="demo-footnote"><ShieldCheck size={14} /> Consumption estimates and alerts use browser-local demo entries and do not replace calibrated fuel monitoring.</p>
    </>
  );
}

function DemoRecordForm({
  module, existing, onSave, onCancel,
}: {
  module: ModuleKey;
  existing?: DemoRecord;
  onSave: (record: DemoRecord) => void;
  onCancel: () => void;
}) {
  const config = moduleConfigs[module];
  const [formError, setFormError] = useState("");
  const [values, setValues] = useState<Record<string, string>>(() => {
    if (existing) return Object.fromEntries(config.fields.map((field) => [field.key, String(existing.values[field.key] ?? "")]));
    return Object.fromEntries(config.fields.map((field) => [
      field.key,
      field.type === "date" ? today() : field.type === "select" ? field.options?.[0] ?? "" : "",
    ]));
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (module === "weighbridge" && Number(values.gross_t) <= Number(values.tare_t)) {
      setFormError("Gross weight must be greater than tare weight.");
      return;
    }
    if (module === "diesel_fuel" && (Number(values.litres) <= 0 || Number(values.meter) <= 0)) {
      setFormError("Fuel quantity and odometer / engine-hour reading must be greater than zero.");
      return;
    }
    const savedValues: Record<string, DemoValue> = {};
    for (const field of config.fields) {
      const value = values[field.key]?.trim() ?? "";
      savedValues[field.key] = field.type === "number" ? Number(value || 0) : value;
    }
    if (module === "weighbridge") {
      savedValues.net_t = Number(savedValues.gross_t ?? 0) - Number(savedValues.tare_t ?? 0);
    }
    setFormError("");
    onSave({ id: existing?.id ?? crypto.randomUUID(), module, values: savedValues });
  };

  return (
    <form className="record-form" onSubmit={submit}>
      <div className="record-form-heading"><div><h2>{existing ? "Edit record" : `New ${config.title.toLowerCase()} record`}</h2><p>Saved in this browser’s demo workspace.</p></div><button type="button" className="icon-button" aria-label="Close form" onClick={onCancel}><X size={17} /></button></div>
      <div className="record-form-grid">
        {config.fields.map((field: DemoField) => (
          <label key={field.key}>
            <span>{field.label}</span>
            {field.type === "select" ? (
              <select required={field.required} value={values[field.key] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}>
                {field.options?.map((option) => <option key={option}>{option}</option>)}
              </select>
            ) : (
              <input required={field.required} type={field.type} min={field.type === "number" && field.key !== "adjustment_t" ? "0" : undefined} step={field.type === "number" ? "any" : undefined} value={values[field.key] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} />
            )}
          </label>
        ))}
      </div>
      {formError && <p className="form-error" role="alert">{formError}</p>}
      <div className="record-form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Cancel</button><button type="submit" className="primary-button">{existing ? "Save changes" : "Add record"}</button></div>
    </form>
  );
}

function RecordsView({
  module, records, onRecordsChange,
}: Pick<ModuleWorkspaceProps, "records" | "onRecordsChange"> & { module: Exclude<ModuleKey, "operations"> }) {
  const config = moduleConfigs[module];
  const moduleRecords = records.filter((record) => record.module === module);
  const [editing, setEditing] = useState<DemoRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const save = (record: DemoRecord) => {
    onRecordsChange(editing
      ? records.map((item) => item.id === record.id ? record : item)
      : [...records, record]);
    setEditing(null);
    setFormOpen(false);
  };
  const remove = (record: DemoRecord) => {
    const recordName = record.values.ticket
      ?? record.values.invoice
      ?? record.values.dispatch_no
      ?? record.values.asset
      ?? record.values.employee
      ?? record.values.product
      ?? record.values[config.columns[0]?.key ?? ""]
      ?? record.id;
    if (!window.confirm(`Delete demo record ${String(recordName)}?`)) return;
    onRecordsChange(records.filter((item) => item.id !== record.id));
  };
  return (
    <>
      <div className="module-toolbar">
        <div className="module-count"><strong>{moduleRecords.length}</strong> demo records <span>· stored locally</span></div>
        <button className="primary-button" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus size={16} /> Add record</button>
      </div>
      {formOpen && <DemoRecordForm key={editing?.id ?? "new"} module={module} existing={editing ?? undefined} onSave={save} onCancel={() => { setFormOpen(false); setEditing(null); }} />}
      <div className="module-card module-table-card">
        <div className="module-table-wrap">
          <table className="module-table">
            <thead><tr>{config.columns.map((column) => <th key={column.key}>{column.label}</th>)}<th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {moduleRecords.map((record) => (
                <tr key={record.id}>
                  {config.columns.map((column) => <td key={column.key}>{column.key === "status" ? <span className={`status-pill status-${String(record.values.status).toLowerCase().replaceAll(" ", "-")}`}>{displayValue(column.key, record.values[column.key], record)}</span> : displayValue(column.key, record.values[column.key], record)}</td>)}
                  <td className="row-actions"><button onClick={() => { setEditing(record); setFormOpen(true); }} aria-label="Edit record">Edit</button><button onClick={() => remove(record)} aria-label="Delete record">Delete</button></td>
                </tr>
              ))}
              {!moduleRecords.length && <tr><td className="empty-table" colSpan={config.columns.length + 1}>No records yet. Add the first demo record to get started.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <p className="demo-footnote"><ShieldCheck size={14} /> Demo entries are browser-local and are not posted to the company database.</p>
    </>
  );
}

function SettingsView({ records, onRecordsChange }: Pick<ModuleWorkspaceProps, "records" | "onRecordsChange">) {
  const [message, setMessage] = useState("");
  const reset = () => {
    if (!window.confirm("Restore the original sample records? Your local demo changes will be replaced.")) return;
    localStorage.removeItem(demoStorageKey);
    onRecordsChange(initialDemoRecords);
    setMessage("Sample records restored.");
  };
  return (
    <div className="module-card settings-card">
      <div className="settings-title"><div className="module-icon"><Settings size={19} /></div><div><h2>Workspace settings</h2><p>Local demo configuration and sample-data controls.</p></div></div>
      <div className="settings-list">
        <div><span>Company</span><strong>Quarry One Demo</strong></div>
        <div><span>Workspace mode</span><strong>Local demo</strong></div>
        <div><span>Sample records</span><strong>{records.length} across all modules</strong></div>
        <div><span>Storage</span><strong>This browser only</strong></div>
      </div>
      <div className="settings-reset"><div><strong>Reset sample data</strong><p>Restore the original examples and remove local edits.</p>{message && <span className="success-message">{message}</span>}</div><button className="secondary-button" onClick={reset}><RotateCcw size={15} /> Reset examples</button></div>
    </div>
  );
}

export default function ModuleWorkspace({ page, records, onRecordsChange, onNavigate }: ModuleWorkspaceProps) {
  const moduleByPage: Record<string, ModuleKey> = {
    Operations: "operations",
    Weighbridge: "weighbridge",
    Production: "production",
    "Stock & Inventory": "stock",
    "Sales & Billing": "sales",
    "Dispatch & Transport": "dispatch",
    "Accounts & Expenses": "accounts",
    "Diesel & Fuel": "diesel_fuel",
    "HR & Payroll": "hr",
    Maintenance: "maintenance",
  };
  const module = moduleByPage[page];
  const heading = module ? moduleConfigs[module].title : page;
  const description = module ? moduleConfigs[module].description : page === "Reports"
    ? "Review cross-module totals calculated from the current sample records."
    : page === "AI Assistant"
      ? "Ask simple questions about the local demo workspace."
      : "Manage demo workspace configuration.";

  return (
    <section className="module-workspace">
      <div className="module-page-heading">
        <div><div className="eyebrow">QUARRY ONE <span className="demo-label">DEMO DATA</span></div><h1>{heading}</h1><p>{description}</p></div>
        {page === "Reports" && <button className="secondary-button" onClick={() => exportCsv(records)}><ArrowDownToLine size={15} /> Export CSV</button>}
      </div>
      {module === "operations" && <OperationsOverview records={records} onNavigate={onNavigate} />}
      {module === "diesel_fuel" && <DieselFuelView records={records} onRecordsChange={onRecordsChange} />}
      {module && module !== "operations" && module !== "diesel_fuel" && <RecordsView module={module} records={records} onRecordsChange={onRecordsChange} />}
      {page === "Reports" && <ReportsView records={records} />}
      {page === "AI Assistant" && <AssistantView records={records} />}
      {page === "Settings" && <SettingsView records={records} onRecordsChange={onRecordsChange} />}
      <footer className="module-footer"><span>Sample data only</span><span>Not yet shared with the API or PostgreSQL records</span></footer>
    </section>
  );
}
