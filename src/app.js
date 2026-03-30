const DB_KEY = "photo-saver-images-v1";

const preview = document.getElementById("preview");
const canvas = document.getElementById("canvas");
const photosEl = document.getElementById("photos");
const template = document.getElementById("photo-template");

const startBtn = document.getElementById("startCamera");
const captureBtn = document.getElementById("capturePhoto");
const switchBtn = document.getElementById("switchCamera");

let stream = null;
let facingMode = "environment";
let photos = loadPhotos();

renderPhotos();
registerServiceWorker();

startBtn.addEventListener("click", () => startCamera());
captureBtn.addEventListener("click", capturePhoto);
switchBtn.addEventListener("click", async () => {
  facingMode = facingMode === "environment" ? "user" : "environment";
  await startCamera();
});

async function startCamera() {
  try {
    if (stream) stream.getTracks().forEach((track) => track.stop());

    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1080 },
        height: { ideal: 1440 }
      },
      audio: false
    });

    preview.srcObject = stream;
    captureBtn.disabled = false;
    switchBtn.disabled = false;
  } catch (error) {
    alert("Camera access failed. Please allow camera access in Safari settings.");
    console.error(error);
  }
}

function capturePhoto() {
  if (!stream) return;
  const track = stream.getVideoTracks()[0];
  const settings = track.getSettings();

  canvas.width = settings.width || preview.videoWidth || 1080;
  canvas.height = settings.height || preview.videoHeight || 1440;

  const context = canvas.getContext("2d");
  context.drawImage(preview, 0, 0, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

  photos.unshift({
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    dataUrl
  });

  persistPhotos();
  renderPhotos();
}

function renderPhotos() {
  photosEl.textContent = "";

  if (!photos.length) {
    photosEl.innerHTML = `<p class="hint">No photos yet. Open camera and take your first one.</p>`;
    return;
  }

  for (const item of photos) {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector(".photo-item");
    const image = fragment.querySelector("img");
    const shareBtn = fragment.querySelector('[data-action="share"]');
    const downloadLink = fragment.querySelector('[data-action="download"]');
    const removeBtn = fragment.querySelector('[data-action="remove"]');

    image.src = item.dataUrl;
    downloadLink.href = item.dataUrl;
    downloadLink.download = `photo-${new Date(item.createdAt).toISOString().replaceAll(":", "-")}.jpg`;

    shareBtn.addEventListener("click", async () => {
      const file = dataUrlToFile(item.dataUrl, `photo-${Date.now()}.jpg`);

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: "Photo Saver",
          text: "Save this photo to Photos",
          files: [file]
        });
        return;
      }

      alert("Use the Download button, then open the image and tap Share → Save Image.");
    });

    removeBtn.addEventListener("click", () => {
      photos = photos.filter((photo) => photo.id !== item.id);
      persistPhotos();
      renderPhotos();
    });

    photosEl.appendChild(card);
  }
}

function dataUrlToFile(dataUrl, fileName) {
  const [meta, content] = dataUrl.split(",");
  const mime = meta.match(/data:(.*);base64/)[1];
  const bytes = atob(content);
  const buffer = new Uint8Array(bytes.length);

  for (let i = 0; i < bytes.length; i += 1) {
    buffer[i] = bytes.charCodeAt(i);
  }

  return new File([buffer], fileName, { type: mime });
}

function loadPhotos() {
  try {
    return JSON.parse(localStorage.getItem(DB_KEY) || "[]");
  } catch {
    return [];
  }
}

function persistPhotos() {
  localStorage.setItem(DB_KEY, JSON.stringify(photos));
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("/sw.js");
  } catch (error) {
    console.error("Service worker registration failed", error);
  }
}
