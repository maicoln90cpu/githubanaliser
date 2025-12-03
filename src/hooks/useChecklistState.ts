import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface ChecklistItem {
  item_hash: string;
  is_completed: boolean;
}

export const useChecklistState = (analysisId: string | undefined) => {
  const { user } = useAuth();
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);

  // Load checklist state from database
  const loadChecklistState = useCallback(async () => {
    if (!user || !analysisId) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_checklist_items')
        .select('item_hash, is_completed')
        .eq('user_id', user.id)
        .eq('analysis_id', analysisId);

      if (error) throw error;

      const completed = new Set(
        data?.filter(item => item.is_completed).map(item => item.item_hash) || []
      );
      setCompletedItems(completed);
    } catch (error) {
      console.error('Error loading checklist state:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, analysisId]);

  useEffect(() => {
    loadChecklistState();
  }, [loadChecklistState]);

  // Toggle item completion
  const toggleItem = useCallback(async (itemHash: string) => {
    if (!user || !analysisId) return;

    const isCurrentlyCompleted = completedItems.has(itemHash);
    const newCompletedItems = new Set(completedItems);

    if (isCurrentlyCompleted) {
      newCompletedItems.delete(itemHash);
    } else {
      newCompletedItems.add(itemHash);
    }
    setCompletedItems(newCompletedItems);

    try {
      // Upsert the checklist item
      const { error } = await supabase
        .from('user_checklist_items')
        .upsert({
          user_id: user.id,
          analysis_id: analysisId,
          item_hash: itemHash,
          is_completed: !isCurrentlyCompleted,
          completed_at: !isCurrentlyCompleted ? new Date().toISOString() : null,
        }, {
          onConflict: 'user_id,analysis_id,item_hash'
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error saving checklist state:', error);
      // Revert on error
      if (isCurrentlyCompleted) {
        newCompletedItems.add(itemHash);
      } else {
        newCompletedItems.delete(itemHash);
      }
      setCompletedItems(newCompletedItems);
    }
  }, [user, analysisId, completedItems]);

  // Check if item is completed
  const isItemCompleted = useCallback((itemHash: string) => {
    return completedItems.has(itemHash);
  }, [completedItems]);

  // Calculate progress
  const completedCount = completedItems.size;
  const progress = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

  return {
    completedItems,
    completedCount,
    totalItems,
    setTotalItems,
    progress,
    isLoading,
    toggleItem,
    isItemCompleted,
    refresh: loadChecklistState,
  };
};
