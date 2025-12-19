import { ArrowUp, ArrowDown } from 'lucide-react';
import { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  trend?: number;
  tags?: string[];
  highlight?: boolean;
  icon?: ReactNode;
}

export function StatCard({ title, value, trend, tags, highlight = false, icon }: StatCardProps) {
  const isPositive = trend && trend > 0;
  
  return (
    <div className={highlight ? 'stat-card-highlight' : 'stat-card'}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        {icon}
      </div>
      
      <div className="text-4xl font-bold text-foreground mb-2">{value}</div>
      
      {trend !== undefined && (
        <div className={`flex items-center gap-1 text-sm ${isPositive ? 'text-success' : 'text-destructive'}`}>
          {isPositive ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
          <span>{isPositive ? '+' : ''}{trend}%</span>
        </div>
      )}
      
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {tags.map((tag, index) => (
            <span key={index} className="pill pill-warning">{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
}
