import * as faceapi from "face-api.js";

export interface FaceCandidate {
  id: string;
  faceDescriptor: number[];
}

export interface FaceMatch {
  id: string;
  distance: number;
}

let modelsReadyPromise: Promise<void> | null = null;

export const FACE_MATCH_THRESHOLD = 0.5;

export async function loadFaceModels(modelBaseUrl = "/models"): Promise<void> {
  if (!modelsReadyPromise) {
    modelsReadyPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(modelBaseUrl),
      faceapi.nets.faceLandmark68Net.loadFromUri(modelBaseUrl),
      faceapi.nets.faceRecognitionNet.loadFromUri(modelBaseUrl),
    ]).then(() => undefined);
  }

  return modelsReadyPromise;
}

export async function startCamera(video: HTMLVideoElement): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "user",
      width: { ideal: 640 },
      height: { ideal: 480 },
    },
    audio: false,
  });

  video.srcObject = stream;
  await video.play();
  return stream;
}

export function stopCamera(stream: MediaStream | null): void {
  if (!stream) {
    return;
  }

  stream.getTracks().forEach((track) => track.stop());
}

export async function detectFaceDescriptor(video: HTMLVideoElement): Promise<number[] | null> {
  const detection = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) {
    return null;
  }

  return Array.from(detection.descriptor);
}

export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Face descriptor length mismatch");
  }

  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const delta = a[i] - b[i];
    sum += delta * delta;
  }
  return Math.sqrt(sum);
}

export function findBestFaceMatch(
  liveDescriptor: number[],
  candidates: FaceCandidate[],
  threshold = FACE_MATCH_THRESHOLD,
): FaceMatch | null {
  let bestMatch: FaceMatch | null = null;

  for (const candidate of candidates) {
    if (!Array.isArray(candidate.faceDescriptor) || candidate.faceDescriptor.length !== 128) {
      continue;
    }

    const distance = euclideanDistance(liveDescriptor, candidate.faceDescriptor);
    if (distance <= threshold && (!bestMatch || distance < bestMatch.distance)) {
      bestMatch = { id: candidate.id, distance };
    }
  }

  return bestMatch;
}
