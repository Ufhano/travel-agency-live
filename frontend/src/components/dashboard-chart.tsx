"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatZAR } from "@/lib/utils";
import type { TripAggregate } from "@backend/types";

export function DashboardChart({ rows }: { rows: TripAggregate[] }) {
  const data = rows.map((r) => ({
    name: r.trip.name.split(" ")[0],
    collected: r.totalPaid,
    outstanding: r.outstanding,
  }));

  return (
    <Card className="print:hidden">
      <CardHeader>
        <CardTitle className="text-base">
          Cash received vs balance due by departure
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v) =>
                `${Math.round(v / 1000)}k`
              }
            />
            <Tooltip
              formatter={(value: number) => formatZAR(value)}
              labelStyle={{ fontSize: 12 }}
            />
            <Bar
              dataKey="collected"
              name="Received"
              fill="hsl(var(--primary))"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="outstanding"
              name="Balance due"
              fill="hsl(var(--muted-foreground) / 0.35)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
