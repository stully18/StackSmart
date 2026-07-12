'use client';

import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  ChartOptions,
} from 'chart.js';
import { FactorBreakdown, FACTOR_KEYS, FACTOR_LABELS } from './types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

interface FactorBreakdownChartProps {
  factorBreakdown: FactorBreakdown;
}

export default function FactorBreakdownChart({ factorBreakdown }: FactorBreakdownChartProps) {
  const contributions = FACTOR_KEYS.map((key) => factorBreakdown[key].weighted_contribution);

  const chartData = {
    labels: FACTOR_KEYS.map((key) => FACTOR_LABELS[key]),
    datasets: [
      {
        data: contributions,
        backgroundColor: contributions.map((value) =>
          value >= 0 ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)'
        ),
        borderRadius: 4,
      },
    ],
  };

  const options: ChartOptions<'bar'> = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(2, 6, 23, 0.95)',
        titleColor: 'rgb(248, 250, 252)',
        bodyColor: 'rgb(148, 163, 184)',
        borderColor: 'rgb(51, 65, 85)',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: (context) => `Weighted contribution: ${(context.parsed.x ?? 0).toFixed(3)}`,
        },
      },
    },
    scales: {
      x: {
        ticks: { color: 'rgb(100, 116, 139)' },
        grid: { color: 'rgba(51, 65, 85, 0.3)' },
      },
      y: {
        ticks: { color: 'rgb(148, 163, 184)' },
        grid: { display: false },
      },
    },
  };

  return (
    <div style={{ height: `${FACTOR_KEYS.length * 44 + 20}px` }}>
      <Bar data={chartData} options={options} />
    </div>
  );
}
