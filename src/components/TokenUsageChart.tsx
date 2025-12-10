import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zap } from "lucide-react";

interface TokenHistoryItem {
  date: string;
  tokens: number;
  analyses: number;
}

interface TokenUsageChartProps {
  data: TokenHistoryItem[];
  period: "week" | "month";
  onPeriodChange: (period: "week" | "month") => void;
  isLoading?: boolean;
}

export function TokenUsageChart({ 
  data, 
  period, 
  onPeriodChange,
  isLoading = false 
}: TokenUsageChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    const sortedData = [...data].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Filter by period
    const now = new Date();
    const cutoff = period === "week" 
      ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return sortedData
      .filter(item => new Date(item.date) >= cutoff)
      .map(item => ({
        ...item,
        date: new Date(item.date).toLocaleDateString('pt-BR', { 
          day: '2-digit', 
          month: '2-digit' 
        }),
        tokensK: Math.round(item.tokens / 1000),
      }));
  }, [data, period]);

  const totalTokens = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.tokens, 0);
  }, [chartData]);

  const totalAnalyses = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.analyses, 0);
  }, [chartData]);

  if (isLoading) {
    return (
      <div className="p-6 bg-card border border-border rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Consumo de Tokens</h3>
          </div>
        </div>
        <div className="h-[200px] flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Carregando...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-card border border-border rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Consumo de Tokens</h3>
        </div>
        <Tabs value={period} onValueChange={(v) => onPeriodChange(v as "week" | "month")}>
          <TabsList className="h-8">
            <TabsTrigger value="week" className="text-xs px-2 h-6">7 dias</TabsTrigger>
            <TabsTrigger value="month" className="text-xs px-2 h-6">30 dias</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="p-3 bg-muted/30 rounded-lg">
          <p className="text-xs text-muted-foreground">Total no período</p>
          <p className="text-lg font-bold">{(totalTokens / 1000).toFixed(1)}K tokens</p>
        </div>
        <div className="p-3 bg-muted/30 rounded-lg">
          <p className="text-xs text-muted-foreground">Análises</p>
          <p className="text-lg font-bold">{totalAnalyses}</p>
        </div>
      </div>

      {/* Chart */}
      {chartData.length === 0 ? (
        <div className="h-[200px] flex items-center justify-center text-muted-foreground">
          <p className="text-sm">Nenhum dado disponível para o período</p>
        </div>
      ) : (
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="hsl(var(--border))" 
                vertical={false}
              />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}K`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(value: number) => [`${value}K tokens`, 'Consumo']}
              />
              <Area
                type="monotone"
                dataKey="tokensK"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorTokens)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
