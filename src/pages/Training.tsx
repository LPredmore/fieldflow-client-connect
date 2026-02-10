import { useState, useRef } from "react";
import { GraduationCap, Plus, Pencil, Trash2, Play, Video, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthenticationContext";
import { useTrainingVideos, TrainingVideo } from "@/hooks/useTrainingVideos";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

/** Extract Google Drive file ID from various link formats */
function extractDriveFileId(input: string): string | null {
  if (/^[\w-]{20,}$/.test(input.trim())) return input.trim();
  const match = input.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

const Training = () => {
  const { isAdmin } = useAuth();
  const { videos, loading, addVideo, addingVideo, updateVideo, updatingVideo, deleteVideo, deletingVideo } = useTrainingVideos();
  const { toast } = useToast();

  const [playingVideo, setPlayingVideo] = useState<TrainingVideo | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<TrainingVideo | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [driveLink, setDriveLink] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openAddDialog = () => {
    setEditingVideo(null);
    setTitle("");
    setDescription("");
    setDriveLink("");
    setCoverFile(null);
    setCoverPreview(null);
    setDialogOpen(true);
  };

  const openEditDialog = (video: TrainingVideo) => {
    setEditingVideo(video);
    setTitle(video.title);
    setDescription(video.description ?? "");
    setDriveLink(`https://drive.google.com/file/d/${video.drive_file_id}/view`);
    setCoverFile(null);
    setCoverPreview(video.cover_image_url ?? null);
    setDialogOpen(true);
  };

  const openDeleteDialog = (videoId: string) => {
    setDeletingId(videoId);
    setDeleteDialogOpen(true);
  };

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const clearCover = () => {
    setCoverFile(null);
    setCoverPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadCoverImage = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("training-covers").upload(path, file);
    if (error) {
      toast({ variant: "destructive", title: "Upload failed", description: error.message });
      return null;
    }
    const { data } = supabase.storage.from("training-covers").getPublicUrl(path);
    return data.publicUrl;
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

    setUploadingCover(true);
    let coverUrl: string | null = coverPreview;

    if (coverFile) {
      coverUrl = await uploadCoverImage(coverFile);
      if (!coverUrl) {
        setUploadingCover(false);
        return;
      }
    }

    if (editingVideo) {
      await updateVideo({ id: editingVideo.id, title: title.trim(), description: description.trim() || null, drive_file_id: fileId, cover_image_url: coverUrl } as any);
    } else {
      await addVideo({ title: title.trim(), description: description.trim() || null, drive_file_id: fileId, sort_order: videos.length, is_active: true, cover_image_url: coverUrl } as any);
    }
    setUploadingCover(false);
    setDialogOpen(false);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    await deleteVideo(deletingId);
    if (playingVideo?.id === deletingId) setPlayingVideo(null);
    setDeleteDialogOpen(false);
    setDeletingId(null);
  };

  const isBusy = addingVideo || updatingVideo || uploadingCover;

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

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      )}

      {/* Empty state */}
      {!loading && videos.length === 0 && (
        <Card className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Video className="h-12 w-12 mb-3 opacity-40" />
          <p className="text-sm">
            {isAdmin
              ? 'No training videos yet. Click "Add Video" to get started.'
              : "No training videos available yet."}
          </p>
        </Card>
      )}

      {/* Video Grid */}
      {videos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {videos.map((video) => (
            <Card
              key={video.id}
              className="cursor-pointer transition-all hover:shadow-md group"
              onClick={() => setPlayingVideo(video)}
            >
              {/* Thumbnail */}
              <div className="relative aspect-video rounded-t-lg overflow-hidden bg-muted flex items-center justify-center">
                {video.cover_image_url ? (
                  <img
                    src={video.cover_image_url}
                    alt={video.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Play className="h-10 w-10 text-muted-foreground/50" />
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <Play className="h-10 w-10 text-white opacity-0 group-hover:opacity-80 transition-opacity drop-shadow-lg" />
                </div>
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
          ))}
        </div>
      )}

      {/* Video Player Dialog */}
      <Dialog open={!!playingVideo} onOpenChange={(open) => { if (!open) setPlayingVideo(null); }}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          {playingVideo && (
            <>
              <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                <iframe
                  key={playingVideo.id}
                  src={`https://drive.google.com/file/d/${playingVideo.drive_file_id}/preview`}
                  className="absolute inset-0 w-full h-full border-0"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                  title={playingVideo.title}
                />
              </div>
              <div className="px-6 pb-5 pt-3">
                <DialogTitle className="text-lg">{playingVideo.title}</DialogTitle>
                {playingVideo.description && (
                  <DialogDescription className="mt-1">{playingVideo.description}</DialogDescription>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

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
            <div className="space-y-2">
              <Label>Cover Image (optional)</Label>
              {coverPreview ? (
                <div className="relative w-full aspect-video rounded-md overflow-hidden border bg-muted">
                  <img src={coverPreview} alt="Cover preview" className="w-full h-full object-cover" />
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2 h-7 w-7 p-0"
                    onClick={clearCover}
                    type="button"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center w-full aspect-video rounded-md border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors bg-muted/30 cursor-pointer"
                >
                  <Upload className="h-8 w-8 text-muted-foreground/50 mb-1" />
                  <span className="text-xs text-muted-foreground">Click to upload a cover image</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCoverSelect}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isBusy}>
              {isBusy ? "Saving…" : editingVideo ? "Save Changes" : "Add Video"}
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
