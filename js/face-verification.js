// ============================================================
// face-verification.js — Free Face Verification System
// Uses Face-api.js for client-side face detection and matching
// ============================================================

class FaceVerificationSystem {
    constructor() {
        this.isLoaded = false;
        this.models = null;
        this.loadingPromise = null;
    }

    /**
     * Initialize Face-api.js models (call once on page load)
     */
    async initialize() {
        if (this.loadingPromise) {
            return this.loadingPromise;
        }

        this.loadingPromise = this._loadModels();
        return this.loadingPromise;
    }

    async _loadModels() {
        try {
            console.log('[FaceVerification] Loading face-api.js models...');
            
            // Load required models from CDN
            const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@latest/model';
            
            await Promise.all([
                faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
                faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
                faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL)
            ]);

            this.isLoaded = true;
            console.log('[FaceVerification] Models loaded successfully!');
            return true;
        } catch (error) {
            console.error('[FaceVerification] Failed to load models:', error);
            throw new Error('Failed to initialize face verification system');
        }
    }

    /**
     * Verify if selfie matches the face in government ID
     * @param {File|string} idImage - Government ID image file or data URL
     * @param {File|string} selfieImage - Selfie image file or data URL
     * @returns {Promise<Object>} Verification result with confidence score
     */
    async verifyFaceMatch(idImage, selfieImage) {
        if (!this.isLoaded) {
            throw new Error('Face verification system not initialized. Call initialize() first.');
        }

        try {
            console.log('[FaceVerification] Starting face verification...');

            // Convert files to images
            const idImg = await this._loadImage(idImage);
            const selfieImg = await this._loadImage(selfieImage);

            // Detect faces in both images
            const idFaces = await this._detectFaces(idImg);
            const selfieFaces = await this._detectFaces(selfieImg);

            // Validate face detection results
            const validation = this._validateDetection(idFaces, selfieFaces);
            if (!validation.success) {
                return {
                    success: false,
                    error: validation.error,
                    confidence: 0,
                    details: validation.details
                };
            }

            // Compare faces
            const comparison = await this._compareFaces(idFaces[0], selfieFaces[0]);
            
            console.log('[FaceVerification] Verification complete:', comparison);
            return comparison;

        } catch (error) {
            console.error('[FaceVerification] Verification failed:', error);
            return {
                success: false,
                error: 'Face verification failed',
                confidence: 0,
                details: { error: error.message }
            };
        }
    }

    /**
     * Detect and analyze faces in an image
     * @param {HTMLImageElement} image 
     * @returns {Promise<Array>} Array of face detection results
     */
    async _detectFaces(image) {
        const detections = await faceapi
            .detectAllFaces(image)
            .withFaceLandmarks()
            .withFaceDescriptors()
            .withAgeAndGender();

        return detections;
    }

    /**
     * Validate face detection results
     * @param {Array} idFaces - Faces detected in ID
     * @param {Array} selfieFaces - Faces detected in selfie
     * @returns {Object} Validation result
     */
    _validateDetection(idFaces, selfieFaces) {
        if (idFaces.length === 0) {
            return {
                success: false,
                error: 'No face detected in government ID',
                details: { idFaces: 0, selfieFaces: selfieFaces.length }
            };
        }

        if (selfieFaces.length === 0) {
            return {
                success: false,
                error: 'No face detected in selfie',
                details: { idFaces: idFaces.length, selfieFaces: 0 }
            };
        }

        if (idFaces.length > 1) {
            return {
                success: false,
                error: 'Multiple faces detected in government ID',
                details: { idFaces: idFaces.length, selfieFaces: selfieFaces.length }
            };
        }

        if (selfieFaces.length > 1) {
            return {
                success: false,
                error: 'Multiple faces detected in selfie',
                details: { idFaces: idFaces.length, selfieFaces: selfieFaces.length }
            };
        }

        return {
            success: true,
            details: { idFaces: idFaces.length, selfieFaces: selfieFaces.length }
        };
    }

    /**
     * Compare two face descriptors
     * @param {Object} idFace - Face detection from ID
     * @param {Object} selfieFace - Face detection from selfie
     * @returns {Promise<Object>} Comparison result
     */
    async _compareFaces(idFace, selfieFace) {
        // Calculate face similarity using Euclidean distance
        const distance = faceapi.euclideanDistance(idFace.descriptor, selfieFace.descriptor);
        
        // Convert distance to confidence percentage (lower distance = higher confidence)
        // Typical threshold is around 0.6 for face matching
        const confidence = Math.max(0, Math.min(100, (1 - distance) * 100));
        const threshold = 40; // 40% confidence threshold
        
        const isMatch = confidence >= threshold;
        
        // Get additional face analysis
        const idAnalysis = {
            age: Math.round(idFace.age),
            gender: idFace.gender,
            genderProbability: Math.round(idFace.genderProbability * 100)
        };
        
        const selfieAnalysis = {
            age: Math.round(selfieFace.age),
            gender: selfieFace.gender,
            genderProbability: Math.round(selfieFace.genderProbability * 100)
        };

        return {
            success: true,
            isMatch: isMatch,
            confidence: Math.round(confidence),
            threshold: threshold,
            distance: distance,
            recommendation: this._getRecommendation(confidence),
            analysis: {
                id: idAnalysis,
                selfie: selfieAnalysis,
                ageMatch: Math.abs(idAnalysis.age - selfieAnalysis.age) <= 10,
                genderMatch: idAnalysis.gender === selfieAnalysis.gender
            }
        };
    }

    /**
     * Get verification recommendation based on confidence
     * @param {number} confidence - Confidence percentage
     * @returns {Object} Recommendation object
     */
    _getRecommendation(confidence) {
        if (confidence >= 70) {
            return {
                status: 'approve',
                message: 'High confidence match - Recommend approval',
                color: '#10b981'
            };
        } else if (confidence >= 40) {
            return {
                status: 'review',
                message: 'Medium confidence - Manual review recommended',
                color: '#f59e0b'
            };
        } else {
            return {
                status: 'reject',
                message: 'Low confidence match - Recommend rejection',
                color: '#ef4444'
            };
        }
    }

    /**
     * Load image from File or data URL
     * @param {File|string} source - Image file or data URL
     * @returns {Promise<HTMLImageElement>} Loaded image element
     */
    async _loadImage(source) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Failed to load image'));
            
            if (source instanceof File) {
                const reader = new FileReader();
                reader.onload = (e) => img.src = e.target.result;
                reader.onerror = () => reject(new Error('Failed to read image file'));
                reader.readAsDataURL(source);
            } else {
                img.src = source;
            }
        });
    }

    /**
     * Extract text from government ID using Tesseract.js (optional)
     * @param {File|string} idImage - Government ID image
     * @returns {Promise<Object>} Extracted text data
     */
    async extractIDText(idImage) {
        try {
            console.log('[FaceVerification] Extracting text from ID...');
            
            // This would require Tesseract.js to be loaded
            if (typeof Tesseract === 'undefined') {
                console.warn('[FaceVerification] Tesseract.js not loaded, skipping text extraction');
                return { success: false, error: 'OCR not available' };
            }

            const result = await Tesseract.recognize(idImage, 'eng');
            
            return {
                success: true,
                text: result.data.text,
                confidence: result.data.confidence,
                words: result.data.words
            };
        } catch (error) {
            console.error('[FaceVerification] Text extraction failed:', error);
            return {
                success: false,
                error: 'Text extraction failed',
                details: error.message
            };
        }
    }

    /**
     * Generate verification report for admin review
     * @param {Object} verificationResult - Result from verifyFaceMatch
     * @param {Object} additionalData - Additional seller data
     * @returns {Object} Formatted report
     */
    generateReport(verificationResult, additionalData = {}) {
        const timestamp = new Date().toISOString();
        
        return {
            timestamp,
            sellerId: additionalData.sellerId || 'unknown',
            sellerName: additionalData.sellerName || 'Unknown',
            verification: {
                success: verificationResult.success,
                confidence: verificationResult.confidence || 0,
                isMatch: verificationResult.isMatch || false,
                recommendation: verificationResult.recommendation || { status: 'review' }
            },
            analysis: verificationResult.analysis || {},
            technicalDetails: {
                distance: verificationResult.distance,
                threshold: verificationResult.threshold,
                error: verificationResult.error
            },
            adminNotes: '',
            status: 'pending_review'
        };
    }
}

// Create global instance
window.faceVerification = new FaceVerificationSystem();

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('[FaceVerification] Auto-initializing...');
        await window.faceVerification.initialize();
        console.log('[FaceVerification] Ready for use!');
    } catch (error) {
        console.error('[FaceVerification] Auto-initialization failed:', error);
    }
});

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FaceVerificationSystem;
}