import { useSupabaseQuery } from '@/hooks/data/useSupabaseQuery';
import { useSupabaseInsert, useSupabaseUpdate, useSupabaseDelete } from '@/hooks/data/useSupabaseMutation';

export interface TrainingVideo {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  drive_file_id: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export function useTrainingVideos() {
  const { data, loading, error, refetch } = useSupabaseQuery<TrainingVideo>({
    table: 'training_videos',
    select: '*',
    filters: { is_active: true },
    orderBy: { column: 'sort_order', ascending: true },
  });

  const insertMutation = useSupabaseInsert<Omit<TrainingVideo, 'id' | 'tenant_id' | 'created_at' | 'updated_at' | 'created_by'>>({
    table: 'training_videos',
    userIdColumn: 'created_by',
    successMessage: 'Training video added successfully',
    onSuccess: () => refetch(),
  });

  const updateMutation = useSupabaseUpdate<Partial<TrainingVideo>>({
    table: 'training_videos',
    successMessage: 'Training video updated successfully',
    onSuccess: () => refetch(),
  });

  const deleteMutation = useSupabaseDelete({
    table: 'training_videos',
    successMessage: 'Training video deleted successfully',
    onSuccess: () => refetch(),
  });

  return {
    videos: data ?? [],
    loading,
    error,
    refetch,
    addVideo: insertMutation.mutate,
    addingVideo: insertMutation.loading,
    updateVideo: updateMutation.mutate,
    updatingVideo: updateMutation.loading,
    deleteVideo: deleteMutation.mutate,
    deletingVideo: deleteMutation.loading,
  };
}
