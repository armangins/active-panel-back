<?php
/**
 * Plugin Name: ActivePanel Connector
 * Description: Essential connection bridge for ActivePanel. Handles CORS, performance tuning, and upload reliability.
 * Version: 1.1.0
 * Author: ActivePanel
 */

// ==========================================
// 1. CONNECTIVITY (CORS & HEADERS)
// ==========================================

// Allow unlimited CORS for REST API (Fixes interactions from dashboard)
add_action('rest_api_init', function() {
    remove_filter('rest_pre_serve_request', 'rest_send_cors_headers');
    add_filter('rest_pre_serve_request', function($value) {
        // Security: In production, you might want to limit Origin to 'https://activepanel.web.app'
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: POST, GET, OPTIONS, PUT, DELETE');
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Headers: Authorization, X-WP-Nonce, Content-Disposition, Content-MD5, Content-Type');
        
        // Reliability: Prevent caching of API responses (Fixes "stale data" bugs)
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');
        
        return $value;
    });
}, 15);

// ==========================================
// 2. IMAGE & MEDIA ACCESS (.htaccess)
// ==========================================

// Add rules to .htaccess on activation to allow images to be loaded by the App
register_activation_hook(__FILE__, 'activepanel_add_htaccess_rules');
register_deactivation_hook(__FILE__, 'activepanel_remove_htaccess_rules');

function activepanel_add_htaccess_rules() {
    $htaccess_file = ABSPATH . '.htaccess';
    $rules = "\n" .
        "# BEGIN ActivePanel CORS\n" .
        "<IfModule mod_headers.c>\n" .
        "    <FilesMatch \"\.(ttf|ttc|otf|eot|woff|woff2|font.css|css|js|gif|png|jpe?g|svg|svgz|ico|webp)$\">\n" .
        "        Header set Access-Control-Allow-Origin \"*\"\n" .
        "    </FilesMatch>\n" .
        "</IfModule>\n" .
        "# END ActivePanel CORS\n";

    if (file_exists($htaccess_file) && is_writable($htaccess_file)) {
        $content = file_get_contents($htaccess_file);
        if (strpos($content, '# BEGIN ActivePanel CORS') === false) {
            file_put_contents($htaccess_file, $content . $rules);
        }
    }
}

function activepanel_remove_htaccess_rules() {
    $htaccess_file = ABSPATH . '.htaccess';
    if (file_exists($htaccess_file) && is_writable($htaccess_file)) {
        $content = file_get_contents($htaccess_file);
        $content = preg_replace('/# BEGIN ActivePanel CORS(.*?)# END ActivePanel CORS\s*/s', '', $content);
        file_put_contents($htaccess_file, $content);
    }
}

// ==========================================
// 3. PERFORMANCE & RELIABILITY
// ==========================================

// Speed: Boost Memory Limit for API requests (Prevents crash on large image uploads)
add_action('rest_api_init', function() {
    @ini_set('memory_limit', '512M');
    @ini_set('max_execution_time', 300); // 5 minutes
});

// Quality: Disable big image scaling (WP 5.3+ scales down huge images, which we don't want)
add_filter('big_image_size_threshold', '__return_false');

// Fix: Allow SVG Uploads (Optional, but often requested for logos/icons)
add_filter('upload_mimes', function($mimes) {
    $mimes['svg'] = 'image/svg+xml';
    return $mimes;
});
