const fileInput = document.getElementById("videoFile");
const captionInput = document.getElementById("caption");
const uploadBtn = document.getElementById("uploadBtn");
const status = document.getElementById("uploadStatus");
const preview = document.getElementById("preview");

let selectedFile = null;

fileInput.addEventListener("change", () => {
  selectedFile = fileInput.files?.[0] || null;

  if (!selectedFile) {
    preview.hidden = true;
    preview.removeAttribute("src");
    return;
  }

  preview.src = URL.createObjectURL(selectedFile);
  preview.hidden = false;
});

uploadBtn.addEventListener("click", async () => {
  if (!selectedFile) {
    status.textContent = "Choose a video first.";
    return;
  }

  try {
    uploadBtn.disabled = true;
    uploadBtn.textContent = "Uploading...";
    status.textContent = "Checking your Beyond account...";

    const { data: { user }, error: authError } =
      await supabaseClient.auth.getUser();

    if (authError) throw authError;

    if (!user) {
      status.textContent = "Please log in before uploading.";
      uploadBtn.disabled = false;
      uploadBtn.textContent = "Upload Video";
      return;
    }

    const maxSize = 100 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      throw new Error("Video must be 100 MB or smaller.");
    }

    const extension = selectedFile.name.split(".").pop()?.toLowerCase() || "mp4";
    const storagePath = user.id + "/" + crypto.randomUUID() + "." + extension;

    status.textContent = "Uploading video to Beyond Storage...";

    const { error: storageError } = await supabaseClient.storage
      .from("videos")
      .upload(storagePath, selectedFile, {
        cacheControl: "3600",
        contentType: selectedFile.type || "video/mp4",
        upsert: false
      });

    if (storageError) throw storageError;

    const { data: publicData } = supabaseClient.storage
      .from("videos")
      .getPublicUrl(storagePath);

    const videoUrl = publicData.publicUrl;

    status.textContent = "Saving video information...";

    const { error: dbError } = await supabaseClient
      .from("videos")
      .insert({
        user_id: user.id,
        video_url: videoUrl,
        storage_path: storagePath,
        caption: captionInput.value.trim()
      });

    if (dbError) {
      await supabaseClient.storage.from("videos").remove([storagePath]);
      throw dbError;
    }

    status.textContent = "Uploaded successfully!";
    uploadBtn.textContent = "Uploaded ✓";

    setTimeout(() => {
      window.location.href = "index.html";
    }, 900);
  } catch (error) {
    console.error(error);
    status.textContent = error.message || "Upload failed.";
    uploadBtn.disabled = false;
    uploadBtn.textContent = "Upload Video";
  }
});
