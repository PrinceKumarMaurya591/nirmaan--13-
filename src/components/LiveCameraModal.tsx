import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, RefreshCw, Image as ImageIcon, MapPin } from 'lucide-react';
import { resizeImage, stampImageWithMetadata, fetchLocationName } from '../lib/utils';
import { useAppContext } from '../store';

interface LiveCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (stampedBase64: string) => void;
  projectName: string;
  userName: string;
  userRole: string;
  gpsCoords: { lat: number; lng: number; alt?: number | null } | null;
}

export function LiveCameraModal({
  isOpen,
  onClose,
  onCapture,
  projectName,
  userName,
  userRole,
  gpsCoords,
}: LiveCameraModalProps) {
  const { state } = useAppContext();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [locationName, setLocationName] = useState<string>('');

  const [localGps, setLocalGps] = useState<{ lat: number; lng: number; alt?: number | null } | null>(gpsCoords);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string>('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [flash, setFlash] = useState(false);

  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      const timer = setInterval(() => setCurrentTime(new Date()), 1000);
      return () => clearInterval(timer);
    }
  }, [isOpen]);

  // Fetch current location with high accuracy manually
  const fetchCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGpsError(state.language === 'hi' ? 'जीपीएस समर्थित नहीं है' : 'GPS not supported');
      return;
    }
    setGpsLoading(true);
    setGpsError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          alt: position.coords.altitude || null,
        };
        setLocalGps(coords);
        setGpsAccuracy(position.coords.accuracy);
        setGpsLoading(false);
      },
      (err) => {
        console.error('Error fetching high-accuracy GPS inside camera:', err);
        setGpsError(err.message || 'GPS Fetch Failed');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };

  // Run location fetch and watch on modal open and synchronize with parent prop
  useEffect(() => {
    if (!isOpen) return;

    if (gpsCoords) {
      setLocalGps(gpsCoords);
    }

    if (!navigator.geolocation) {
      setGpsError(state.language === 'hi' ? 'जीपीएस समर्थित नहीं है' : 'GPS not supported');
      return;
    }

    setGpsLoading(true);
    setGpsError('');

    // Continuous watch position for warming up GPS satellite lock and maximum accuracy
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          alt: position.coords.altitude || null,
        };
        setLocalGps(coords);
        setGpsAccuracy(position.coords.accuracy);
        setGpsLoading(false);
      },
      (err) => {
        console.warn('Error watching GPS coordinates, trying manual fetch:', err);
        fetchCurrentLocation();
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );

    // Initial fetch to get quick lock
    fetchCurrentLocation();

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isOpen, gpsCoords]);

  useEffect(() => {
    if (isOpen && localGps) {
      setLocationName(state.language === 'hi' ? 'पता खोजा जा रहा है...' : 'FETCHING ADDRESS...');
      fetchLocationName(localGps.lat, localGps.lng).then(res => {
        setLocationName(res.toUpperCase());
      }).catch(err => {
        console.error("Error reverse geocoding inside modal:", err);
        setLocationName(`Coordinates: ${localGps.lat.toFixed(5)}, ${localGps.lng.toFixed(5)}`);
      });
    } else if (!localGps) {
      setLocationName('');
    }
  }, [isOpen, localGps, state.language]);

  // Bind active stream to videoRef.current and play immediately
  useEffect(() => {
    const video = videoRef.current;
    if (video && activeStream) {
      video.srcObject = activeStream;
      video.play().catch((err) => {
        console.warn("Video element play request interrupted:", err);
      });
    }
  }, [activeStream, videoRef.current]);

  // Start the live video stream
  const startCamera = async (mode: 'user' | 'environment') => {
    stopCamera();

    try {
      setErrorMsg('');
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: mode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setActiveStream(stream);
      setHasPermission(true);
    } catch (err: any) {
      console.error('Error starting live camera stream:', err);
      setHasPermission(false);
      setErrorMsg(
        err.message || 'Camera blocked or unsupported. Use fallback file/photo upload:'
      );
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (activeStream) {
      activeStream.getTracks().forEach((track) => track.stop());
    }
    setActiveStream(null);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    if (isOpen) {
      startCamera(facingMode);
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const toggleCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
  };

  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const handleCapture = async () => {
    if (!videoRef.current || isCapturing) return;

    setFlash(true);
    setTimeout(() => setFlash(false), 200);

    try {
      setIsCapturing(true);
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 800;
      canvas.height = video.videoHeight || 600;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not create 2D canvas context');

      // Draw the current video frame on the canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert canvas to base64 JPEG
      const rawBase64 = canvas.toDataURL('image/jpeg', 0.85);

      // Apply the beautiful GPS stamp using localGps (most accurate coordinates)
      const stampedBase64 = await stampImageWithMetadata(
        rawBase64,
        projectName,
        userName,
        localGps,
        userRole
      );

      setPreviewImage(stampedBase64);
    } catch (err) {
      console.error('Failed to capture frame from video:', err);
    } finally {
      setIsCapturing(false);
    }
  };

  const confirmCapture = () => {
    if (previewImage) {
      onCapture(previewImage);
      setPreviewImage(null);
      onClose();
    }
  };

  const retakeCapture = () => {
    setPreviewImage(null);
  };

  // Fallback upload (runs resize + stamp directly on file picked by native device camera/gallery)
  const handleFallbackFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCapturing(true);
      // Resize first to 800x800
      const resizedBase64 = await resizeImage(file);
      // Apply the stamp using localGps
      const stampedBase64 = await stampImageWithMetadata(
        resizedBase64,
        projectName,
        userName,
        localGps,
        userRole
      );

      setPreviewImage(stampedBase64);
    } catch (err) {
      console.error('Failed processing fallback file upload:', err);
    } finally {
      setIsCapturing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999] bg-slate-950/95 flex flex-col items-center justify-center p-3 md:p-6 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center px-4 py-3 border-b border-slate-800 bg-slate-900/90">
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-amber-400" />
              {state.language === 'hi' ? 'लाइव जीपीएस कैमरा' : 'Live GPS Camera'}
            </h4>
            <p className="text-[10px] text-slate-400">
              {state.language === 'hi' 
                ? 'तस्वीर पर लोकेशन, नाम और तारीख स्वतः ही अंकित हो जाएगी' 
                : 'Photo will be automatically stamped with location, name & date'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-full hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Area */}
        <div className="relative bg-black flex-1 aspect-square md:aspect-video flex items-center justify-center overflow-hidden">
          {previewImage ? (
            <img src={previewImage} alt="Preview" className="w-full h-full object-contain" />
          ) : hasPermission === false || !navigator.mediaDevices ? (
            <div className="p-6 text-center max-w-sm flex flex-col items-center gap-4">
              <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-full text-amber-400">
                <Camera className="w-10 h-10" />
              </div>
              <div className="space-y-1">
                <p className="text-sm text-slate-200 font-bold">
                  {state.language === 'hi' ? 'कैमरा अनुमति अस्वीकृत' : 'Camera Permission Denied'}
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {state.language === 'hi' 
                    ? 'लाइव कैमरा अनुमति नहीं मिली या ब्लॉक है। आप नीचे दिए गए बटन से अपने फ़ोन के सामान्य कैमरा से फोटो खींच सकते हैं:' 
                    : 'Live camera permission is not granted or blocked. You can capture a photo using your default phone camera:'}
                </p>
                <p className="text-[10px] text-slate-500 italic">({errorMsg || 'Permission dismissed'})</p>
              </div>

              {!localGps && (
                <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-lg text-xs text-red-400 font-bold mb-2">
                  {state.language === 'hi' ? 'कृपया अपनी डिवाइस सेटिंग्स में GPS (लोकेशन) चालू करें और अनुमति दें।' : 'Please enable and allow GPS (Location) in your device settings to proceed.'}
                </div>
              )}

              <label className={`inline-flex items-center justify-center gap-2 bg-amber-400 text-slate-950 px-5 py-3 rounded-xl text-xs font-black transition-all w-full select-none shadow-lg ${!localGps ? 'opacity-50 cursor-not-allowed' : 'hover:bg-amber-500 cursor-pointer'}`}>
                <ImageIcon className="w-4 h-4 text-slate-950" />
                {state.language === 'hi' ? 'फ़ोन कैमरा से फोटो लें' : 'Take Photo from Phone Camera'}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFallbackFile}
                  disabled={isCapturing || !localGps}
                />
              </label>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                onLoadedMetadata={(e) => {
                  const video = e.target as HTMLVideoElement;
                  if (activeStream && video.srcObject !== activeStream) {
                    video.srcObject = activeStream;
                  }
                  video.play().catch(err => console.log("Autoplay error on metadata load:", err));
                }}
              />

              {flash && <div className="absolute inset-0 bg-white z-[100] animate-in fade-out duration-300"></div>}

              {/* Minimal Crosshair */}
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center opacity-50">
                <div className="w-16 h-16 border-2 border-white/40 rounded-full flex items-center justify-center relative">
                  <div className="absolute w-2 h-0.5 bg-amber-400 -left-1"></div>
                  <div className="absolute w-2 h-0.5 bg-amber-400 -right-1"></div>
                  <div className="absolute h-2 w-0.5 bg-amber-400 -top-1"></div>
                  <div className="absolute h-2 w-0.5 bg-amber-400 -bottom-1"></div>
                  <div className="w-1 h-1 bg-amber-400/80 rounded-full"></div>
                </div>
              </div>
              
              {/* Informative Stamp Preview Box */}
              <div className="absolute bottom-3 left-3 right-3 bg-black/75 border border-white/10 rounded p-2 text-[10px] font-mono text-slate-300 pointer-events-none select-none backdrop-blur-sm">
                <div className="flex items-center justify-between text-amber-400 font-semibold mb-1 border-b border-white/10 pb-1">
                  <span className="flex items-center gap-1">📷 {state.language === 'hi' ? 'जीपीएस स्टैम्प प्रीव्यू' : 'GPS STAMP PREVIEW'}</span>
                  {gpsLoading && <span className="animate-pulse text-emerald-400">{state.language === 'hi' ? 'खोज रहा है...' : 'SYNCING GPS...'}</span>}
                </div>
                <div>PROJECT  : {projectName.toUpperCase()}</div>
                                <div>DATE/TIME: {currentTime.toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) + ' ' + currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</div>
                <div>
                  GPS COORD: {localGps ? `${localGps.lat.toFixed(6)}° N | ${localGps.lng.toFixed(6)}° E` + (localGps.alt ? ` | ALT: ${localGps.alt.toFixed(1)}m` : '') : (
                    gpsError ? `🔴 Error: ${gpsError}` : '🛰️ FETCHING HIGH ACCURACY GPS...'
                  )}
                </div>
                {gpsAccuracy && (
                  <div className={`mt-0.5 ${gpsAccuracy > 50 ? 'text-rose-400 font-bold' : 'text-emerald-400'}`}>
                    ACCURACY : ±{Math.round(gpsAccuracy)}m {gpsAccuracy > 50 ? (state.language === 'hi' ? '(कमज़ोर - कृपया खुले स्थान पर जाएं)' : '(LOW - Move to open area)') : ''}
                  </div>
                )}
                {locationName && (
                  <div className="text-amber-300 mt-0.5 truncate">LOCATION : {locationName}</div>
                )}
              </div>
            </>
          )}

          {isCapturing && (
            <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center gap-3 backdrop-blur-xs">
              <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs text-amber-400 font-bold tracking-wider uppercase">
                {state.language === 'hi' ? 'लोकेशन और स्टैम्प सुरक्षित किया जा रहा है...' : 'Stamping & Saving...'}
              </span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-col gap-3 relative">
          
          {previewImage ? (
            <div className="flex gap-4">
              <button
                type="button"
                onClick={retakeCapture}
                className="flex-1 py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 transition-colors"
              >
                {state.language === 'hi' ? 'फिर से लें' : 'Retake'}
              </button>
              <button
                type="button"
                onClick={confirmCapture}
                className="flex-1 py-3 bg-amber-500 text-slate-950 rounded-xl font-bold hover:bg-amber-600 transition-colors"
              >
                {state.language === 'hi' ? 'कन्फर्म करें' : 'Confirm'}
              </button>
            </div>
          ) : (
            <>
              {(!localGps || gpsError) && !previewImage && hasPermission !== false && (
                <div className="bg-red-500/10 border border-red-500/30 p-2 rounded-lg text-xs text-red-400 font-bold text-center mb-1">
                  {state.language === 'hi' ? 'कैमरा उपयोग करने के लिए कृपया GPS चालू करें और अनुमति दें।' : 'Please enable Location/GPS to unlock the camera.'}
                </div>
              )}
              {/* Shutter actions for live camera */}
              {hasPermission !== false && navigator.mediaDevices && (
                <div className="grid grid-cols-3 items-center justify-items-center">
                  {/* Toggle Front/Back Camera */}
                  <button
                    type="button"
                    onClick={toggleCamera}
                    className="p-3 bg-slate-800 text-slate-300 hover:text-white rounded-full hover:bg-slate-700 transition-all shadow-md active:scale-90"
                    title={state.language === 'hi' ? 'कैमरा बदलें' : 'Switch Camera'}
                  >
                    <RefreshCw className="w-5 h-5" />
                  </button>

                  {/* Shutter Button */}
                  <button
                    type="button"
                    disabled={isCapturing || !localGps}
                    onClick={handleCapture}
                    className="w-16 h-16 bg-white hover:bg-slate-100 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all border-4 border-slate-700 hover:border-slate-600 disabled:opacity-50 disabled:active:scale-100"
                    title={!localGps ? (state.language === 'hi' ? 'जीपीएस की प्रतीक्षा...' : 'Waiting for GPS...') : (state.language === 'hi' ? 'फोटो खींचें' : 'Capture')}
                  >
                    <div className="w-12 h-12 bg-amber-400 hover:bg-amber-500 rounded-full border border-slate-800 transition-all flex items-center justify-center">
                      <Camera className="w-6 h-6 text-slate-950" />
                    </div>
                  </button>

                  {/* Refresh GPS Button */}
                  <button
                    type="button"
                    disabled={gpsLoading}
                    onClick={fetchCurrentLocation}
                    className={`p-3 rounded-full transition-all shadow-md active:scale-90 flex items-center justify-center ${
                      gpsLoading 
                        ? 'bg-emerald-500/20 text-emerald-400 animate-pulse' 
                        : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                    }`}
                    title={state.language === 'hi' ? 'जीपीएस रिफ्रेश करें' : 'Refresh GPS'}
                  >
                    <MapPin className={`w-5 h-5 ${gpsLoading ? 'animate-bounce' : ''}`} />
                  </button>
                </div>
              )}

              {/* Device Fallback Input */}
              <div className="text-center pt-1">
                <label className={`inline-flex items-center justify-center gap-2 bg-slate-800 text-slate-200 px-4 py-2.5 rounded-xl border border-slate-700 text-xs font-bold transition-all w-full select-none shadow-md ${!localGps ? 'opacity-50 cursor-not-allowed' : 'hover:text-white hover:bg-slate-700 cursor-pointer'}`}>
                  <ImageIcon className="w-4 h-4 text-amber-400" />
                  {hasPermission === false 
                    ? (state.language === 'hi' ? 'डिफ़ॉल्ट कैमरा ऐप खोलें' : 'Open Default Camera App')
                    : (state.language === 'hi' ? 'गैलरी या डिफ़ॉल्ट कैमरा से चुनें' : 'Upload from Gallery/Camera')}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFallbackFile}
                    disabled={!localGps || isCapturing}
                  />
                </label>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
