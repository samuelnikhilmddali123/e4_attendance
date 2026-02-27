import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from '@vladmandic/face-api';
import { Camera, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

const FaceCapture = ({ onCapture, targetDescriptor = null, onVerify = null, label = "Capture Face" }) => {
    const videoRef = useRef();
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [stream, setStream] = useState(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const [error, setError] = useState(null);
    const [status, setStatus] = useState('Initializing...');

    useEffect(() => {
        loadModels();
        return () => stopCamera();
    }, []);

    const loadModels = async () => {
        try {
            setStatus('Loading Face AI Models...');
            const MODEL_URL = '/models';
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
                faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
            ]);
            setModelsLoaded(true);
            setStatus('Models Ready');
        } catch (err) {
            console.error('Model Load Error:', err);
            setError('Failed to load face detection models');
        }
    };

    const startCamera = async () => {
        try {
            setError(null);
            const mediaStream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: 640, height: 480, facingMode: 'user' } 
            });
            videoRef.current.srcObject = mediaStream;
            setStream(mediaStream);
            setIsCapturing(true);
            setStatus('Camera Active');
        } catch (err) {
            setError('Could not access camera. Please check permissions.');
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
            setIsCapturing(false);
        }
    };

    const handleCapture = async () => {
        if (!videoRef.current) return;
        
        setStatus('Detecting Face...');
        const options = new faceapi.TinyFaceDetectorOptions();
        
        // Detect single face with landmarks and descriptor
        const detections = await faceapi
            .detectSingleFace(videoRef.current, options)
            .withFaceLandmarks(true)
            .withFaceDescriptor();

        if (!detections) {
            setError('No face detected. Please ensure your face is clearly visible.');
            setStatus('Detection Failed');
            return;
        }

        // The descriptor is an array of 128 numbers
        const descriptor = Array.from(detections.descriptor);
        
        if (targetDescriptor && targetDescriptor.length > 0) {
            setStatus('Verifying Identity...');
            const distance = faceapi.euclideanDistance(descriptor, targetDescriptor);
            
            // Euclidean distance < 0.5 means a strong match
            if (distance < 0.5) {
                setStatus('Identity Verified!');
                if (onVerify) onVerify(true);
                stopCamera();
            } else {
                setError(`Identity verification failed. (Score: ${distance.toFixed(2)})`);
                setStatus('Match Failed');
                // We don't call onVerify(false) immediately to allow retry
            }
            return;
        }

        onCapture(descriptor);
        setStatus('Face Captured Successfully!');
        stopCamera();
    };

    return (
        <div className="flex flex-col items-center gap-4 p-4 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
            {!isCapturing ? (
                <div className="text-center space-y-4">
                    <div className="w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center mx-auto">
                        <Camera className="w-10 h-10 text-teal-600" />
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-800">{label}</h4>
                        <p className="text-xs text-gray-500 mt-1">Position your face clearly in the frame</p>
                    </div>
                    <button
                        type="button"
                        onClick={startCamera}
                        disabled={!modelsLoaded}
                        className={`px-6 py-2 rounded-xl font-bold text-sm transition-all ${
                            modelsLoaded 
                            ? 'bg-teal-600 text-white hover:bg-teal-700 shadow-lg shadow-teal-100' 
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                    >
                        {modelsLoaded ? 'Start Camera' : 'Loading Models...'}
                    </button>
                </div>
            ) : (
                <div className="relative w-full max-w-[400px]">
                    <video
                        ref={videoRef}
                        autoPlay
                        muted
                        className="w-full rounded-2xl shadow-xl border-4 border-white bg-black hidden sm:block"
                        style={{ transform: 'scaleX(-1)' }}
                    />
                    <div className="mt-4 flex gap-2 justify-center">
                        <button
                            type="button"
                            onClick={handleCapture}
                            className="px-6 py-2 bg-teal-600 text-white rounded-xl font-bold text-sm hover:bg-teal-700 transition-all flex items-center gap-2"
                        >
                            <CheckCircle2 className="w-4 h-4" />
                            {targetDescriptor ? 'Verify Identity' : 'Capture & Enroll'}
                        </button>
                        <button
                            type="button"
                            onClick={stopCamera}
                            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-300 transition-all"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {status && !error && (
                <p className="text-[10px] font-bold uppercase tracking-wider text-teal-600 animate-pulse">
                    {status}
                </p>
            )}

            {error && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-2 rounded-lg text-xs font-medium">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                </div>
            )}
        </div>
    );
};

export default FaceCapture;
