import { useEffect, useRef, useState, useCallback } from 'react';

export function useMotionDetection(onMotionDetected: () => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previousImageData = useRef<Uint8ClampedArray | null>(null);
  const [isActive, setIsActive] = useState(false);
  const lastTriggerTime = useRef(0);
  const callbackRef = useRef(onMotionDetected);

  useEffect(() => {
    callbackRef.current = onMotionDetected;
  }, [onMotionDetected]);

  useEffect(() => {
    let animationFrameId: number;
    let stream: MediaStream | null = null;
    let localIsActive = false;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: false });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setIsActive(true);
          localIsActive = true;
          processFrame();
        }
      } catch (err) {
        console.warn("Camera access for motion detection not available.", err);
      }
    };

    const processFrame = () => {
      if (!videoRef.current || !canvasRef.current || !localIsActive) return;

      const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(videoRef.current, 0, 0, 64, 48);
      const output = ctx.getImageData(0, 0, 64, 48);
      const data = output.data;
      
      let motionScore = 0;

      if (previousImageData.current) {
        for (let i = 0; i < data.length; i += 4) {
          const rDiff = Math.abs(data[i] - previousImageData.current[i]);
          const gDiff = Math.abs(data[i + 1] - previousImageData.current[i + 1]);
          const bDiff = Math.abs(data[i + 2] - previousImageData.current[i + 2]);
          if (rDiff + gDiff + bDiff > 100) {
            motionScore++; 
          }
        }
      }

      previousImageData.current = new Uint8ClampedArray(data);
      const now = Date.now();
      
      if (motionScore > 200 && now - lastTriggerTime.current > 7000) {
        lastTriggerTime.current = now;
        if (callbackRef.current) callbackRef.current();
      }

      animationFrameId = requestAnimationFrame(processFrame);
    };

    startCamera();

    return () => {
      localIsActive = false;
      cancelAnimationFrame(animationFrameId);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return { videoRef, canvasRef, isActive };
}
