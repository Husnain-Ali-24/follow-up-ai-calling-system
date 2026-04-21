import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { DUMMY_CALL_VOLUME } from '../../data/dummy/dashboard.dummy';

export default function CallVolumeChart() {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={DUMMY_CALL_VOLUME} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e1e2e" />
        <XAxis 
          dataKey="date" 
          axisLine={false} 
          tickLine={false} 
          tick={{ fill: '#55556a', fontSize: 12 }}
          dy={10}
        />
        <YAxis 
          axisLine={false} 
          tickLine={false} 
          tick={{ fill: '#55556a', fontSize: 12 }}
        />
        <Tooltip 
          contentStyle={{ backgroundColor: '#16161f', border: '1px solid #2a2a3d', borderRadius: '8px' }}
          itemStyle={{ fontSize: '13px' }}
        />
        <Legend 
          verticalAlign="top" 
          align="right" 
          iconType="circle"
          wrapperStyle={{ paddingBottom: '20px' }}
        />
        <Bar dataKey="completed" name="Completed" fill="#22c55e" radius={[4, 4, 0, 0]} />
        <Bar dataKey="failed" name="Failed" fill="#ef4444" radius={[4, 4, 0, 0]} />
        <Bar dataKey="rescheduled" name="Rescheduled" fill="#f59e0b" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
