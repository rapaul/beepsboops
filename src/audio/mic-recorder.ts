import { beginMicSession, endMicSession } from './context';

export interface MicRecording {
  mediaRecorder: MediaRecorder;
  chunks: Blob[];
  stream: MediaStream;
}

export async function requestMicAccess(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    // Safari only exposes mediaDevices on a secure origin.
    throw new Error(
      window.isSecureContext ? 'Microphone not supported' : 'Microphone needs HTTPS',
    );
  }
  // iOS refuses capture while the playback-only session is active.
  beginMicSession();
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    endMicSession();
    throw err;
  }
}

/** Release the mic and hand the playback session back. */
export function releaseMic(stream: MediaStream): void {
  stream.getTracks().forEach((t) => t.stop());
  endMicSession();
}

export function startRecording(stream: MediaStream): MicRecording {
  const chunks: Blob[] = [];
  const mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  mediaRecorder.start();
  return { mediaRecorder, chunks, stream };
}

export function stopRecording(recording: MicRecording): Promise<Blob> {
  return new Promise((resolve) => {
    recording.mediaRecorder.onstop = () => {
      releaseMic(recording.stream);
      resolve(new Blob(recording.chunks, { type: recording.mediaRecorder.mimeType }));
    };
    recording.mediaRecorder.stop();
  });
}

export function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return blob.arrayBuffer();
}
