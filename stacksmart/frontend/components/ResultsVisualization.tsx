'use client';

import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ResultsVisualizationProps {
  monthlyBreakdown: Array<{
    month: number;
    debt_path_net_worth: number;
    invest_path_net_worth: number;
  }>;
  recommendation: string;
}

export default function ResultsVisualization({
  monthlyBreakdown,
  recommendation
}: ResultsVisualizationProps) {
  const chartData = {
    labels: monthlyBreakdown.map(d => d.month % 6 === 0 ? `Month ${d.month}` : ''),
    datasets: [
      {
        label: 'Pay Debt Strategy',
        data: monthlyBreakdown.map(d => d.debt_path_net_worth),
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.05)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 5
      },
      {
        label: 'Invest Strategy',
        data: monthlyBreakdown.map(d => d.invest_path_net_worth),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.05)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 5
      }
    ]
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: 'rgb(148, 163, 184)',
          font: {
            size: 13,
            weight: 'normal'
          },
          padding: 20,
          usePointStyle: true
        }
      },
      title: {
        display: true,
        text: 'Net Worth Projection Over Time',
        color: 'rgb(248, 250, 252)',
        font: {
          size: 16,
          weight: 'normal'
        },
        padding: {
          bottom: 20
        }
      },
      tooltip: {
        backgroundColor: 'rgba(2, 6, 23, 0.95)',
        titleColor: 'rgb(248, 250, 252)',
        bodyColor: 'rgb(148, 163, 184)',
        borderColor: 'rgb(51, 65, 85)',
        borderWidth: 1,
        padding: 12,
        displayColors: true,
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            label += new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD'
            }).format(context.parsed.y ?? 0);
            return label;
          }
        }
      }
    },
    scales: {
      y: {
        ticks: {
          color: 'rgb(100, 116, 139)',
          callback: function(value) {
            return '$' + Number(value).toLocaleString();
          }
        },
        grid: {
          color: 'rgba(51, 65, 85, 0.3)'
        }
      },
      x: {
        ticks: {
          color: 'rgb(100, 116, 139)',
          maxTicksLimit: 12
        },
        grid: {
          color: 'rgba(51, 65, 85, 0.3)'
        }
      }
    }
  };

  return (
    <div className="bg-surface p-6 rounded-xl border border-border-subtle h-full flex flex-col">
      <div className="flex-1 min-h-0">
        <Line data={chartData} options={options} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="p-3 bg-surface-elevated/50 border border-border-subtle rounded-lg">
          <div className="text-xs text-text-muted mb-1">Pay Debt Path</div>
          <div className="text-lg font-semibold text-destructive">
            {new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 0
            }).format(monthlyBreakdown[monthlyBreakdown.length - 1].debt_path_net_worth)}
          </div>
        </div>
        <div className="p-3 bg-surface-elevated/50 border border-border-subtle rounded-lg">
          <div className="text-xs text-text-muted mb-1">Invest Path</div>
          <div className="text-lg font-semibold text-success">
            {new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 0
            }).format(monthlyBreakdown[monthlyBreakdown.length - 1].invest_path_net_worth)}
          </div>
        </div>
      </div>
    </div>
  );
}
