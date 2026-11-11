import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { DemoRecord } from "./demoData";

type ChartPeriod = "week" | "month";

type ChartPoint = {
  label: string;
  start: Date;
  end: Date;
};

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const amount = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });

function localDate(value: string): Date | null {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!parts) return null;
  return new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
}

function startOfWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);
  return start;
}

function periodBounds(period: ChartPeriod, now: Date): { start: Date; end: Date } {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return {
    start: period === "week"
      ? startOfWeek(end)
      : new Date(end.getFullYear(), end.getMonth(), 1),
    end,
  };
}

function periodLabel(period: ChartPeriod, now: Date): string {
  if (period === "week") {
    const start = startOfWeek(now);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const fmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });
    return `Week of ${fmt.format(start)} – ${fmt.format(end)}`;
  }
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(now);
}

function trendPoints(period: ChartPeriod, now: Date): ChartPoint[] {
  const { start } = periodBounds(period, now);
  if (period === "week") {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return {
        label: new Intl.DateTimeFormat("en-IN", { weekday: "short" }).format(date),
        start: date,
        end: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1),
      };
    });
  }
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const weeks = Math.ceil(daysInMonth / 7);
  return Array.from({ length: weeks }, (_, index) => {
    const bucketStart = new Date(start.getFullYear(), start.getMonth(), index * 7 + 1);
    const bucketEnd = new Date(start.getFullYear(), start.getMonth(), Math.min((index + 1) * 7 + 1, daysInMonth + 1));
    return { label: `Week ${index + 1}`, start: bucketStart, end: bucketEnd };
  });
}

function inRange(record: DemoRecord, start: Date, end: Date): boolean {
  const date = typeof record.values.date === "string" ? localDate(record.values.date) : null;
  return date !== null && date >= start && date < end;
}

function buildRevenueSeries(records: DemoRecord[], period: ChartPeriod, now: Date) {
  const endOfToday = periodBounds(period, now).end;
  const endExclusive = new Date(endOfToday.getFullYear(), endOfToday.getMonth(), endOfToday.getDate() + 1);
  return trendPoints(period, now).map((point) => {
    if (point.start > endOfToday) return { ...point, revenue: 0 };
    const bucketEnd = point.end < endExclusive ? point.end : endExclusive;
    const revenue = records
      .filter((record) => record.module === "sales"
        && record.values.status !== "Draft"
        && inRange(record, point.start, bucketEnd))
      .reduce((sum, record) => sum + Number(record.values.amount_inr ?? 0), 0);
    return { ...point, revenue };
  });
}

function buildMaterialSeries(records: DemoRecord[], period: ChartPeriod, now: Date) {
  const { start, end } = periodBounds(period, now);
  const quantities = new Map<string, { material: string; production: number; sales: number }>();
  const dispatchByInvoice = new Map(
    records
      .filter((record) => record.module === "dispatch")
      .map((record) => [String(record.values.invoice ?? ""), Number(record.values.tonnes ?? 0)]),
  );
  const itemFor = (materialValue: unknown) => {
    const material = String(materialValue ?? "").trim();
    if (!material) return null;
    const key = material.toLocaleLowerCase();
    const existing = quantities.get(key) ?? { material, production: 0, sales: 0 };
    quantities.set(key, existing);
    return existing;
  };

  for (const record of records) {
    if (!inRange(record, start, new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1))) continue;
    if (record.module === "production") {
      const item = itemFor(record.values.product);
      if (item) item.production += Number(record.values.tonnes ?? 0);
    }
    if (record.module === "sales" && record.values.status !== "Draft") {
      const item = itemFor(record.values.product);
      if (item) {
        const quantitySold = record.values.tonnes ?? dispatchByInvoice.get(String(record.values.invoice ?? "")) ?? 0;
        item.sales += Number(quantitySold);
      }
    }
  }
  return [...quantities.values()].sort((left, right) => left.material.localeCompare(right.material));
}

function formatCompactCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `₹${amount.format(value / 1_000_000)}M`;
  if (Math.abs(value) >= 1_000) return `₹${amount.format(value / 1_000)}k`;
  return `₹${amount.format(value)}`;
}

function formatBucketDate(date: Date, period: ChartPeriod): string {
  if (period === "week") return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(date);
  return date.toLocaleDateString("en-IN", { day: "numeric" });
}

