export type ModuleKey =
  | "operations"
  | "weighbridge"
  | "production"
  | "stock"
  | "sales"
  | "dispatch"
  | "accounts"
  | "diesel_fuel"
  | "hr"
  | "maintenance";

export type DemoValue = string | number;

export type DemoRecord = {
  id: string;
  module: ModuleKey;
  values: Record<string, DemoValue>;
};

export type DemoField = {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select";
  options?: string[];
  required?: boolean;
};

export type ModuleConfig = {
  key: ModuleKey;
  title: string;
  description: string;
  fields: DemoField[];
  columns: Array<{ key: string; label: string }>;
};

const today = new Date();
const dateOffset = (days: number) => {
  const date = new Date(today);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const text = (key: string, label: string): DemoField => ({ key, label, type: "text", required: true });
const number = (key: string, label: string): DemoField => ({ key, label, type: "number", required: true });
const select = (key: string, label: string, options: string[]): DemoField => ({ key, label, type: "select", options, required: true });
const date = (key: string, label: string): DemoField => ({ key, label, type: "date", required: true });

export const moduleConfigs: Record<ModuleKey, ModuleConfig> = {
  operations: {
    key: "operations",
    title: "Operations",
    description: "A live overview of the sample weighbridge and production activity.",
    fields: [],
    columns: [],
  },
  weighbridge: {
    key: "weighbridge",
    title: "Weighbridge",
    description: "Capture gross and tare weights, then track each ticket through review.",
    fields: [
      date("date", "Ticket date"), text("ticket", "Ticket number"), text("vehicle", "Vehicle"),
      text("customer", "Customer"), text("material", "Material"), number("gross_t", "Gross (t)"),
      number("tare_t", "Tare (t)"), select("status", "Status", ["Weighed", "Under review", "Completed"]),
    ],
    columns: [
      { key: "ticket", label: "Ticket" }, { key: "date", label: "Date" }, { key: "vehicle", label: "Vehicle" },
      { key: "customer", label: "Customer" }, { key: "material", label: "Material" },
      { key: "gross_t", label: "Gross (t)" }, { key: "tare_t", label: "Tare (t)" }, { key: "net_t", label: "Net (t)" },
      { key: "status", label: "Status" },
    ],
  },
  production: {
    key: "production",
    title: "Production",
    description: "Record shift output by product and follow production completion.",
    fields: [
      date("date", "Production date"), select("shift", "Shift", ["Day", "Night"]),
      text("product", "Product"), number("tonnes", "Output (t)"), text("supervisor", "Supervisor"),
      select("status", "Status", ["Completed", "In progress", "Planned"]),
    ],
    columns: [
      { key: "date", label: "Date" }, { key: "shift", label: "Shift" }, { key: "product", label: "Product" },
      { key: "tonnes", label: "Output (t)" }, { key: "supervisor", label: "Supervisor" }, { key: "status", label: "Status" },
    ],
  },
  stock: {
    key: "stock",
    title: "Stock & Inventory",
    description: "Track stock balances and record production, dispatch, and adjustments.",
    fields: [
      text("product", "Product"), number("opening_t", "Opening (t)"), number("produced_t", "Produced (t)"),
      number("dispatched_t", "Dispatched (t)"), number("adjustment_t", "Adjustment (t)"),
    ],
    columns: [
      { key: "product", label: "Product" }, { key: "opening_t", label: "Opening (t)" },
      { key: "produced_t", label: "Produced (t)" }, { key: "dispatched_t", label: "Dispatched (t)" },
      { key: "adjustment_t", label: "Adjustment (t)" }, { key: "available_t", label: "Available (t)" },
    ],
  },
  sales: {
    key: "sales",
    title: "Sales & Billing",
    description: "Issue invoices, track amounts due, and update payment status.",
    fields: [
      text("invoice", "Invoice number"), date("date", "Invoice date"), text("customer", "Customer"),
      text("product", "Product"), number("tonnes", "Quantity sold (t)"), number("amount_inr", "Amount (INR)"),
      select("status", "Status", ["Draft", "Sent", "Part-paid", "Paid", "Overdue"]),
    ],
    columns: [
      { key: "invoice", label: "Invoice" }, { key: "date", label: "Date" }, { key: "customer", label: "Customer" },
      { key: "product", label: "Product" }, { key: "tonnes", label: "Quantity (t)" },
      { key: "amount_inr", label: "Amount" }, { key: "status", label: "Status" },
    ],
  },
  dispatch: {
    key: "dispatch",
    title: "Dispatch & Transport",
    description: "Plan customer deliveries and track vehicle and dispatch status.",
    fields: [
      text("dispatch_no", "Dispatch number"), date("date", "Dispatch date"), text("vehicle", "Vehicle"),
      text("customer", "Customer"), text("product", "Product"), number("tonnes", "Quantity (t)"),
      text("invoice", "Invoice reference"), select("status", "Status", ["Scheduled", "Loading", "Dispatched", "Delivered"]),
    ],
    columns: [
      { key: "dispatch_no", label: "Dispatch" }, { key: "date", label: "Date" }, { key: "vehicle", label: "Vehicle" },
      { key: "customer", label: "Customer" }, { key: "product", label: "Product" },
      { key: "tonnes", label: "Quantity (t)" }, { key: "invoice", label: "Invoice" }, { key: "status", label: "Status" },
    ],
  },
  accounts: {
    key: "accounts",
    title: "Accounts & Expenses",
    description: "Log operating expenses and follow payment status. Diesel entries include litres for usage reporting.",
    fields: [
      date("date", "Entry date"), select("category", "Category", ["Diesel", "Repairs", "Power", "Freight", "Supplies", "Other"]),
      text("description", "Description"), select("type", "Type", ["Expense", "Income"]),
      number("amount_inr", "Amount (INR)"), number("litres", "Diesel litres (0 if not diesel)"),
      select("status", "Status", ["Pending", "Approved", "Paid"]),
    ],
    columns: [
      { key: "date", label: "Date" }, { key: "category", label: "Category" }, { key: "description", label: "Description" },
      { key: "type", label: "Type" }, { key: "amount_inr", label: "Amount" },
      { key: "litres", label: "Litres" }, { key: "status", label: "Status" },
    ],
  },
  diesel_fuel: {
    key: "diesel_fuel",
    title: "Diesel & Fuel",
    description: "Track fuel usage by vehicle and plant machine, with vehicle alerts for unusual consumption increases.",
    fields: [
      date("date", "Fill date"),
      select("asset_type", "Asset type", ["Vehicle", "Plant machine"]),
      text("asset", "Vehicle number or machine"),
      number("litres", "Diesel filled (L)"),
      number("meter", "Odometer (km) or engine hours"),
      number("cost_inr", "Fuel cost (INR)"),
    ],
    columns: [
      { key: "date", label: "Date" }, { key: "asset_type", label: "Asset type" },
      { key: "asset", label: "Vehicle / machine" }, { key: "litres", label: "Fuel filled (L)" },
      { key: "meter", label: "Odometer / hours" }, { key: "cost_inr", label: "Fuel cost" },
    ],
  },
  hr: {
    key: "hr",
    title: "HR & Payroll",
    description: "View employee attendance and sample payroll figures. These examples are not statutory payroll calculations.",
    fields: [
      text("employee", "Employee"), text("role", "Role"), number("attendance_days", "Attendance days"),
      number("leave_days", "Leave days"), number("gross_salary", "Gross salary (INR)"),
      number("net_salary", "Net pay (INR)"), select("status", "Payroll status", ["Draft", "For approval", "Approved", "Paid"]),
    ],
    columns: [
      { key: "employee", label: "Employee" }, { key: "role", label: "Role" },
      { key: "attendance_days", label: "Attendance" }, { key: "leave_days", label: "Leave" },
      { key: "gross_salary", label: "Gross salary" }, { key: "net_salary", label: "Net pay" }, { key: "status", label: "Status" },
    ],
  },
  maintenance: {
    key: "maintenance",
    title: "Maintenance",
    description: "Schedule plant equipment service and track upcoming and completed work.",
    fields: [
      text("asset", "Equipment"), text("work_order", "Work order"), date("last_service", "Last service"),
      date("next_service", "Next service"), number("cost_inr", "Estimated cost (INR)"),
      select("status", "Status", ["Scheduled", "In progress", "Completed", "Overdue"]),
    ],
    columns: [
      { key: "asset", label: "Equipment" }, { key: "work_order", label: "Work order" },
      { key: "last_service", label: "Last service" }, { key: "next_service", label: "Next service" },
      { key: "cost_inr", label: "Est. cost" }, { key: "status", label: "Status" },
    ],
  },
};

export const initialDemoRecords: DemoRecord[] = [
  { id: "wb-001", module: "weighbridge", values: { date: dateOffset(0), ticket: "WB-2601", vehicle: "KA-05-MN-4821", customer: "East Ridge Infra", material: "20 mm Aggregate", gross_t: 42.8, tare_t: 14.2, net_t: 28.6, status: "Completed" } },
  { id: "wb-002", module: "weighbridge", values: { date: dateOffset(0), ticket: "WB-2602", vehicle: "KA-05-MN-1308", customer: "Mason Build Co.", material: "M-Sand", gross_t: 39.5, tare_t: 13.8, net_t: 25.7, status: "Weighed" } },
  { id: "wb-003", module: "weighbridge", values: { date: dateOffset(-1), ticket: "WB-2598", vehicle: "KA-03-AB-7792", customer: "East Ridge Infra", material: "40 mm Aggregate", gross_t: 44.1, tare_t: 14.6, net_t: 29.5, status: "Under review" } },
  { id: "prod-001", module: "production", values: { date: dateOffset(0), shift: "Day", product: "20 mm Aggregate", tonnes: 186, supervisor: "Ravi Kumar", status: "Completed" } },
  { id: "prod-002", module: "production", values: { date: dateOffset(0), shift: "Day", product: "M-Sand", tonnes: 142, supervisor: "Ravi Kumar", status: "In progress" } },
  { id: "prod-003", module: "production", values: { date: dateOffset(-1), shift: "Night", product: "40 mm Aggregate", tonnes: 118, supervisor: "Meena S.", status: "Completed" } },
  { id: "stock-001", module: "stock", values: { product: "20 mm Aggregate", opening_t: 315, produced_t: 186, dispatched_t: 112, adjustment_t: 0 } },
  { id: "stock-002", module: "stock", values: { product: "M-Sand", opening_t: 228, produced_t: 142, dispatched_t: 85, adjustment_t: -2 } },
  { id: "stock-003", module: "stock", values: { product: "40 mm Aggregate", opening_t: 190, produced_t: 118, dispatched_t: 74, adjustment_t: 0 } },
  { id: "sale-001", module: "sales", values: { invoice: "INV-26041", date: dateOffset(0), customer: "East Ridge Infra", product: "20 mm Aggregate", tonnes: 28.6, amount_inr: 286000, status: "Sent" } },
  { id: "sale-002", module: "sales", values: { invoice: "INV-26039", date: dateOffset(-1), customer: "Mason Build Co.", product: "M-Sand", tonnes: 25.7, amount_inr: 192500, status: "Paid" } },
  { id: "sale-003", module: "sales", values: { invoice: "INV-26037", date: dateOffset(-2), customer: "Northway Projects", product: "40 mm Aggregate", tonnes: 29.5, amount_inr: 154000, status: "Overdue" } },
  { id: "prod-hist-001", module: "production", values: { date: dateOffset(-4), shift: "Day", product: "20 mm Aggregate", tonnes: 172, supervisor: "Ravi Kumar", status: "Completed" } },
  { id: "prod-hist-002", module: "production", values: { date: dateOffset(-10), shift: "Night", product: "M-Sand", tonnes: 128, supervisor: "Meena S.", status: "Completed" } },
  { id: "prod-hist-003", module: "production", values: { date: dateOffset(-18), shift: "Day", product: "40 mm Aggregate", tonnes: 115, supervisor: "Ravi Kumar", status: "Completed" } },
  { id: "prod-hist-004", module: "production", values: { date: dateOffset(-36), shift: "Night", product: "20 mm Aggregate", tonnes: 164, supervisor: "Meena S.", status: "Completed" } },
  { id: "prod-hist-005", module: "production", values: { date: dateOffset(-44), shift: "Day", product: "M-Sand", tonnes: 139, supervisor: "Ravi Kumar", status: "Completed" } },
  { id: "prod-hist-006", module: "production", values: { date: dateOffset(-70), shift: "Day", product: "40 mm Aggregate", tonnes: 121, supervisor: "Meena S.", status: "Completed" } },
  { id: "sale-hist-001", module: "sales", values: { invoice: "INV-HIST-001", date: dateOffset(-4), customer: "East Ridge Infra", product: "20 mm Aggregate", tonnes: 30, amount_inr: 300000, status: "Paid" } },
  { id: "sale-hist-002", module: "sales", values: { invoice: "INV-HIST-002", date: dateOffset(-10), customer: "Mason Build Co.", product: "M-Sand", tonnes: 24, amount_inr: 180000, status: "Sent" } },
  { id: "sale-hist-003", module: "sales", values: { invoice: "INV-HIST-003", date: dateOffset(-18), customer: "Northway Projects", product: "40 mm Aggregate", tonnes: 27, amount_inr: 148500, status: "Paid" } },
  { id: "sale-hist-004", module: "sales", values: { invoice: "INV-HIST-004", date: dateOffset(-36), customer: "East Ridge Infra", product: "20 mm Aggregate", tonnes: 26, amount_inr: 260000, status: "Paid" } },
  { id: "sale-hist-005", module: "sales", values: { invoice: "INV-HIST-005", date: dateOffset(-44), customer: "Mason Build Co.", product: "M-Sand", tonnes: 22, amount_inr: 165000, status: "Paid" } },
  { id: "sale-hist-006", module: "sales", values: { invoice: "INV-HIST-006", date: dateOffset(-70), customer: "Northway Projects", product: "40 mm Aggregate", tonnes: 25, amount_inr: 137500, status: "Paid" } },
  { id: "dispatch-001", module: "dispatch", values: { dispatch_no: "DSP-2601", date: dateOffset(0), vehicle: "KA-05-MN-4821", customer: "East Ridge Infra", product: "20 mm Aggregate", tonnes: 28.6, invoice: "INV-26041", status: "Delivered" } },
  { id: "dispatch-002", module: "dispatch", values: { dispatch_no: "DSP-2602", date: dateOffset(0), vehicle: "KA-05-MN-1308", customer: "Mason Build Co.", product: "M-Sand", tonnes: 25.7, invoice: "INV-26042", status: "Loading" } },
  { id: "dispatch-003", module: "dispatch", values: { dispatch_no: "DSP-2598", date: dateOffset(-1), vehicle: "KA-03-AB-7792", customer: "Northway Projects", product: "40 mm Aggregate", tonnes: 29.5, invoice: "INV-26037", status: "Dispatched" } },
  { id: "acct-001", module: "accounts", values: { date: dateOffset(0), category: "Diesel", description: "Crusher and loader fuel", type: "Expense", amount_inr: 43600, litres: 520, status: "Approved" } },
  { id: "acct-002", module: "accounts", values: { date: dateOffset(-1), category: "Repairs", description: "Conveyor belt service", type: "Expense", amount_inr: 18500, litres: 0, status: "Paid" } },
  { id: "acct-003", module: "accounts", values: { date: dateOffset(-2), category: "Power", description: "Plant electricity", type: "Expense", amount_inr: 32750, litres: 0, status: "Pending" } },
  { id: "fuel-v1-001", module: "diesel_fuel", values: { date: dateOffset(-14), asset_type: "Vehicle", asset: "KA-05-MN-4821", litres: 30, meter: 10000, cost_inr: 3000 } },
  { id: "fuel-v1-002", module: "diesel_fuel", values: { date: dateOffset(-7), asset_type: "Vehicle", asset: "KA-05-MN-4821", litres: 31, meter: 10150, cost_inr: 3100 } },
  { id: "fuel-v1-003", module: "diesel_fuel", values: { date: dateOffset(-2), asset_type: "Vehicle", asset: "KA-05-MN-4821", litres: 32, meter: 10300, cost_inr: 3200 } },
  { id: "fuel-v1-004", module: "diesel_fuel", values: { date: dateOffset(0), asset_type: "Vehicle", asset: "KA-05-MN-4821", litres: 47, meter: 10450, cost_inr: 4700 } },
  { id: "fuel-v2-001", module: "diesel_fuel", values: { date: dateOffset(-10), asset_type: "Vehicle", asset: "KA-05-MN-1308", litres: 40, meter: 5000, cost_inr: 4000 } },
  { id: "fuel-v2-002", module: "diesel_fuel", values: { date: dateOffset(-4), asset_type: "Vehicle", asset: "KA-05-MN-1308", litres: 41, meter: 5160, cost_inr: 4100 } },
  { id: "fuel-v2-003", module: "diesel_fuel", values: { date: dateOffset(0), asset_type: "Vehicle", asset: "KA-05-MN-1308", litres: 40, meter: 5320, cost_inr: 4000 } },
  { id: "fuel-m1-001", module: "diesel_fuel", values: { date: dateOffset(-8), asset_type: "Plant machine", asset: "Primary jaw crusher", litres: 420, meter: 2300, cost_inr: 42000 } },
  { id: "fuel-m1-002", module: "diesel_fuel", values: { date: dateOffset(-3), asset_type: "Plant machine", asset: "Primary jaw crusher", litres: 430, meter: 2308, cost_inr: 43000 } },
  { id: "fuel-m1-003", module: "diesel_fuel", values: { date: dateOffset(0), asset_type: "Plant machine", asset: "Primary jaw crusher", litres: 425, meter: 2316, cost_inr: 42500 } },
  { id: "fuel-m2-001", module: "diesel_fuel", values: { date: dateOffset(-6), asset_type: "Plant machine", asset: "Wheel loader 02", litres: 95, meter: 811, cost_inr: 9500 } },
  { id: "fuel-m2-002", module: "diesel_fuel", values: { date: dateOffset(0), asset_type: "Plant machine", asset: "Wheel loader 02", litres: 104, meter: 819, cost_inr: 10400 } },
  { id: "hr-001", module: "hr", values: { employee: "Ravi Kumar", role: "Shift Supervisor", attendance_days: 25, leave_days: 1, gross_salary: 42000, net_salary: 38600, status: "For approval" } },
  { id: "hr-002", module: "hr", values: { employee: "Meena S.", role: "Weighbridge Operator", attendance_days: 24, leave_days: 2, gross_salary: 31500, net_salary: 29200, status: "Approved" } },
  { id: "hr-003", module: "hr", values: { employee: "Arun N.", role: "Maintenance Technician", attendance_days: 26, leave_days: 0, gross_salary: 34000, net_salary: 31800, status: "Paid" } },
  { id: "maint-001", module: "maintenance", values: { asset: "Primary jaw crusher", work_order: "WO-184", last_service: dateOffset(-28), next_service: dateOffset(2), cost_inr: 24000, status: "Scheduled" } },
  { id: "maint-002", module: "maintenance", values: { asset: "Conveyor line B", work_order: "WO-181", last_service: dateOffset(-12), next_service: dateOffset(14), cost_inr: 8500, status: "In progress" } },
  { id: "maint-003", module: "maintenance", values: { asset: "Wheel loader 02", work_order: "WO-177", last_service: dateOffset(-31), next_service: dateOffset(-2), cost_inr: 12500, status: "Overdue" } },
];

export const demoStorageKey = "quarry_demo_records_v3";
const legacyDemoStorageKeys = ["quarry_demo_records_v2", "quarry_demo_records_v1"];

function parseDemoRecords(stored: string): DemoRecord[] {
  const parsed: unknown = JSON.parse(stored);
  if (!Array.isArray(parsed) || !parsed.every(isDemoRecord)) {
    throw new Error("Saved demo data is invalid. Use Settings to reset the local demo records.");
  }
  return parsed;
}

export function isDemoRecord(value: unknown): value is DemoRecord {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DemoRecord>;
  const modules: ModuleKey[] = ["operations", "weighbridge", "production", "stock", "sales", "dispatch", "accounts", "diesel_fuel", "hr", "maintenance"];
  if (typeof candidate.id !== "string" || !modules.includes(candidate.module as ModuleKey) || !candidate.values || typeof candidate.values !== "object") return false;
  return Object.values(candidate.values).every((item) => typeof item === "string" || typeof item === "number");
}

export function readDemoRecords(): DemoRecord[] {
  const stored = localStorage.getItem(demoStorageKey);
  if (stored) return parseDemoRecords(stored);

  const legacyStored = legacyDemoStorageKeys
    .map((key) => localStorage.getItem(key))
    .find((value) => value !== null);
  if (!legacyStored) return initialDemoRecords;
  const legacyRecords = parseDemoRecords(legacyStored);
  const seededById = new Map(initialDemoRecords.map((record) => [record.id, record]));
  const knownIds = new Set(legacyRecords.map((record) => record.id));
  const migratedRecords = [
    ...legacyRecords.map((record) => {
      const seededRecord = seededById.get(record.id);
      return seededRecord
        ? { ...seededRecord, ...record, values: { ...seededRecord.values, ...record.values } }
        : record;
    }),
    ...initialDemoRecords.filter((record) => !knownIds.has(record.id)),
  ];
  localStorage.setItem(demoStorageKey, JSON.stringify(migratedRecords));
  return migratedRecords;
}

export function recordNetTonnes(record: DemoRecord): number {
  return Number(record.values.gross_t ?? 0) - Number(record.values.tare_t ?? 0);
}

export function stockAvailable(record: DemoRecord): number {
  return Number(record.values.opening_t ?? 0)
    + Number(record.values.produced_t ?? 0)
    - Number(record.values.dispatched_t ?? 0)
    + Number(record.values.adjustment_t ?? 0);
}

export type FuelReading = {
  record: DemoRecord;
  interval: number;
  rate: number | null;
  alert: boolean;
  baseline: number | null;
};

export const vehicleFuelAlertPercent = 30;

export function getFuelReadings(records: DemoRecord[]): FuelReading[] {
  const fuelRecords = records.filter((record) => record.module === "diesel_fuel");
  const groups = new Map<string, DemoRecord[]>();
  for (const record of fuelRecords) {
    const key = `${record.values.asset_type}:${String(record.values.asset).trim().toLowerCase()}`;
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }

  const result: FuelReading[] = [];
  for (const [key, items] of groups) {
    const sorted = [...items].sort((a, b) =>
      String(a.values.date).localeCompare(String(b.values.date))
      || Number(a.values.meter) - Number(b.values.meter));
    const isVehicle = key.startsWith("Vehicle:");
    const previousRates: number[] = [];
    let previousMeter: number | null = null;
    for (const record of sorted) {
      const meter = Number(record.values.meter);
      const litres = Number(record.values.litres);
      const interval = previousMeter === null ? 0 : meter - previousMeter;
      const rate = interval > 0 ? litres * (isVehicle ? 100 : 1) / interval : null;
      const baseline = rate !== null && previousRates.length >= 2
        ? previousRates.reduce((sum, item) => sum + item, 0) / previousRates.length
        : null;
      result.push({
        record,
        interval,
        rate,
        baseline,
        alert: isVehicle && rate !== null && baseline !== null && rate > baseline * (1 + vehicleFuelAlertPercent / 100),
      });
      if (rate !== null) previousRates.push(rate);
      previousMeter = meter;
    }
  }
  return result.sort((a, b) =>
    String(b.record.values.date).localeCompare(String(a.record.values.date)));
}
