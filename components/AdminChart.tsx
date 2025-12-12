import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface AdminChartProps {
    data: { name: string; count: number }[];
}

export const AdminChart: React.FC<AdminChartProps> = ({ data }) => {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
          <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
          <Tooltip 
            cursor={{fill: '#f1f5f9'}}
            contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
             {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill="#3b82f6" />
              ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};