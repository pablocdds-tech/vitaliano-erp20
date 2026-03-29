import { useState, useEffect, useRef } from 'react';

const MODELS_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';
const FACE_API_URL = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';

export default function useFaceApi() {
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const loadingRef = useRef(false);

  const loadFaceApi = async () => {
    if (window.faceapi && loaded) return true;
    if (loadingRef.current) return false;
    
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      // Load face-api.js script if not already loaded
      if (!window.faceapi) {
        await new Promise((resolve, reject) => {
          const existing = document.querySelector(`script[src="${FACE_API_URL}"]`);
          if (existing) {
            existing.addEventListener('load', resolve);
            return;
          }
          const script = document.createElement('script');
          script.src = FACE_API_URL;
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      const faceapi = window.faceapi;
      
      // Load models
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODELS_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL),
      ]);

      setLoaded(true);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  return { loaded, loading, error, loadFaceApi };
}