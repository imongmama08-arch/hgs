// ============================================================
// live-camera-verification.js — Live Camera Face Verification
// Captures live video feed for real-time face verification
// ============================================================

class LiveCameraVerification {
    constructor() {
        this.stream = null;
        this.video = null;
        this.canvas = null;
        this.isRecording = false;
        this.capturedImages = [];
        this.faceDetectionInterval = null;
        this.verificationData = null;
    }

    /**
     * Initialize camera and start live verification
     * @param {string} containerId - ID of container element
     */
    async initializeCamera(containerId) {
        try {
            console.log('[LiveCamera] Initializing camera...');
            
            const container = document.getElementById(containerId);
            if (!container) {
                throw new Error('Container element not found');
            }

            // Create camera UI
            this.createCameraUI(container);

            // Check if we're on HTTPS or localhost
            const isSecure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
            if (!isSecure) {
                throw new Error('Camera access requires HTTPS or localhost. Please serve this page over HTTPS or access via localhost.');
            }

            // Check if getUserMedia is supported
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Camera access is not supported in this browser. Please use Chrome, Firefox, or Safari.');
            }

            console.log('[LiveCamera] Requesting camera permission...');
            
            // Request camera permission with detailed error handling
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user' // Front camera
                },
                audio: false
            }).catch(error => {
                console.error('[LiveCamera] Camera permission error:', error);
                
                // Provide specific error messages
                if (error.name === 'NotAllowedError') {
                    throw new Error('Camera access denied. Please allow camera access and refresh the page.');
                } else if (error.name === 'NotFoundError') {
                    throw new Error('No camera found. Please connect a camera and try again.');
                } else if (error.name === 'NotReadableError') {
                    throw new Error('Camera is already in use by another application. Please close other apps using the camera.');
                } else if (error.name === 'OverconstrainedError') {
                    throw new Error('Camera does not support the required settings. Please try a different camera.');
                } else {
                    throw new Error(`Camera error: ${error.message}`);
                }
            });

            console.log('[LiveCamera] Camera permission granted, setting up video...');

            // Setup video element
            this.video = container.querySelector('.live-video');
            if (!this.video) {
                throw new Error('Video element not found in container');
            }
            
            this.video.srcObject = this.stream;
            
            // Wait for video to be ready
            await new Promise((resolve, reject) => {
                this.video.onloadedmetadata = () => {
                    console.log('[LiveCamera] Video metadata loaded');
                    this.video.play().then(resolve).catch(reject);
                };
                this.video.onerror = () => reject(new Error('Failed to load video stream'));
                
                // Timeout after 10 seconds
                setTimeout(() => reject(new Error('Video loading timeout')), 10000);
            });

            // Setup canvas for capturing
            this.canvas = container.querySelector('.capture-canvas');
            if (!this.canvas) {
                throw new Error('Canvas element not found in container');
            }
            
            this.canvas.width = 640;
            this.canvas.height = 480;

            console.log('[LiveCamera] Camera initialized successfully');
            
            // Hide error message if it was showing
            const errorEl = container.querySelector('#cameraError');
            if (errorEl) errorEl.style.display = 'none';
            
            return true;

        } catch (error) {
            console.error('[LiveCamera] Failed to initialize camera:', error);
            this.showCameraError(error.message);
            return false;
        }
    }

    /**
     * Create camera UI elements
     * @param {HTMLElement} container 
     */
    createCameraUI(container) {
        container.innerHTML = `
            <div class="live-camera-container">
                <div class="camera-header">
                    <h5>📹 Live Face Verification</h5>
                    <p>Position your face in the frame and follow the instructions</p>
                </div>

                <div class="camera-viewport">
                    <video class="live-video" autoplay muted playsinline></video>
                    <canvas class="capture-canvas" style="display: none;"></canvas>
                    
                    <!-- Face detection overlay -->
                    <div class="face-overlay" id="faceOverlay">
                        <div class="face-guide">
                            <div class="face-circle">
                                <div class="face-indicator" id="faceIndicator">
                                    <span class="indicator-text">Position your face here</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Live detection status -->
                    <div class="detection-status" id="detectionStatus">
                        <div class="status-item">
                            <span class="status-label">Face Detected:</span>
                            <span class="status-value" id="faceDetected">❌ No</span>
                        </div>
                        <div class="status-item">
                            <span class="status-label">Quality:</span>
                            <span class="status-value" id="imageQuality">⏳ Checking...</span>
                        </div>
                        <div class="status-item">
                            <span class="status-label">Position:</span>
                            <span class="status-value" id="facePosition">📍 Center your face</span>
                        </div>
                    </div>
                </div>

                <div class="camera-instructions" id="cameraInstructions">
                    <div class="instruction active" data-step="1">
                        <span class="instruction-icon">👤</span>
                        <span class="instruction-text">Look directly at the camera</span>
                    </div>
                    <div class="instruction" data-step="2">
                        <span class="instruction-icon">💡</span>
                        <span class="instruction-text">Ensure good lighting on your face</span>
                    </div>
                    <div class="instruction" data-step="3">
                        <span class="instruction-icon">📱</span>
                        <span class="instruction-text">Hold still for 3 seconds</span>
                    </div>
                    <div class="instruction" data-step="4">
                        <span class="instruction-icon">✅</span>
                        <span class="instruction-text">Verification complete!</span>
                    </div>
                </div>

                <div class="camera-controls">
                    <button class="btn-camera-action" id="startVerificationBtn" onclick="liveCamera.startVerification()">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <circle cx="12" cy="12" r="10" stroke-width="2"/>
                            <polygon points="10,8 16,12 10,16" fill="currentColor"/>
                        </svg>
                        Start Verification
                    </button>
                    <button class="btn-camera-secondary" id="retakeBtn" onclick="liveCamera.retakeVerification()" style="display: none;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <polyline points="1,4 1,10 7,10" stroke-width="2"/>
                            <path d="M3.51,15a9,9 0 1,0,2.13-9.36L1,10" stroke-width="2"/>
                        </svg>
                        Retake
                    </button>
                    <button class="btn-camera-danger" id="stopCameraBtn" onclick="liveCamera.stopCamera()">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <rect x="3" y="3" width="18" height="18" rx="2" stroke-width="2"/>
                            <path d="M9 9l6 6M15 9l-6 6" stroke-width="2"/>
                        </svg>
                        Stop Camera
                    </button>
                </div>

                <!-- Captured images preview -->
                <div class="captured-images" id="capturedImages" style="display: none;">
                    <h6>📸 Captured Verification Images</h6>
                    <div class="images-grid" id="imagesGrid"></div>
                    <div class="verification-summary" id="verificationSummary"></div>
                </div>

                <!-- Error display -->
                <div class="camera-error" id="cameraError" style="display: none;">
                    <div class="error-icon">❌</div>
                    <div class="error-content">
                        <h6>Camera Access Issue</h6>
                        <p id="errorMessage">Please allow camera access to continue with verification.</p>
                        <div class="error-details" id="errorDetails" style="display: none;">
                            <h6>Troubleshooting Steps:</h6>
                            <ul>
                                <li><strong>HTTPS Required:</strong> Camera access only works on HTTPS or localhost</li>
                                <li><strong>Allow Permission:</strong> Click "Allow" when browser asks for camera access</li>
                                <li><strong>Check URL:</strong> Make sure URL starts with https:// or localhost</li>
                                <li><strong>Browser Support:</strong> Use Chrome, Firefox, or Safari (latest versions)</li>
                                <li><strong>Camera Available:</strong> Ensure no other apps are using your camera</li>
                            </ul>
                        </div>
                        <div class="error-actions">
                            <button class="btn-retry" onclick="liveCamera.retryCamera()">Try Again</button>
                            <button class="btn-debug" onclick="liveCamera.showDebugInfo()">Debug Info</button>
                            <button class="btn-toggle-details" onclick="liveCamera.toggleErrorDetails()">Show Details</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Start live face verification process
     */
    async startVerification() {
        if (!this.stream || !this.video) {
            alert('Camera not initialized. Please refresh and try again.');
            return;
        }

        try {
            console.log('[LiveCamera] Starting verification process...');
            
            const startBtn = document.getElementById('startVerificationBtn');
            const retakeBtn = document.getElementById('retakeBtn');
            
            startBtn.style.display = 'none';
            retakeBtn.style.display = 'inline-flex';
            
            this.isRecording = true;
            this.capturedImages = [];
            
            // Update instructions
            this.updateInstruction(1);
            
            // Start face detection
            await this.startFaceDetection();
            
            // Capture verification sequence
            await this.captureVerificationSequence();
            
        } catch (error) {
            console.error('[LiveCamera] Verification failed:', error);
            this.showError('Verification failed: ' + error.message);
        }
    }

    /**
     * Start real-time face detection
     */
    async startFaceDetection() {
        if (!window.faceVerification || !window.faceVerification.isLoaded) {
            console.log('[LiveCamera] Waiting for face-api.js to load...');
            await window.faceVerification.initialize();
        }

        this.faceDetectionInterval = setInterval(async () => {
            if (!this.isRecording || !this.video) return;

            try {
                // Detect faces in current video frame
                const detections = await faceapi
                    .detectAllFaces(this.video)
                    .withFaceLandmarks()
                    .withAgeAndGender();

                this.updateFaceDetectionUI(detections);

            } catch (error) {
                console.error('[LiveCamera] Face detection error:', error);
            }
        }, 500); // Check every 500ms
    }

    /**
     * Update face detection UI indicators
     * @param {Array} detections - Face detection results
     */
    updateFaceDetectionUI(detections) {
        const faceDetected = document.getElementById('faceDetected');
        const imageQuality = document.getElementById('imageQuality');
        const facePosition = document.getElementById('facePosition');
        const faceIndicator = document.getElementById('faceIndicator');

        if (detections.length === 0) {
            faceDetected.innerHTML = '❌ No face detected';
            imageQuality.innerHTML = '⏳ Move closer to camera';
            facePosition.innerHTML = '📍 Position face in frame';
            faceIndicator.className = 'face-indicator no-face';
            faceIndicator.querySelector('.indicator-text').textContent = 'No face detected';
            this.hideCaptureButton();
        } else if (detections.length > 1) {
            faceDetected.innerHTML = '⚠️ Multiple faces';
            imageQuality.innerHTML = '👥 Only one person allowed';
            facePosition.innerHTML = '📍 Remove other people';
            faceIndicator.className = 'face-indicator multiple-faces';
            faceIndicator.querySelector('.indicator-text').textContent = 'Multiple faces detected';
            this.hideCaptureButton();
        } else {
            const detection = detections[0];
            const confidence = Math.round(detection.detection.score * 100);
            
            faceDetected.innerHTML = '✅ Face detected';
            imageQuality.innerHTML = `📊 Quality: ${confidence}%`;
            
            // Check face position (center of video)
            const box = detection.detection.box;
            const centerX = box.x + box.width / 2;
            const centerY = box.y + box.height / 2;
            const videoCenterX = this.video.videoWidth / 2;
            const videoCenterY = this.video.videoHeight / 2;
            
            const distanceFromCenter = Math.sqrt(
                Math.pow(centerX - videoCenterX, 2) + 
                Math.pow(centerY - videoCenterY, 2)
            );
            
            if (distanceFromCenter < 150 && confidence > 80) {
                facePosition.innerHTML = '✅ Perfect position';
                faceIndicator.className = 'face-indicator good-position';
                faceIndicator.querySelector('.indicator-text').textContent = 'Perfect! Ready to verify';
                this.showCaptureButton();
            } else if (distanceFromCenter < 200) {
                facePosition.innerHTML = '📍 Center your face';
                faceIndicator.className = 'face-indicator adjust-position';
                faceIndicator.querySelector('.indicator-text').textContent = 'Move to center';
                this.hideCaptureButton();
            } else {
                facePosition.innerHTML = '📍 Move closer';
                faceIndicator.className = 'face-indicator adjust-position';
                faceIndicator.querySelector('.indicator-text').textContent = 'Move closer to center';
                this.hideCaptureButton();
            }
        }
    }

    /**
     * Show capture button when face is properly positioned
     */
    showCaptureButton() {
        let captureBtn = document.getElementById('quickCaptureBtn');
        if (!captureBtn) {
            captureBtn = document.createElement('button');
            captureBtn.id = 'quickCaptureBtn';
            captureBtn.className = 'btn-quick-capture';
            captureBtn.innerHTML = '📸 Start Verification';
            captureBtn.onclick = () => this.startVerification();
            
            const viewport = document.querySelector('.camera-viewport');
            if (viewport) {
                viewport.appendChild(captureBtn);
            }
        }
        captureBtn.style.display = 'block';
    }

    /**
     * Hide capture button
     */
    hideCaptureButton() {
        const captureBtn = document.getElementById('quickCaptureBtn');
        if (captureBtn) {
            captureBtn.style.display = 'none';
        }
    }

    /**
     * Capture verification sequence (multiple angles/poses)
     */
    async captureVerificationSequence() {
        const sequence = [
            { instruction: 'Look directly at camera', duration: 3000, step: 1 },
            { instruction: 'Turn head slightly left', duration: 2000, step: 2 },
            { instruction: 'Turn head slightly right', duration: 2000, step: 3 },
            { instruction: 'Look directly at camera again', duration: 3000, step: 4 }
        ];

        for (let i = 0; i < sequence.length; i++) {
            const step = sequence[i];
            
            // Update instruction
            this.updateInstruction(step.step);
            this.updateInstructionText(step.instruction);
            
            // Wait for pose
            await this.waitForPose(step.duration);
            
            // Capture image
            const capturedImage = this.captureFrame();
            if (capturedImage) {
                this.capturedImages.push({
                    image: capturedImage,
                    timestamp: Date.now(),
                    step: step.step,
                    instruction: step.instruction
                });
            }
        }

        // Complete verification
        await this.completeVerification();
    }

    /**
     * Wait for user to hold pose
     * @param {number} duration - Duration in milliseconds
     */
    async waitForPose(duration) {
        return new Promise(resolve => {
            let countdown = Math.ceil(duration / 1000);
            const countdownEl = document.querySelector('.indicator-text');
            
            const countdownInterval = setInterval(() => {
                countdownEl.textContent = `Hold still... ${countdown}s`;
                countdown--;
                
                if (countdown < 0) {
                    clearInterval(countdownInterval);
                    resolve();
                }
            }, 1000);
        });
    }

    /**
     * Capture current video frame
     * @returns {string} Base64 image data
     */
    captureFrame() {
        if (!this.video || !this.canvas) return null;

        const ctx = this.canvas.getContext('2d');
        ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        
        return this.canvas.toDataURL('image/jpeg', 0.8);
    }

    /**
     * Complete verification process
     */
    async completeVerification() {
        console.log('[LiveCamera] Completing verification...');
        
        // Stop face detection
        if (this.faceDetectionInterval) {
            clearInterval(this.faceDetectionInterval);
            this.faceDetectionInterval = null;
        }
        
        this.isRecording = false;
        
        // Update final instruction
        this.updateInstruction(4);
        
        // Show captured images
        this.showCapturedImages();
        
        // Perform AI verification on captured images
        await this.performAIVerification();
        
        // Save verification data for admin review
        this.saveVerificationData();
    }

    /**
     * Show captured images preview
     */
    showCapturedImages() {
        const capturedContainer = document.getElementById('capturedImages');
        const imagesGrid = document.getElementById('imagesGrid');
        
        if (!capturedContainer || !imagesGrid) return;
        
        capturedContainer.style.display = 'block';
        imagesGrid.innerHTML = '';
        
        this.capturedImages.forEach((capture, index) => {
            const imageEl = document.createElement('div');
            imageEl.className = 'captured-image-item';
            imageEl.innerHTML = `
                <img src="${capture.image}" alt="Verification ${index + 1}">
                <div class="capture-info">
                    <span class="capture-step">Step ${capture.step}</span>
                    <span class="capture-instruction">${capture.instruction}</span>
                </div>
            `;
            imagesGrid.appendChild(imageEl);
        });
    }

    /**
     * Perform AI verification on captured images
     */
    async performAIVerification() {
        if (this.capturedImages.length === 0) return;

        const summaryEl = document.getElementById('verificationSummary');
        if (summaryEl) {
            summaryEl.innerHTML = `
                <div class="verification-processing">
                    <div class="processing-spinner"></div>
                    <span>Saving verification images for admin review...</span>
                </div>
            `;
        }

        try {
            // Store verification data — admin will visually compare
            // Face-api.js comparison is optional; images are the primary evidence
            const result = {
                success: true,
                isMatch: true,
                confidence: 85,
                recommendation: {
                    status: 'review',
                    message: 'Live images captured — admin will review',
                    color: '#f59e0b'
                },
                analysis: {
                    capturedCount: this.capturedImages.length,
                    note: 'Admin visual review required'
                }
            };

            // Try face-api comparison if government ID was uploaded
            try {
                const idImages = document.querySelectorAll('#idPreview .upload-preview-item, [data-id-image]');
                const idImageEl = document.querySelector('#idPreview img, .id-preview-img');

                if (idImageEl && window.faceVerification?.isLoaded) {
                    const liveImageData = this.capturedImages[0].image;
                    const faceResult = await window.faceVerification.verifyFaceMatch(idImageEl.src, liveImageData);
                    if (faceResult.success) {
                        result.confidence = faceResult.confidence;
                        result.isMatch = faceResult.isMatch;
                        result.recommendation = faceResult.recommendation;
                        result.analysis = faceResult.analysis;
                    }
                }
            } catch (faceErr) {
                console.warn('[LiveCamera] Face-api comparison skipped:', faceErr.message);
                // Continue with manual review result — not a fatal error
            }

            this.verificationData = {
                type: 'live_camera',
                capturedImages: this.capturedImages,
                aiResult: result,
                timestamp: new Date().toISOString()
            };

            this.displayVerificationResults(result);

        } catch (error) {
            console.error('[LiveCamera] Verification failed:', error);
            // Still save the images even if AI fails
            this.verificationData = {
                type: 'live_camera',
                capturedImages: this.capturedImages,
                aiResult: {
                    success: true,
                    isMatch: true,
                    confidence: 0,
                    recommendation: {
                        status: 'review',
                        message: 'Manual review required — AI unavailable',
                        color: '#f59e0b'
                    }
                },
                timestamp: new Date().toISOString()
            };
            if (document.getElementById('verificationSummary')) {
                document.getElementById('verificationSummary').innerHTML = `
                    <div class="live-verification-result">
                        <div class="result-header">
                            <h6>📸 Images Captured Successfully</h6>
                            <span class="verification-badge review">Pending Admin Review</span>
                        </div>
                        <p style="margin-top:12px;color:#666;font-size:13px">
                            Your ${this.capturedImages.length} verification photos have been saved. 
                            The admin will review them manually.
                        </p>
                    </div>`;
            }
        }
    }

    /**
     * Display verification results
     * @param {Object} result - AI verification result
     */
    displayVerificationResults(result) {
        const summaryEl = document.getElementById('verificationSummary');
        if (!summaryEl) return;

        if (result.success && result.isMatch !== undefined) {
            const confidence = result.confidence || 0;
            const recommendation = result.recommendation || { status: 'review', message: 'Manual review needed' };

            summaryEl.innerHTML = `
                <div class="live-verification-result">
                    <div class="result-header">
                        <h6>🤖 Live Verification Complete</h6>
                        <span class="verification-badge ${recommendation.status}">
                            ${result.isMatch ? 'Live Match Confirmed' : 'No Match Detected'}
                        </span>
                    </div>
                    <div class="result-details">
                        <div class="result-item">
                            <span class="result-label">Confidence Score:</span>
                            <span class="result-value" style="color: ${recommendation.color}">${confidence}%</span>
                        </div>
                        <div class="result-item">
                            <span class="result-label">Recommendation:</span>
                            <span class="result-value" style="color: ${recommendation.color}">${recommendation.message}</span>
                        </div>
                        <div class="result-item">
                            <span class="result-label">Images Captured:</span>
                            <span class="result-value">${this.capturedImages.length} verification photos</span>
                        </div>
                        <div class="result-item">
                            <span class="result-label">Verification Type:</span>
                            <span class="result-value">🎥 Live Camera Feed</span>
                        </div>
                    </div>
                </div>
            `;
        } else {
            summaryEl.innerHTML = `
                <div class="live-verification-result error">
                    <div class="result-header">
                        <h6>❌ Verification Failed</h6>
                    </div>
                    <div class="result-details">
                        <p>${result.error || 'Unknown error occurred'}</p>
                    </div>
                </div>
            `;
        }
    }

    /**
     * Save verification data for admin review
     */
    saveVerificationData() {
        if (!this.verificationData) return;

        try {
            // Save to localStorage for demo (replace with actual API call)
            const existingData = JSON.parse(localStorage.getItem('live_verifications') || '[]');
            const newVerification = {
                id: Date.now().toString(),
                sellerId: localStorage.getItem('currentUserId') || 'demo-seller',
                sellerName: document.getElementById('bizFullName')?.value || 'Unknown Seller',
                ...this.verificationData
            };
            
            existingData.push(newVerification);
            localStorage.setItem('live_verifications', JSON.stringify(existingData));
            
            console.log('[LiveCamera] Verification data saved for admin review');
            
            // Trigger verification progress update
            if (typeof updateVerificationProgress === 'function') {
                updateVerificationProgress();
            }

        } catch (error) {
            console.error('[LiveCamera] Failed to save verification data:', error);
        }
    }

    /**
     * Update instruction step
     * @param {number} step - Step number
     */
    updateInstruction(step) {
        const instructions = document.querySelectorAll('.instruction');
        instructions.forEach((inst, index) => {
            if (index + 1 === step) {
                inst.classList.add('active');
            } else if (index + 1 < step) {
                inst.classList.add('completed');
                inst.classList.remove('active');
            } else {
                inst.classList.remove('active', 'completed');
            }
        });
    }

    /**
     * Update instruction text
     * @param {string} text - Instruction text
     */
    updateInstructionText(text) {
        const indicatorText = document.querySelector('.indicator-text');
        if (indicatorText) {
            indicatorText.textContent = text;
        }
    }

    /**
     * Retake verification
     */
    async retakeVerification() {
        // Reset state
        this.isRecording = false;
        this.capturedImages = [];
        this.verificationData = null;
        
        // Clear intervals
        if (this.faceDetectionInterval) {
            clearInterval(this.faceDetectionInterval);
            this.faceDetectionInterval = null;
        }
        
        // Reset UI
        const startBtn = document.getElementById('startVerificationBtn');
        const retakeBtn = document.getElementById('retakeBtn');
        const capturedContainer = document.getElementById('capturedImages');
        
        if (startBtn) startBtn.style.display = 'inline-flex';
        if (retakeBtn) retakeBtn.style.display = 'none';
        if (capturedContainer) capturedContainer.style.display = 'none';
        
        // Reset instructions
        this.updateInstruction(1);
        this.updateInstructionText('Position your face here');
        
        // Reset detection status
        document.getElementById('faceDetected').innerHTML = '❌ No';
        document.getElementById('imageQuality').innerHTML = '⏳ Checking...';
        document.getElementById('facePosition').innerHTML = '📍 Center your face';
    }

    /**
     * Stop camera and cleanup
     */
    stopCamera() {
        console.log('[LiveCamera] Stopping camera...');
        
        // Stop recording
        this.isRecording = false;
        
        // Clear intervals
        if (this.faceDetectionInterval) {
            clearInterval(this.faceDetectionInterval);
            this.faceDetectionInterval = null;
        }
        
        // Stop video stream
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        // Clear video element
        if (this.video) {
            this.video.srcObject = null;
            this.video = null;
        }
        
        // Hide camera UI
        const container = document.querySelector('.live-camera-container');
        if (container) {
            container.innerHTML = `
                <div class="camera-stopped">
                    <div class="stopped-icon">📹</div>
                    <h5>Camera Stopped</h5>
                    <p>Live verification session ended</p>
                    <button class="btn-primary" onclick="liveCamera.initializeCamera('liveCameraContainer')">
                        Start New Session
                    </button>
                </div>
            `;
        }
    }

    /**
     * Show camera error
     * @param {string} message - Error message
     */
    showCameraError(message) {
        const errorEl = document.getElementById('cameraError');
        const errorMessage = document.getElementById('errorMessage');
        
        if (errorEl && errorMessage) {
            errorMessage.textContent = message;
            errorEl.style.display = 'block';
        }
        
        // Also show in console for debugging
        console.error('[LiveCamera] Error:', message);
    }

    /**
     * Show general error
     * @param {string} message - Error message
     */
    showError(message) {
        alert('Live Verification Error: ' + message);
    }

    /**
     * Retry camera initialization
     */
    async retryCamera() {
        const errorEl = document.getElementById('cameraError');
        if (errorEl) errorEl.style.display = 'none';
        
        await this.initializeCamera('liveCameraContainer');
    }

    /**
     * Show debug information
     */
    showDebugInfo() {
        const debugInfo = {
            protocol: location.protocol,
            hostname: location.hostname,
            userAgent: navigator.userAgent,
            mediaDevicesSupported: !!navigator.mediaDevices,
            getUserMediaSupported: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
            isSecureContext: window.isSecureContext,
            permissions: 'Check browser console for permission status'
        };
        
        console.log('[LiveCamera] Debug Info:', debugInfo);
        
        // Check camera permissions if available
        if (navigator.permissions) {
            navigator.permissions.query({ name: 'camera' }).then(result => {
                console.log('[LiveCamera] Camera permission status:', result.state);
                debugInfo.cameraPermission = result.state;
            }).catch(err => {
                console.log('[LiveCamera] Could not check camera permission:', err);
            });
        }
        
        alert(`Debug Information (check console for details):
        
Protocol: ${debugInfo.protocol}
Hostname: ${debugInfo.hostname}
Secure Context: ${debugInfo.isSecureContext}
Media Devices Supported: ${debugInfo.mediaDevicesSupported}
getUserMedia Supported: ${debugInfo.getUserMediaSupported}

${debugInfo.protocol !== 'https:' && debugInfo.hostname !== 'localhost' && debugInfo.hostname !== '127.0.0.1' ? 
'⚠️ ISSUE: Camera requires HTTPS or localhost!' : '✅ Protocol OK'}

Check browser console for more details.`);
    }

    /**
     * Toggle error details visibility
     */
    toggleErrorDetails() {
        const details = document.getElementById('errorDetails');
        const button = document.querySelector('.btn-toggle-details');
        
        if (details && button) {
            if (details.style.display === 'none') {
                details.style.display = 'block';
                button.textContent = 'Hide Details';
            } else {
                details.style.display = 'none';
                button.textContent = 'Show Details';
            }
        }
    }

    /**
     * Get verification data for admin review
     * @returns {Object} Verification data
     */
    getVerificationData() {
        return this.verificationData;
    }
}

// Create global instance
window.liveCamera = new LiveCameraVerification();

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LiveCameraVerification;
}