import { useState } from "react";
import { GraduationCap, Plus, Pencil, Trash2, Play, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthenticationContext";
import { isAdminOrAccountOwner } from "@/utils/permissionUtils";
import { useTrainingVideos, TrainingVideo } from "@/hooks/useTrainingVideos";
import { useToast } from "@/hooks/use-toast";

/** Extract Google Drive file ID from various link formats */
function extractDriveFileId(input: string): string | null {
  // Already a raw ID (no slashes or dots)
  if (/^[\w-]{20,}$/.test(input.trim())) return input.trim();
  // Standard share/preview/view links
  const match = input.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

const Training = () => {
  const { user } = useAuth();
  const isAdmin = isAdminOrAccountOwner(user?.staffAttributes?.staffRoleCodes);
  const { videos, loading, addVideo, addingVideo, updateVideo, updatingVideo, deleteVideo, deletingVideo } = useTrainingVideos();
  const { toast } = useToast();

  const [selectedVideo, setSelectedVideo] = useState<TrainingVideo | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<TrainingVideo | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [driveLink, setDriveLink] = useState("");

  // Auto-select first video when loaded
  if (!selectedVideo && videos.length > 0) {
    setSelectedVideo(videos[0]);
  }

  const openAddDialog = () => {
    setEditingVideo(null);
    setTitle("");
    setDescription("");
    setDriveLink("");
    setDialogOpen(true);
  };

  const openEditDialog = (video: TrainingVideo) => {
    setEditingVideo(video);
    setTitle(video.title);
    setDescription(video.description ?? "");
    setDriveLink(`https://drive.google.com/file/d/${video.drive_file_id}/view`);
    setDialogOpen(true);
  };

  const openDeleteDialog = (videoId: string) => {
    setDeletingId(videoId);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async () => {
    const fileId = extractDriveFileId(driveLink);
    if (!fileId) {
      toast({ variant: "destructive", title: "Invalid link", description: "Please paste a valid Google Drive share link." });
      return;
    }
    if (!title.trim()) {
      toast({ variant: "destructive", title: "Title required", description: "Please enter a video title." });
      return;
    }

    if (editingVideo) {
      await updateVideo({ id: editingVideo.id, title: title.trim(), description: description.trim() || null, drive_file_id: fileId } as any);
    } else {
      await addVideo({ title: title.trim(), description: description.trim() || null, drive_file_id: fileId, sort_order: videos.length, is_active: true } as any);
    }
    setDialogOpen(false);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    await deleteVideo(deletingId);
    if (selectedVideo?.id === deletingId) setSelectedVideo(null);
    setDeleteDialogOpen(false);
    setDeletingId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight">Training</h1>
        </div>
        {isAdmin && (
          <Button onClick={openAddDialog} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Add Video
          </Button>
        )}
      </div>

      {/* Video Player */}
      {selectedVideo ? (
        <Card className="overflow-hidden">
          <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
            <iframe
              key={selectedVideo.id}
              src={`https://drive.google.com/file/d/${selectedVideo.drive_file_id}/preview`}
              className="absolute inset-0 w-full h-full border-0"
              allow="autoplay; encrypted-media"
              allowFullScreen
              title={selectedVideo.title}
            />
          </div>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-lg">{selectedVideo.title}</CardTitle>
            {selectedVideo.description && (
              <CardDescription>{selectedVideo.description}</CardDescription>
            )}
          </CardHeader>
        </Card>
      ) : !loading ? (
        <Card className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Video className="h-12 w-12 mb-3 opacity-40" />
          <p className="text-sm">
            {videos.length === 0
              ? isAdmin
                ? 'No training videos yet. Click "Add Video" to get started.'
                : "No training videos available yet."
              : "Select a video below to watch."}
          </p>
        </Card>
      ) : null}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      )}

      {/* Video Grid */}
      {videos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {videos.map((video) => {
            const isSelected = selectedVideo?.id === video.id;
            return (
              <Card
                key={video.id}
                className={`cursor-pointer transition-all hover:shadow-md ${isSelected ? "ring-2 ring-primary shadow-md" : ""}`}
                onClick={() => setSelectedVideo(video)}
              >
                {/* Thumbnail placeholder */}
                <div className="relative bg-muted aspect-video flex items-center justify-center rounded-t-lg">
                  <Play className={`h-10 w-10 ${isSelected ? "text-primary" : "text-muted-foreground/50"}`} />
                </div>
                <CardContent className="p-3">
                  <p className="font-medium text-sm truncate">{video.title}</p>
                  {video.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{video.description}</p>
                  )}
                  {isAdmin && (
                    <div className="flex gap-1 mt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={(e) => { e.stopPropagation(); openEditDialog(video); }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); openDeleteDialog(video.id); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingVideo ? "Edit Video" : "Add Training Video"}</DialogTitle>
            <DialogDescription>
              {editingVideo
                ? "Update the video details below."
                : "Paste a Google Drive share link for a video that is set to 'Anyone with the link can view'."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Onboarding Overview" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of the video" rows={2} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="driveLink">Google Drive Link</Label>
              <Input id="driveLink" value={driveLink} onChange={(e) => setDriveLink(e.target.value)} placeholder="https://drive.google.com/file/d/.../view?usp=sharing" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={addingVideo || updatingVideo}>
              {editingVideo ? "Save Changes" : "Add Video"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Video</DialogTitle>
            <DialogDescription>Are you sure you want to delete this training video? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deletingVideo}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Training;
