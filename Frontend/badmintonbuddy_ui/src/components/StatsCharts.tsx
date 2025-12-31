// src/components/StatsCharts.tsx
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

type Props = {
  wins: number;
  total: number;
};

export default function StatsCharts({ wins, total }: Props) {
  const losses = Math.max(total - wins, 0);

  const data = [
    { name: "Wins", value: wins },
    { name: "Losses", value: losses },
  ];

  const COLORS = ["#22c55e", "#ef4444"]; // green, red

  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={65}
            paddingAngle={5}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      <div className="mt-2 flex justify-center gap-4 text-xs text-slate-300">
        <span className="text-green-400">Wins: {wins}</span>
        <span className="text-red-400">Losses: {losses}</span>
      </div>
    </div>
  );
}

