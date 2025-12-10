import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Project {
  id: string;
  name: string;
  github_url: string;
  created_at: string;
  analysis_status: string | null;
}

interface RecentActivity {
  id: string;
  type: 'project' | 'analysis' | 'checklist';
  description: string;
  timestamp: string;
  projectName?: string;
}

interface ChecklistStats {
  completed: number;
  total: number;
}

interface DashboardData {
  projects: Project[];
  recentActivities: RecentActivity[];
  checklistStats: ChecklistStats;
  totalTokens: number;
}

export function useDashboardData(userId: string | undefined) {
  const queryClient = useQueryClient();

  // Consolidated dashboard query using RPC
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard-data', userId],
    queryFn: async (): Promise<DashboardData> => {
      if (!userId) throw new Error("User not authenticated");

      const { data, error } = await supabase.rpc('get_dashboard_data', {
        p_user_id: userId
      });

      if (error) throw error;

      // Type cast the response safely
      const result = data as unknown as {
        projects: Project[];
        recentActivities: RecentActivity[];
        checklistStats: { total: number; completed: number };
        totalTokens: number;
      };

      return {
        projects: result?.projects || [],
        recentActivities: result?.recentActivities || [],
        checklistStats: {
          completed: result?.checklistStats?.completed || 0,
          total: result?.checklistStats?.total || 0
        },
        totalTokens: result?.totalTokens || 0
      };
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
    gcTime: 1000 * 60 * 10, // 10 minutes garbage collection
    refetchOnWindowFocus: true,
  });

  // Supabase Realtime subscription for project status updates
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('dashboard-projects')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('Project update received:', payload);
          // Invalidate and refetch dashboard data
          queryClient.invalidateQueries({ queryKey: ['dashboard-data', userId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return {
    projects: data?.projects || [],
    recentActivities: data?.recentActivities || [],
    checklistStats: data?.checklistStats || { completed: 0, total: 0 },
    totalTokens: data?.totalTokens || 0,
    isLoading,
    error,
    refetch
  };
}
