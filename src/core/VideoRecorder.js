export class VideoRecorder {
  constructor(canvas) {
    this._canvas = canvas;
    this._mediaRecorder = null;
    this._chunks = [];
    this._recording = false;
    this._onStatusChange = null;
  }

  get isRecording() {
    return this._recording;
  }

  onStatusChange(fn) {
    this._onStatusChange = fn;
  }

  start() {
    if (this._recording) return;

    const mimeType = this._getSupportedMimeType();
    if (!mimeType) {
      console.error('[VideoRecorder] No supported video MIME type found.');
      return;
    }

    const stream = this._canvas.captureStream(60);
    this._mediaRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
    this._chunks = [];

    this._mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this._chunks.push(e.data);
    };

    this._mediaRecorder.onstop = () => this._save(mimeType);

    this._mediaRecorder.start(100); // collect in 100ms chunks
    this._recording = true;
    this._onStatusChange?.(true);
  }

  stop() {
    if (!this._recording || !this._mediaRecorder) return;
    this._mediaRecorder.stop();
    this._recording = false;
    this._onStatusChange?.(false);
  }

  toggle() {
    this._recording ? this.stop() : this.start();
  }

  _getSupportedMimeType() {
    const candidates = [
      'video/mp4;codecs=h264',
      'video/mp4',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ];
    return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? null;
  }

  _save(mimeType) {
    const ext = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
    const blob = new Blob(this._chunks, { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `teach-ai-love-${Date.now()}.${ext}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}
