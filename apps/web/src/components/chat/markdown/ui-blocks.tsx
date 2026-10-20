"use client";

import { Check, Loader2, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, Pie, PieChart, XAxis, YAxis } from "recharts";
import { z } from "zod";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { TextWithCitations } from "./citation";
import { CodeBlock } from "./code-block";

const label = z.union([z.string(), z.number()]).transform(String);
const numeric = z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/).transform(Number)]);
const text = z.string().max(2000);

const schemas = {
  chart: z
    .object({
      type: z.enum(["bar", "line", "pie"]),
      title: text.optional(),
      unit: z.string().max(40).optional(),
      x: z.array(label).min(1).max(60),
      series: z.array(z.object({ name: z.string().max(80), data: z.array(numeric) })).min(1).max(6),
    })
    .refine((c) => c.series.every((s) => s.data.length === c.x.length), "Each series needs one value per x label"),
  comparison: z.object({
    title: text.optional(),
    items: z
      .array(
        z.object({
          name: z.string().max(120),
          summary: text.optional(),
          pros: z.array(text).max(10).default([]),
          cons: z.array(text).max(10).default([]),
        }),
      )
      .min(1)
      .max(6),
  }),
  timeline: z.object({
    title: text.optional(),
    events: z
      .array(z.object({ date: label, title: z.string().max(200), description: text.optional() }))
      .min(1)
      .max(30),
  }),
  stats: z.object({
    items: z.array(z.object({ label: z.string().max(80), value: label, note: text.optional() })).min(1).max(8),
  }),
};

export type UiBlockType = keyof typeof schemas;
export const UI_BLOCK_TYPES = new Set<string>(Object.keys(schemas));

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function BlockFrame({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <figure className="not-prose my-4 rounded-xl border bg-card p-4">
      {title && <figcaption className="mb-3 text-sm font-medium">{title}</figcaption>}
      {children}
    </figure>
  );
}

