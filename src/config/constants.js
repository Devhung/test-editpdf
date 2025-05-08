export const DEFAULT_SCALE = 1.6; // Default scale used across the application

// Image configuration
export const IMAGE_CONFIG = {
  // Allowed MIME types for image upload
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],

  // Accept attribute string for file input
  ACCEPT_ATTRIBUTE: 'image/jpeg,image/png,image/gif,image/webp',

  // Maximum file size in bytes (e.g., 20MB)
  MAX_FILE_SIZE: 20 * 1024 * 1024,

  // Page size constraints
  PAGE_SIZE: {
    MAX_RATIO: 0.8, // Maximum ratio of page size (80%)
  }
};
