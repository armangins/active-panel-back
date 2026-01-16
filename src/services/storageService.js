const { storage } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');

const storageService = {
    /**
     * Upload a file to Firebase Storage
     * @param {Buffer} buffer - File buffer
     * @param {string} originalname - Original filename
     * @param {string} mimetype - File mimetype
     * @returns {Promise<string>} - Public URL of the uploaded file
     */
    uploadFile: async (buffer, originalname, mimetype) => {
        try {
            const bucket = storage.bucket();
            const filename = `${uuidv4()}-${originalname}`;
            const file = bucket.file(filename);

            await file.save(buffer, {
                metadata: {
                    contentType: mimetype,
                },
                public: true, // Make the file public immediately
            });

            // Construct public URL
            // Firebase Storage public URL format:
            // https://storage.googleapis.com/YOUR_BUCKET_NAME/FILENAME
            // OR for default bucket:
            // https://firebasestorage.googleapis.com/v0/b/YOUR_BUCKET_NAME/o/FILENAME?alt=media
            
            // Getting the signed URL or public URL depends on bucket settings.
            // Using public() makes it accessible via the media link.
            
            // Let's use getPublicUrl if available or construct standard one.
            // But simpler: `file.publicUrl()` method exists in newer SDKs or we just construct it.
            
            // Standard generic public URL for Firebase/GCS
            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;
            
            return publicUrl;
        } catch (error) {
            console.error('Storage Upload Error:', error);
            throw new Error('Failed to upload file to storage');
        }
    },

    /**
     * Delete a file from Firebase Storage
     * @param {string} fileUrl - Public URL of the file to delete
     * @returns {Promise<void>}
     */
    deleteFile: async (fileUrl) => {
        try {
            const bucket = storage.bucket();
            
            // Extract filename from URL
            // Format: https://storage.googleapis.com/BUCKET_NAME/FILENAME
            const urlParts = fileUrl.split('/');
            const filename = urlParts[urlParts.length - 1];
            
            if (!filename) {
                console.warn('Could not extract filename from URL:', fileUrl);
                return;
            }

            const file = bucket.file(filename);
            
            // Check if file exists before attempting to delete
            const [exists] = await file.exists();
            if (exists) {
                await file.delete();
                console.log('Deleted file from storage:', filename);
            } else {
                console.log('File not found in storage:', filename);
            }
        } catch (error) {
            console.error('Storage Delete Error:', error);
            // Don't throw - we don't want to fail the product update if cleanup fails
        }
    },

    /**
     * Delete multiple files from Firebase Storage
     * @param {string[]} fileUrls - Array of public URLs to delete
     * @returns {Promise<void>}
     */
    deleteFiles: async (fileUrls) => {
        try {
            await Promise.all(fileUrls.map(url => storageService.deleteFile(url)));
        } catch (error) {
            console.error('Batch Storage Delete Error:', error);
        }
    }
};

module.exports = storageService;
