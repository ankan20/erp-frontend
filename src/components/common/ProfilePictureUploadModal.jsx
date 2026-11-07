"use client";

import { useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import FileUpload from "@/components/common/FileUpload";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";

// Same limits as the backend (/auth/profile-picture)
const ACCEPT_PROFILE = ".jpg,.jpeg,.png,.webp";
const TYPES_PROFILE = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

// Upload / replace the logged-in user's profile picture. Available to every user.
export default function ProfilePictureUploadModal({ open, onOpenChange }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const close = (next) => {
    if (uploading) return;
    if (!next) {
      setFile(null);
      setResetKey((k) => k + 1);
    }
    onOpenChange?.(next);
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please choose a photo first");
      return;
    }
    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    try {
      const res = await apiRequest({
        url: API_ENDPOINTS.UPLOAD_PROFILE_PICTURE,
        method: "POST",
        data: formData,
      });
      if (!res) return; // session expired — apiClient redirects to login
      toast.success(res.message || "Profile picture updated");
      setUploading(false);
      close(false);
    } catch (err) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Upload Profile Photo</DialogTitle>
          <DialogDescription>JPG, PNG or WEBP — up to 5 MB.</DialogDescription>
        </DialogHeader>

        <FileUpload
          title="Profile Photo"
          accept={ACCEPT_PROFILE}
          allowedTypes={TYPES_PROFILE}
          maxSize={MAX_SIZE}
          showImagePreview
          required
          resetKey={resetKey}
          disabled={uploading}
          onChange={setFile}
        />

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => close(false)}
            disabled={uploading}
            className="h-[32px] px-4 border border-gray-300 hover:bg-gray-100 rounded-sm text-[13px] disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={!file || uploading}
            className="h-[32px] px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-sm text-[13px] disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
