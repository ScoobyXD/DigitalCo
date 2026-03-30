# Photo Saver PWA

A lightweight Progressive Web App for iPhone that lets you:

- Open your camera and take a picture.
- Keep photos saved locally on your phone (inside browser storage).
- Share/download each photo so you can save it into the iOS Photos app.

## Run locally

Because camera + service worker require a real origin, run from a local server:

```bash
python3 -m http.server 4173
```

Then visit `http://localhost:4173`.

## Install on iPhone

1. Open the hosted app URL in Safari on iPhone.
2. Tap **Share** → **Add to Home Screen**.
3. Open the installed app, tap **Open Camera**, and allow camera access.
4. Take a photo.
5. Tap **Share / Save** and choose **Save Image** (or use Download fallback).

## Notes

- Captured photos persist in this app using localStorage on the device.
- If Safari storage is cleared, saved images are removed.
- For long-term storage in Photos, always use Share/Save per image.
