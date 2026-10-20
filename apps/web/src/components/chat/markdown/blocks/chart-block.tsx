"use client";

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
import { BlockFrame } from "./block-frame";
import { defineBlock } from "./define-block";
import { label, numeric, text } from "./fields";

/** ```chart: bar, line or pie chart. `series[i].data` has one value per `x` label; pie uses the first series. */
const schema = z
  .object({
    type: z.enum(["bar", "line", "pie"]),
    title: text.optional(),
    unit: z.string().max(40).optional(),
    x: z.array(label).min(1).max(60),
    series: z.array(z.object({ name: z.string().max(80), data: z.array(numeric) })).min(1).max(6),
  })
  .refine((c) => c.series.every((s) => s.data.length === c.x.length), "Each series needs one value per x label");

type ChartData = z.output<typeof schema>;

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
/** Bars get value labels only when there's room for them. */
const MAX_LABELLED_BARS = 12;

function PieChartView({ data }: { data: ChartData }) {
  const values = data.series[0].data;
  const rows = data.x.map((x, i) => ({ key: `p${i}`, label: x, value: values[i] }));
  const config: ChartConfig = Object.fromEntries(
    rows.map((r, i) => [r.key, { label: r.label, color: COLORS[i % COLORS.length] }]),
  );
  return (
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
  );
}

function CartesianChartView({ data }: { data: ChartData }) {
  // Recharts wants one row per x label, with each series as a column (s0, s1, ...).
  const rows = data.x.map((x, i) => ({ label: x, ...Object.fromEntries(data.series.map((s, j) => [`s${j}`, s.data[i]])) }));
  const config: ChartConfig = Object.fromEntries(
    data.series.map((s, j) => [`s${j}`, { label: s.name, color: COLORS[j % COLORS.length] }]),
  );
  const Chart = data.type === "line" ? LineChart : BarChart;
  return (
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
              {data.x.length <= MAX_LABELLED_BARS && (
                <LabelList dataKey={`s${j}`} position="top" className="fill-foreground" fontSize={11} />
              )}
            </Bar>
          ),
        )}
      </Chart>
    </ChartContainer>
  );
}

function ChartBlock({ data }: { data: ChartData }) {
  const title = data.unit && data.title ? `${data.title} (${data.unit})` : data.title;
  return (
    <BlockFrame title={title}>
      {data.type === "pie" ? <PieChartView data={data} /> : <CartesianChartView data={data} />}
    </BlockFrame>
  );
}

export const chartBlock = defineBlock(schema, ChartBlock);
