import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { useDownloadStore, SpeedPoint } from '../store/downloadStore';
import styles from './SpeedGraph.module.css';

function formatSpeed(bps: number): string {
  if (bps >= 1024 * 1024) return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
  if (bps >= 1024) return `${(bps / 1024).toFixed(0)} KB/s`;
  return `${bps} B/s`;
}

function speedToMbps(bps: number): number {
  return parseFloat((bps / (1024 * 1024)).toFixed(3));
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: {value: number}[] }) => {
  if (active && payload && payload.length) {
    const bps = Math.round(payload[0].value * 1024 * 1024);
    return (
      <div className={styles.tooltip}>
        {formatSpeed(bps)}
      </div>
    );
  }
  return null;
};

export const SpeedGraph: React.FC = () => {
  const { speedHistory, tasks } = useDownloadStore();

  const activeCount = tasks.filter((t) => t.status === 'downloading').length;
  const currentSpeed = tasks
    .filter((t) => t.status === 'downloading')
    .reduce((s, t) => s + t.speedBytesPerSec, 0);

  const data = useMemo(() => {
    if (speedHistory.length === 0) return [];
    const oldest = speedHistory[0].timestamp;
    return speedHistory.map((p: SpeedPoint) => ({
      t: Math.round((p.timestamp - oldest) / 1000),
      speed: speedToMbps(p.speedBytesPerSec),
    }));
  }, [speedHistory]);

  const maxY = useMemo(() => {
    const peak = Math.max(...data.map((d) => d.speed), 0.01);
    return Math.ceil(peak * 1.3 * 10) / 10;
  }, [data]);

  return (
    <div className={`glass-panel ${styles.card}`}>
      <div className={styles.header}>
        <div className={styles.title}>
          <TrendingUp size={15} />
          <span>Download Speed</span>
        </div>
        <div className={styles.speed}>{formatSpeed(currentSpeed)}</div>
      </div>

      {activeCount === 0 && data.length === 0 ? (
        <div className={styles.idle}>No active downloads</div>
      ) : (
        <ResponsiveContainer width="100%" height={120}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="speedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="t" hide />
            <YAxis domain={[0, maxY]} tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(v) => `${v}M`} />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="speed"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#speedGrad)"
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};
