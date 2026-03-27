/**
 * useFieldEvidence — Camera + GPS capture for field reports.
 *
 * Manages:
 *   - Permission requests (camera + location)
 *   - Photo capture via expo-camera
 *   - GPS lock via expo-location
 *   - Image compression via expo-image-manipulator
 *   - Connection state awareness
 *
 * Carlos Standard: zero friction, auto-capture GPS on mount,
 * single-tap photo, visual feedback for GPS lock status.
 */

import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import * as ImageManipulator from 'expo-image-manipulator';
import { Camera } from 'expo-camera';

// ─── Types ──────────────────────────────────────────

export type GpsState = {
  lat: number;
  lng: number;
  accuracy: number | null;
  timestamp: number;
} | null;

export type PhotoState = {
  uri: string;
  width: number;
  height: number;
} | null;

export type FieldEvidenceState = {
  /** Camera permission granted */
  cameraPermission: boolean;
  /** Location permission granted */
  locationPermission: boolean;
  /** GPS coordinates (null = not acquired yet) */
  gps: GpsState;
  /** Whether GPS is actively being acquired */
  gpsLoading: boolean;
  /** Captured photo (null = not captured) */
  photo: PhotoState;
  /** Whether photo is being processed (compression) */
  photoProcessing: boolean;
  /** Request camera permission */
  requestCameraPermission: () => Promise<boolean>;
  /** Request location permission */
  requestLocationPermission: () => Promise<boolean>;
  /** Capture GPS coordinates now */
  captureGps: () => Promise<GpsState>;
  /** Process a photo URI (compress + resize) */
  processPhoto: (uri: string) => Promise<PhotoState>;
  /** Clear captured photo */
  clearPhoto: () => void;
};

// ─── Constants ──────────────────────────────────────

const MAX_PHOTO_WIDTH = 1200;
const JPEG_QUALITY = 0.7;

// ─── Hook ───────────────────────────────────────────

export function useFieldEvidence(): FieldEvidenceState {
  const [cameraPermission, setCameraPermission] = useState(false);
  const [locationPermission, setLocationPermission] = useState(false);
  const [gps, setGps] = useState<GpsState>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [photo, setPhoto] = useState<PhotoState>(null);
  const [photoProcessing, setPhotoProcessing] = useState(false);

  // ─── Check existing permissions on mount ──────
  useEffect(() => {
    (async () => {
      const [cam, loc] = await Promise.all([
        Camera.getCameraPermissionsAsync(),
        Location.getForegroundPermissionsAsync(),
      ]);
      setCameraPermission(cam.granted);
      setLocationPermission(loc.granted);

      // Auto-capture GPS if permission already granted
      if (loc.granted) {
        captureGpsInternal();
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Permission requests ──────────────────────

  const requestCameraPermission = useCallback(async (): Promise<boolean> => {
    const { granted } = await Camera.requestCameraPermissionsAsync();
    setCameraPermission(granted);
    return granted;
  }, []);

  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    setLocationPermission(granted);
    if (granted) captureGpsInternal();
    return granted;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── GPS capture ──────────────────────────────

  async function captureGpsInternal(): Promise<GpsState> {
    setGpsLoading(true);
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
      });
      const result: GpsState = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        accuracy: location.coords.accuracy,
        timestamp: location.timestamp,
      };
      setGps(result);
      setGpsLoading(false);
      return result;
    } catch {
      setGpsLoading(false);
      return null;
    }
  }

  const captureGps = useCallback(async (): Promise<GpsState> => {
    return captureGpsInternal();
  }, []);

  // ─── Photo processing (compress + resize) ─────

  const processPhoto = useCallback(async (uri: string): Promise<PhotoState> => {
    setPhotoProcessing(true);
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: MAX_PHOTO_WIDTH } }],
        { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
      );
      const photoResult: PhotoState = {
        uri: result.uri,
        width: result.width,
        height: result.height,
      };
      setPhoto(photoResult);
      setPhotoProcessing(false);
      return photoResult;
    } catch {
      setPhotoProcessing(false);
      return null;
    }
  }, []);

  const clearPhoto = useCallback(() => {
    setPhoto(null);
  }, []);

  return {
    cameraPermission,
    locationPermission,
    gps,
    gpsLoading,
    photo,
    photoProcessing,
    requestCameraPermission,
    requestLocationPermission,
    captureGps,
    processPhoto,
    clearPhoto,
  };
}