function ChartBlock({ data }: { data: z.infer<(typeof schemas)["chart"]> }) {
  const title = data.unit && data.title ? `${data.title} (${data.unit})` : data.title;

  if (data.type === "pie") {
    const values = data.series[0].data;
    const rows = data.x.map((x, i) => ({ key: `p${i}`, label: x, value: values[i] }));
    const config: ChartConfig = Object.fromEntries(
      rows.map((r, i) => [r.key, { label: r.label, color: COLORS[i % COLORS.length] }]),
    );
    return (
      <BlockFrame title={title}>
        <ChartContainer config={config} className="mx-auto aspect-square max-h-72">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent nameKey="key" hideLabel />} />
            <Pie data={rows} dataKey="value" nameKey="key" innerRadius="45%" strokeWidth={2}>
              {rows.map((r) => (
                <Cell key={r.key} fill={`var(--color-${r.key})`} />
              ))}
            </Pie>
            <ChartLegend content={<ChartLegendContent nameKey="key" />} className="flex-wrap" />
          </PieChart>
        </ChartContainer>
      </BlockFrame>
    );
  }

  const rows = data.x.map((x, i) => ({ label: x, ...Object.fromEntries(data.series.map((s, j) => [`s${j}`, s.data[i]])) }));
  const config: ChartConfig = Object.fromEntries(
    data.series.map((s, j) => [`s${j}`, { label: s.name, color: COLORS[j % COLORS.length] }]),
  );
  const Chart = data.type === "line" ? LineChart : BarChart;
  return (
    <BlockFrame title={title}>
      <ChartContainer config={config} className="max-h-80 w-full">
        <Chart data={rows} margin={{ left: 4, right: 12 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval="preserveStartEnd" />
          <YAxis tickLine={false} axisLine={false} width={48} />
          <ChartTooltip content={<ChartTooltipContent />} />
          {data.series.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
          {data.series.map((_, j) =>
            data.type === "line" ? (
              <Line key={j} dataKey={`s${j}`} type="monotone" stroke={`var(--color-s${j})`} strokeWidth={2} dot={false} />
            ) : (
              <Bar key={j} dataKey={`s${j}`} fill={`var(--color-s${j})`} radius={4}>
                {data.x.length <= 12 && (
                  <LabelList dataKey={`s${j}`} position="top" className="fill-foreground" fontSize={11} />
                )}
              </Bar>
            ),
          )}
        </Chart>
      </ChartContainer>
    </BlockFrame>
  );
}

function ComparisonBlock({ data }: { data: z.infer<(typeof schemas)["comparison"]> }) {
  return (
    <BlockFrame title={data.title}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.items.map((item) => (
          <div key={item.name} className="rounded-lg border bg-background p-3 text-sm">
            <p className="font-semibold">{item.name}</p>
            {item.summary && (
              <p className="mt-1 text-muted-foreground">
                <TextWithCitations text={item.summary} />
              </p>
            )}
            <ul className="mt-2 list-none space-y-1 pl-0">
              {item.pros.map((p) => (
                <li key={`+${p}`} className="flex gap-1.5">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                  <span>
                    <TextWithCitations text={p} />
                  </span>
                </li>
              ))}
              {item.cons.map((c) => (
                <li key={`-${c}`} className="flex gap-1.5">
                  <X className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                  <span>
                    <TextWithCitations text={c} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </BlockFrame>
  );
}

function TimelineBlock({ data }: { data: z.infer<(typeof schemas)["timeline"]> }) {
  return (
    <BlockFrame title={data.title}>
      <ol className="relative ml-2 list-none space-y-4 border-l pl-5 text-sm">
        {data.events.map((event, i) => (
          <li key={`${event.date}-${i}`} className="relative">
            <span className="absolute top-1.5 -left-[26px] size-2.5 rounded-full bg-primary ring-4 ring-card" />
            <p className="font-mono text-xs text-muted-foreground">{event.date}</p>
            <p className="font-medium">
              <TextWithCitations text={event.title} />
            </p>
            {event.description && (
              <p className="text-muted-foreground">
                <TextWithCitations text={event.description} />
              </p>
            )}
          </li>
        ))}
      </ol>
    </BlockFrame>
  );
}

function StatsBlock({ data }: { data: z.infer<(typeof schemas)["stats"]> }) {
  return (
    <div className="not-prose my-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {data.items.map((item) => (
        <div key={item.label} className="rounded-xl border bg-card p-3">
          <p className="text-xs text-muted-foreground">{item.label}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{item.value}</p>
          {item.note && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              <TextWithCitations text={item.note} />
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function parse(type: UiBlockType, code: string) {
  try {
    return schemas[type].safeParse(JSON.parse(code));
  } catch {
    return null;
  }
}

/** Renders a validated UI block; falls back to the raw JSON when it is invalid. */
export function UiBlock({ type, code, streaming }: { type: UiBlockType; code: string; streaming: boolean }) {
  const result = parse(type, code);

  if (!result?.success) {
    if (streaming) {
      return (
        <p className="my-4 flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Building {type}…
        </p>
      );
    }
    return (
      <div>
        <p className="mt-4 text-xs text-muted-foreground">This {type} block couldn&apos;t be rendered; showing its data.</p>
        <CodeBlock code={code} lang="json" streaming={false} />
      </div>
    );
  }

  switch (type) {
    case "chart":
      return <ChartBlock data={result.data as z.infer<(typeof schemas)["chart"]>} />;
    case "comparison":
      return <ComparisonBlock data={result.data as z.infer<(typeof schemas)["comparison"]>} />;
    case "timeline":
      return <TimelineBlock data={result.data as z.infer<(typeof schemas)["timeline"]>} />;
    case "stats":
      return <StatsBlock data={result.data as z.infer<(typeof schemas)["stats"]>} />;
  }
}
