import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface TokenHistoryItem {
  date: string;
  tokens: number;
  analyses: number;
}

export function useTokenHistory(userId: string | undefined) {
  return useQuery({
    queryKey: ['token-history', userId],
    queryFn: async (): Promise<TokenHistoryItem[]> => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('analysis_usage')
        .select('created_at, tokens_estimated')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Aggregate by date
      const aggregated = (data || []).reduce<Record<string, { tokens: number; analyses: number }>>((acc, item) => {
        const date = new Date(item.created_at || '').toISOString().split('T')[0];
        if (!acc[date]) {
          acc[date] = { tokens: 0, analyses: 0 };
        }
        acc[date].tokens += item.tokens_estimated || 0;
        acc[date].analyses += 1;
        return acc;
      }, {});

      return Object.entries(aggregated).map(([date, values]) => ({
        date,
        tokens: values.tokens,
        analyses: values.analyses,
      }));
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
