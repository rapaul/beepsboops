export interface MicRecording {
  mediaRecorder: MediaRecorder;
  chunks: Blob[];
  stream: MediaStream;
}

export async function requestMicAccess(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ audio: true });
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
      recording.stream.getTracks().forEach((t) => t.stop());
      resolve(new Blob(recording.chunks, { type: recording.mediaRecorder.mimeType }));
    };
    recording.mediaRecorder.stop();
  });
}

export function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return blob.arrayBuffer();
}