export default function DashboardCharts({ records, userName }: { records: DemoRecord[]; userName: string }) {
  const [period, setPeriod] = useState<ChartPeriod>("week");
  const now = useMemo(() => new Date(), []);
  const revenue = useMemo(() => buildRevenueSeries(records, period, now), [records, period, now]);
  const materials = useMemo(() => buildMaterialSeries(records, period, now), [records, period, now]);
  const hasRevenue = revenue.some((point) => point.revenue > 0);
  const hasMaterials = materials.some((item) => item.production > 0 || item.sales > 0);

  return (
    <section className="dashboard-analytics" aria-label="Sales and production analytics">
      <div className="analytics-heading">
        <div>
          <div className="eyebrow">YOUR WORKSPACE ANALYTICS</div>
          <h2>Sales &amp; production trends</h2>
          <p>Demo records available in this browser · Signed in as {userName}</p>
        </div>
        <div className="period-toggle" role="group" aria-label="Chart period">
          <button className={period === "week" ? "selected" : ""} aria-pressed={period === "week"} onClick={() => setPeriod("week")}>This week</button>
          <button className={period === "month" ? "selected" : ""} aria-pressed={period === "month"} onClick={() => setPeriod("month")}>This month</button>
        </div>
      </div>
      <div className="analytics-period-label">{periodLabel(period, now)}</div>
      <div className="analytics-grid">
        <article className="panel analytics-card">
          <div className="analytics-card-heading"><div><h3>Sales revenue</h3><p>{period === "week" ? "Invoice value by day" : "Invoice value by week"}</p></div><span className="chart-legend-dot revenue-dot" /> <span className="chart-legend-label">Revenue</span></div>
          {hasRevenue ? <div className="chart-frame">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenue} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid stroke="#edf0f5" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#8290a4", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#e7ebf1" }} />
                <YAxis tickFormatter={formatCompactCurrency} tick={{ fill: "#8290a4", fontSize: 9 }} tickLine={false} axisLine={false} width={57} />
                <Tooltip
                  labelFormatter={(_label, payload) => {
                    const point = payload?.[0]?.payload as ChartPoint | undefined;
                    if (!point) return "";
                    return period === "week"
                      ? new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "short" }).format(point.start)
                      : `${formatBucketDate(point.start, period)} – ${formatBucketDate(new Date(point.end.getTime() - 86400000), period)} ${point.start.toLocaleDateString("en-IN", { month: "short" })}`;
                  }}
                  formatter={(value) => [currency.format(Number(value)), "Sales revenue"]}
                  contentStyle={{ border: "1px solid #e6ebf2", borderRadius: 8, fontSize: 11 }}
                />
                <Bar dataKey="revenue" name="Sales revenue" fill="#4384e8" radius={[4, 4, 0, 0]} maxBarSize={38} />
              </BarChart>
            </ResponsiveContainer>
          </div> : <div className="analytics-empty">No invoice revenue recorded for this period.</div>}
        </article>
        <article className="panel analytics-card">
          <div className="analytics-card-heading"><div><h3>Production &amp; sales by material</h3><p>Tonnes recorded during {period === "week" ? "this week" : "this month"}</p></div></div>
          {hasMaterials ? <div className="chart-frame">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={materials} margin={{ top: 8, right: 10, left: 2, bottom: 18 }}>
                <CartesianGrid stroke="#edf0f5" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="material" tick={{ fill: "#8290a4", fontSize: 9 }} tickLine={false} axisLine={{ stroke: "#e7ebf1" }} interval={0} angle={-12} textAnchor="end" height={48} />
                <YAxis tickFormatter={(value: number) => amount.format(value)} tick={{ fill: "#8290a4", fontSize: 9 }} tickLine={false} axisLine={false} width={36} />
                <Tooltip
                  formatter={(value, name) => [`${amount.format(Number(value))} t`, name === "production" ? "Production" : "Sales"]}
                  contentStyle={{ border: "1px solid #e6ebf2", borderRadius: 8, fontSize: 11 }}
                />
                <Legend verticalAlign="top" height={25} iconType="circle" wrapperStyle={{ fontSize: 10, color: "#718096" }} />
                <Bar dataKey="production" name="Production" fill="#49ad84" radius={[4, 4, 0, 0]} maxBarSize={32} />
                <Bar dataKey="sales" name="Sales" fill="#8a73d3" radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div> : <div className="analytics-empty">No production or sales quantity recorded for this period.</div>}
        </article>
      </div>
      <p className="analytics-disclosure">Draft invoices are excluded. Sales quantity uses invoice tonnes or a linked dispatch quantity. These browser demo entries are not user-attributed, shared, or stored in PostgreSQL.</p>
    </section>
  );
}
