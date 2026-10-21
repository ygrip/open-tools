import { tick } from 'svelte';
import { RuntimeFailure, type RuntimeRequest } from './core';

type PositionFix = { latitude: number; longitude: number; accuracy: number };
type MediaOptions = {
  generation: () => number;
  pending: () => RuntimeRequest | null;
  active: (request: RuntimeRequest, generation: number) => boolean;
  reply: (request: RuntimeRequest, ok: boolean, value?: unknown, error?: string, transfer?: Transferable[]) => void;
  finish: (request: RuntimeRequest) => void;
  busy: (busy: boolean) => void;
};

/** Camera/location data never enters the sandbox until the user confirms a preview. */
export function createMediaSessions(options: MediaOptions) {
  let cameraStage = $state<'off' | 'starting' | 'ready'>('off');
  let cameraVideo = $state<HTMLVideoElement | null>(null);
  let cameraStream: MediaStream | null = null;
  let locationStage = $state<'off' | 'locating' | 'ready' | 'blocked'>('off');
  let locationFix = $state.raw<PositionFix | null>(null);

  function stopCamera() {
    if (cameraVideo) { cameraVideo.pause(); cameraVideo.srcObject = null; }
    cameraStream?.getTracks().forEach(track => track.stop());
    cameraStream = null;
    cameraStage = 'off';
  }

  async function startCamera(request: RuntimeRequest) {
    if (!navigator.mediaDevices?.getUserMedia) {
      options.reply(request, false, undefined, 'unsupported');
      options.finish(request);
      return;
    }
    const current = options.generation();
    options.busy(true);
    cameraStage = 'starting';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      if (!options.active(request, current)) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      cameraStream = stream;
      await tick();
      if (!cameraVideo) throw new RuntimeFailure('unsupported');
      cameraVideo.srcObject = stream;
      await cameraVideo.play();
      if (options.active(request, current)) cameraStage = 'ready';
    } catch (error) {
      if (current === options.generation()) {
        stopCamera();
        options.reply(request, false, undefined, error instanceof RuntimeFailure ? error.code : 'denied');
        options.finish(request);
      }
    } finally { if (current === options.generation() && cameraStage !== 'ready') options.busy(false); }
  }

  async function captureCamera() {
    const request = options.pending();
    if (request?.operation !== 'camera-capture' || cameraStage !== 'ready' || !cameraVideo) return;
    const current = options.generation();
    try {
      const video = cameraVideo;
      if (!video.videoWidth || !video.videoHeight) throw new RuntimeFailure('unsupported');
      const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new RuntimeFailure('unsupported');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob || blob.size > 8 * 1024 * 1024) throw new RuntimeFailure('size');
      const bytes = await blob.arrayBuffer();
      if (options.active(request, current)) {
        stopCamera();
        options.finish(request);
        options.reply(request, true, { bytes, mime: 'image/png' }, undefined, [bytes]);
      }
    } catch (error) {
      if (options.active(request, current)) {
        options.reply(request, false, undefined, error instanceof RuntimeFailure ? error.code : 'request');
        stopCamera();
        options.finish(request);
      }
    } finally { if (current === options.generation()) options.busy(false); }
  }

  function stopLocation() {
    locationStage = 'off';
    locationFix = null;
  }
  async function geolocationState(): Promise<PermissionState | 'unknown'> {
    try { return (await navigator.permissions?.query({ name: 'geolocation' }))?.state ?? 'unknown'; }
    catch { return 'unknown'; }
  }

  async function startLocation(request: RuntimeRequest) {
    if (!navigator.geolocation) {
      options.reply(request, false, undefined, 'unsupported');
      options.finish(request);
      return;
    }
    const current = options.generation();
    const active = () => options.active(request, current);
    options.busy(true);
    locationFix = null;
    if (await geolocationState() === 'denied') { if (active()) locationStage = 'blocked'; return; }
    if (!active()) return;
    locationStage = 'locating';
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!active()) return;
        locationFix = { latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy };
        locationStage = 'ready';
      },
      (error) => {
        if (!active()) return;
        if (error.code === error.PERMISSION_DENIED) { locationStage = 'blocked'; return; }
        finishLocation(request, false, undefined, error.code === error.TIMEOUT ? 'timeout' : 'unsupported');
      },
      { timeout: 15_000, maximumAge: 60_000, enableHighAccuracy: false }
    );
  }

  function finishLocation(request: RuntimeRequest, ok: boolean, value?: unknown, error?: string) {
    stopLocation();
    options.finish(request);
    options.busy(false);
    options.reply(request, ok, value, error);
  }

  function shareLocation(precise: boolean) {
    const request = options.pending();
    const fix = locationFix;
    if (request?.operation !== 'geolocation' || locationStage !== 'ready' || !fix) return;
    const round = (value: number) => Math.round(value * 100) / 100;
    finishLocation(request, true, precise ? fix : {
      latitude: round(fix.latitude), longitude: round(fix.longitude), accuracy: Math.max(fix.accuracy, 1100)
    });
  }

  return {
    get cameraStage() { return cameraStage; },
    get cameraVideo() { return cameraVideo; },
    set cameraVideo(value: HTMLVideoElement | null) { cameraVideo = value; },
    get locationStage() { return locationStage; },
    get locationFix() { return locationFix; },
    stopCamera, startCamera, captureCamera, stopLocation, startLocation, shareLocation
  };
}
