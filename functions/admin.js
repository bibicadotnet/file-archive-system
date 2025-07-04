// Cloudflare Pages Functions - Admin File Manager
// File: functions/admin.js

export async function onRequest(context) {
    const { request, env } = context;
    
    const STORAGE_ACCOUNTS = [
        ["YOUR_ACCOUNT_ID_1", "load001", "auto", "YOUR_ACCESS_KEY_1", "YOUR_SECRET_KEY_1", "YOUR_ACCOUNT_ID_1.r2.cloudflarestorage.com", "r2", "YOUR_PUBLIC_ACCOUNT_ID_1"],
        ["YOUR_ACCOUNT_ID_2", "load002", "auto", "YOUR_ACCESS_KEY_2", "YOUR_SECRET_KEY_2", "YOUR_ACCOUNT_ID_2.r2.cloudflarestorage.com", "r2", "YOUR_PUBLIC_ACCOUNT_ID_2"],
        ["YOUR_ACCOUNT_ID_3", "load003", "auto", "YOUR_ACCESS_KEY_3", "YOUR_SECRET_KEY_3", "YOUR_ACCOUNT_ID_3.r2.cloudflarestorage.com", "r2", "YOUR_PUBLIC_ACCOUNT_ID_3"],
        ["YOUR_ACCOUNT_ID_4", "load004", "auto", "YOUR_ACCESS_KEY_4", "YOUR_SECRET_KEY_4", "YOUR_ACCOUNT_ID_4.r2.cloudflarestorage.com", "r2", "YOUR_PUBLIC_ACCOUNT_ID_4"],
        ["YOUR_ACCOUNT_ID_5", "load005", "auto", "YOUR_ACCESS_KEY_5", "YOUR_SECRET_KEY_5", "YOUR_ACCOUNT_ID_5.r2.cloudflarestorage.com", "r2", "YOUR_PUBLIC_ACCOUNT_ID_5"]
    ];

    if (request.method === 'GET') {
        return new Response(getAdminHTML(), {
            headers: { 'Content-Type': 'text/html' }
        });
    }

    if (request.method === 'POST') {
        try {
            const formData = await request.formData();
            const action = formData.get('action');
            const fileUrl = formData.get('url');
            
            if (!fileUrl) {
                return new Response(JSON.stringify({ error: 'URL cannot be empty' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Trích xuất filename và folder từ URL
            const { filename, folder } = extractFilename(fileUrl);
            if (!filename) {
                return new Response(JSON.stringify({ error: 'Cannot extract filename from URL' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Tìm file trong database
            const fileRecord = await findFileInDatabase(env.DB, filename, folder);
            if (!fileRecord) {
                return new Response(JSON.stringify({ error: 'File not found in database' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Xử lý theo action
            if (action === 'delete') {
                // Tìm thông tin tài khoản storage
                const storageAccount = STORAGE_ACCOUNTS.find(account => account[0] === fileRecord.account_id);
                if (!storageAccount) {
                    return new Response(JSON.stringify({ error: 'Storage account information not found' }), {
                        status: 404,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                // Xóa file từ R2
                const deleteResult = await deleteFileFromR2(fileRecord, storageAccount);
                if (!deleteResult.success) {
                    return new Response(JSON.stringify({ error: `Error deleting file from R2: ${deleteResult.error}` }), {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                // Xóa record từ database
                const dbDeleteResult = await deleteFileFromDatabase(env.DB, fileRecord.id);
                if (!dbDeleteResult.success) {
                    return new Response(JSON.stringify({ error: `Error deleting file from database: ${dbDeleteResult.error}` }), {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                return new Response(JSON.stringify({ 
                    success: true, 
                    message: 'File deleted successfully',
                    fileInfo: {
                        filename: fileRecord.filename,
                        folder: fileRecord.folder,
                        account_id: fileRecord.account_id
                    }
                }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } 
            else if (action === 'rename') {
                const newFilename = formData.get('newFilename');
                const newFolder = formData.get('newFolder') || fileRecord.folder || '';
                
                if (!newFilename) {
                    return new Response(JSON.stringify({ error: 'New filename cannot be empty' }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
                
                // Debug log for troubleshooting
                console.log('Rename operation:', {
                    fileId: fileRecord.id,
                    oldFilename: fileRecord.filename,
                    oldFolder: fileRecord.folder || '',
                    newFilename,
                    newFolder
                });
                
                // Skip check if the filename and folder are the same (no actual rename)
                if (fileRecord.filename === newFilename && (fileRecord.folder || '') === newFolder) {
                    return new Response(JSON.stringify({ 
                        success: true, 
                        message: 'No changes made - filename and folder are the same',
                        fileInfo: {
                            oldFilename: fileRecord.filename,
                            oldFolder: fileRecord.folder || '',
                            newFilename: newFilename,
                            newFolder: newFolder,
                            account_id: fileRecord.account_id
                        }
                    }), {
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
                
                // Check if the new filename already exists in the database
                const existingFile = await findFileInDatabaseByNameAndFolder(env.DB, newFilename, newFolder);
                
                // Debug log for troubleshooting
                console.log('Existing file check:', {
                    existingFile: existingFile ? {
                        id: existingFile.id,
                        filename: existingFile.filename,
                        folder: existingFile.folder || ''
                    } : null
                });
                
                if (existingFile && existingFile.id !== fileRecord.id) {
                    return new Response(JSON.stringify({ error: 'A file with this name already exists in the specified folder' }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
                
                // Rename file in database
                const renameResult = await renameFileInDatabase(env.DB, fileRecord.id, newFilename, newFolder);
                if (!renameResult.success) {
                    return new Response(JSON.stringify({ error: `Error renaming file: ${renameResult.error}` }), {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
                
                return new Response(JSON.stringify({ 
                    success: true, 
                    message: 'File renamed successfully',
                    fileInfo: {
                        oldFilename: fileRecord.filename,
                        oldFolder: fileRecord.folder || '',
                        newFilename: newFilename,
                        newFolder: newFolder,
                        account_id: fileRecord.account_id
                    }
                }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            else if (action === 'checkFile') {
                // Return file information for the UI
                return new Response(JSON.stringify({ 
                    success: true, 
                    fileInfo: {
                        filename: fileRecord.filename,
                        folder: fileRecord.folder || '',
                        account_id: fileRecord.account_id,
                        file_size: fileRecord.file_size,
                        upload_time: fileRecord.upload_time,
                        content_type: fileRecord.content_type
                    }
                }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            else {
                return new Response(JSON.stringify({ error: 'Invalid action' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

        } catch (error) {
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    return new Response('Method not allowed', { status: 405 });
}

// Trích xuất filename và folder từ URL
function extractFilename(url) {
    const pathOnly = url.replace(/^(https?:\/\/[^\/]+)?\/?/, '');
    
    const segments = pathOnly.split('/').filter(Boolean);
    const filename = segments.pop() || '';
    const folder = segments.join('/');
    
    return { filename, folder };
}

// Tìm file trong database (chính xác theo URL người dùng nhập)
async function findFileInDatabase(db, filename, folder = '') {
    try {
        const query = `
            SELECT id, folder, filename, storage_url, file_size, account_id, upload_time, content_type 
            FROM images 
            WHERE filename = ? AND (folder = ? OR (folder IS NULL AND ? = ''))
        `;
        const result = await db.prepare(query).bind(filename, folder, folder).first();
        return result;
    } catch (error) {
        console.error('Error finding file in database:', error);
        return null;
    }
}

// Tìm file trong database theo tên và thư mục
async function findFileInDatabaseByNameAndFolder(db, filename, folder) {
    try {
        let query;
        let params = [];
        
        // Handle null/empty folder values properly
        if (folder === null || folder === undefined || folder === '') {
            query = `
                SELECT id, folder, filename, storage_url, file_size, account_id, upload_time, content_type 
                FROM images 
                WHERE filename = ? AND (folder IS NULL OR folder = '' OR folder = 'null')
            `;
            params = [filename];
        } else {
            query = `
                SELECT id, folder, filename, storage_url, file_size, account_id, upload_time, content_type 
                FROM images 
                WHERE filename = ? AND folder = ?
            `;
            params = [filename, folder];
        }
        
        const result = await db.prepare(query).bind(...params).first();
        return result;
    } catch (error) {
        console.error('Error finding file in database:', error);
        return null;
    }
}

// Xóa file từ R2
async function deleteFileFromR2(fileRecord, storageAccount) {
    try {
        const [account_id, bucket_name, region, access_key_id, secret_access_key, endpoint] = storageAccount;
        
        // Verify storage_url exists
        if (!fileRecord.storage_url) {
            return { success: false, error: 'Storage URL not found in file record' };
        }
        
        // Extract file key from storage_url
        let fileKey;
        try {
            const url = new URL(fileRecord.storage_url);
            fileKey = url.pathname.substring(1); // Remove leading slash
            if (!fileKey) {
                return { success: false, error: 'Could not extract file key from storage URL' };
            }
        } catch (error) {
            return { success: false, error: `Invalid storage URL: ${fileRecord.storage_url}` };
        }
        
        // Create S3 compatible delete request
        const deleteUrl = `https://${endpoint}/${bucket_name}/${fileKey}`;
        
        // Create timestamp and date for signature
        const timestamp = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
        const date = timestamp.substr(0, 8);
        
        // SHA256 of empty payload (DELETE has no body)
        const payloadHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
        
        // Create canonical request
        const canonicalRequest = `DELETE\n/${bucket_name}/${fileKey}\n\nhost:${endpoint}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${timestamp}\n\nhost;x-amz-content-sha256;x-amz-date\n${payloadHash}`;
        
        // Create string to sign
        const stringToSign = `AWS4-HMAC-SHA256\n${timestamp}\n${date}/${region}/s3/aws4_request\n${await sha256(canonicalRequest)}`;
        
        // Create signing key
        const signingKey = await getSignatureKey(secret_access_key, date, region, 's3');
        const signature = await hmacSha256(signingKey, stringToSign);
        
        // Create authorization header
        const authorizationHeader = `AWS4-HMAC-SHA256 Credential=${access_key_id}/${date}/${region}/s3/aws4_request,SignedHeaders=host;x-amz-content-sha256;x-amz-date,Signature=${signature}`;
        
        // Send request
        const response = await fetch(deleteUrl, {
            method: 'DELETE',
            headers: {
                'Host': endpoint,
                'x-amz-content-sha256': payloadHash,
                'x-amz-date': timestamp,
                'Authorization': authorizationHeader
            }
        });
        
        if (response.ok || response.status === 404) {
            return { success: true };
        } else {
            const errorText = await response.text();
            return { success: false, error: `HTTP ${response.status}: ${errorText}` };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Xóa file từ database
async function deleteFileFromDatabase(db, fileId) {
    try {
        const query = `DELETE FROM images WHERE id = ?`;
        await db.prepare(query).bind(fileId).run();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Đổi tên file trong database
async function renameFileInDatabase(db, fileId, newFilename, newFolder) {
    try {
        const query = `UPDATE images SET filename = ?, folder = ? WHERE id = ?`;
        await db.prepare(query).bind(newFilename, newFolder, fileId).run();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Helper functions for AWS Signature V4
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256(key, message) {
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        typeof key === 'string' ? new TextEncoder().encode(key) : key,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
    const hashArray = Array.from(new Uint8Array(signature));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getSignatureKey(key, dateStamp, regionName, serviceName) {
    const kDate = await hmacSha256(new TextEncoder().encode('AWS4' + key), dateStamp);
    const kRegion = await hmacSha256(hexToBytes(kDate), regionName);
    const kService = await hmacSha256(hexToBytes(kRegion), serviceName);
    const kSigning = await hmacSha256(hexToBytes(kService), 'aws4_request');
    return hexToBytes(kSigning);
}

function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
}

// HTML cho trang admin
function getAdminHTML() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>File Archive System - File Manager</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            background-color: #f5f5f5;
            color: #333;
            line-height: 1.6;
            padding: 20px;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 5px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            padding: 30px;
        }
        
        h1 {
            color: #444;
            margin-bottom: 20px;
            font-size: 24px;
            font-weight: 500;
            border-bottom: 1px solid #eee;
            padding-bottom: 10px;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
            color: #555;
        }
        
        input[type="url"], input[type="text"] {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
        }
        
        input[type="url"]:focus, input[type="text"]:focus {
            outline: none;
            border-color: #4285f4;
            box-shadow: 0 0 0 2px rgba(66, 133, 244, 0.2);
        }
        
        .btn {
            background-color: #4285f4;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: background-color 0.2s;
            margin-right: 10px;
        }
        
.btn:not(:disabled):hover {
    background-color: #3367d6;
}
        
        .btn:disabled {
            background-color: #cccccc;
            cursor: not-allowed;
        }
        
        .btn-danger {
            background-color: #ea4335;
        }
        
.btn-danger:not(:disabled):hover {
    background-color: #d33828;
}
        
        .result {
            margin-top: 20px;
            padding: 15px;
            border-radius: 4px;
        }
        
        .success {
            background-color: #e6f4ea;
            color: #0d652d;
            border: 1px solid #b7e1cd;
        }
        
        .error {
            background-color: #fce8e6;
            color: #c5221f;
            border: 1px solid #f5c0b8;
        }
        
        .info {
            background-color: #e8f0fe;
            color: #1a73e8;
            border: 1px solid #c2d7f8;
        }
        
        .loading {
            color: #70757a;
        }
        
        .file-info {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 4px;
            margin-top: 15px;
            border-left: 3px solid #4285f4;
        }
        
        .file-info h3 {
            margin-top: 0;
            margin-bottom: 10px;
            font-size: 16px;
        }
        
        .file-info p {
            margin: 5px 0;
        }

        .button-group {
            display: flex;
            gap: 10px;
            margin-top: 20px;
        }
        
        #renameForm {
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            display: none;
        }
        
        .current-file-info {
            background-color: #f8f9fa;
            padding: 10px 15px;
            border-radius: 4px;
            margin: 10px 0;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>File Archive System - File Manager</h1>
        
        <form id="fileForm">
            <div class="form-group">
                <label for="url">File URL:</label>
<input type="url" id="url" name="url" 
       placeholder="http://current-domain/filename.ext or filename.ext, folder/filename.ext" 
       required>
            </div>
            
            <div id="fileInfoDisplay"></div>
            
            <div class="button-group">
                <button type="button" class="btn btn-danger" id="deleteBtn" disabled>Delete File</button>
                <button type="button" class="btn" id="renameBtn" disabled>Rename File</button>
            </div>
        </form>
        
        <form id="renameForm">
            <div class="current-file-info">
                <div id="currentFileInfo"></div>
            </div>
            
            <div class="form-group">
                <label for="newFilename">New filename:</label>
                <input type="text" id="newFilename" name="newFilename" required>
            </div>
            
            <div class="form-group">
                <label for="newFolder">New folder (optional):</label>
                <input type="text" id="newFolder" name="newFolder">
            </div>
            
            <button type="submit" class="btn" id="submitRenameBtn">
                Rename File
            </button>
        </form>
        
        <div id="result"></div>
    </div>

    <script>
        // Elements
        const urlInput = document.getElementById('url');
        const fileForm = document.getElementById('fileForm');
        const deleteBtn = document.getElementById('deleteBtn');
        const renameBtn = document.getElementById('renameBtn');
        const renameForm = document.getElementById('renameForm');
        const newFilenameInput = document.getElementById('newFilename');
        const newFolderInput = document.getElementById('newFolder');
        const resultDiv = document.getElementById('result');
        const fileInfoDisplay = document.getElementById('fileInfoDisplay');
        const currentFileInfo = document.getElementById('currentFileInfo');
        
        let currentFileData = null;
        
        // Check if file exists when URL input changes
        urlInput.addEventListener('input', debounce(checkFileExists, 500));

        document.getElementById('url').placeholder = 
    document.getElementById('url').placeholder
    .replace('current-domain', location.hostname);

        
        // Debounce function to prevent too many API calls
        function debounce(func, wait) {
            let timeout;
            return function() {
                const context = this;
                const args = arguments;
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    func.apply(context, args);
                }, wait);
            };
        }
        
        // Check if file exists in database
        async function checkFileExists() {
            let url = urlInput.value.trim();
            
            if (!url) {
                resetUI();
                return;
            }
            
            // If the input is not a full URL, prepend the current domain
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = window.location.origin + '/' + url;
            }
            
            try {
                const formData = new FormData();
                formData.append('url', url);
                formData.append('action', 'checkFile');
                
                const response = await fetch('/admin', {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                
                if (data.success) {
                    currentFileData = data.fileInfo;
                    
                    // Enable buttons
                    deleteBtn.disabled = false;
                    renameBtn.disabled = false;
                    
                    // Display file info
                    fileInfoDisplay.innerHTML = '<div class="current-file-info">' +
                        '<strong>Current file:</strong> ' + 
                        currentFileData.filename +
                        '<br><strong>Current folder:</strong> ' + 
                        (currentFileData.folder ? currentFileData.folder : 'None') +
                        '</div>';
                        
                    // Update rename form if visible
                    if (renameForm.style.display === 'block') {
                        updateRenameForm();
                    }
                } else {
                    resetUI();
                    fileInfoDisplay.innerHTML = '<div class="result error">File not found in database</div>';
                }
            } catch (error) {
                resetUI();
                fileInfoDisplay.innerHTML = '<div class="result error">Error checking file: ' + error.message + '</div>';
            }
        }
        
        // Reset UI elements
        function resetUI() {
            currentFileData = null;
            deleteBtn.disabled = true;
            renameBtn.disabled = true;
            renameForm.style.display = 'none';
            fileInfoDisplay.innerHTML = '';
        }
        
        // Delete button click handler
        deleteBtn.addEventListener('click', async function() {
            if (!currentFileData) return;
            
            if (!confirm('Are you sure you want to delete this file?')) {
                return;
            }
            
            deleteBtn.disabled = true;
            deleteBtn.textContent = 'Deleting...';
            
            try {
                const formData = new FormData();
                formData.append('url', urlInput.value);
                formData.append('action', 'delete');
                
                const response = await fetch('/admin', {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                
                if (data.success) {
                    resultDiv.innerHTML = 
                        '<div class="result success">' +
                        ' ' + data.message +
                        '<div class="file-info">' +
                        '<h3>Deleted File Information:</h3>' +
                        '<p><strong>Filename:</strong> ' + data.fileInfo.filename + '</p>' +
                        '<p><strong>Folder:</strong> ' + (data.fileInfo.folder || 'None') + '</p>' +
                        '<p><strong>Account ID:</strong> ' + data.fileInfo.account_id + '</p>' +
                        '</div>' +
                        '</div>';

                    urlInput.value = '';
                    currentFileData = null;
                    deleteBtn.disabled = true;
                    renameBtn.disabled = true;
                    renameForm.style.display = 'none';
                    fileInfoDisplay.innerHTML = '';
                } else {
                    resultDiv.innerHTML = '<div class="result error">❌ ' + data.error + '</div>';
                }
            } catch (error) {
                resultDiv.innerHTML = '<div class="result error">❌ Error: ' + error.message + '</div>';
            } finally {
                deleteBtn.textContent = 'Delete File';
                if (!urlInput.value.trim()) {
                    deleteBtn.disabled = true;
                } else {
                    deleteBtn.disabled = false;
                }
            }
        });
        
        // Rename button click handler
        renameBtn.addEventListener('click', function() {
            if (!currentFileData) return;
            
            // Show rename form
            renameForm.style.display = 'block';
            updateRenameForm();
            
            // Scroll to rename form
            renameForm.scrollIntoView({ behavior: 'smooth' });
        });
        
        // Update rename form with current file data
        function updateRenameForm() {
            if (!currentFileData) return;
            
            currentFileInfo.innerHTML = '<strong>Current filename:</strong> ' + currentFileData.filename + 
                '<br><strong>Current folder:</strong> ' + (currentFileData.folder || 'None');
            
            // Set default values
            newFilenameInput.value = currentFileData.filename;
            newFolderInput.value = currentFileData.folder || '';
        }
        
        // Rename form submit handler
        renameForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            if (!currentFileData) return;
            
            const submitBtn = document.getElementById('submitRenameBtn');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Renaming...';
            
            try {
                let url = urlInput.value.trim();
                // If the input is not a full URL, prepend the current domain
                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    url = window.location.origin + '/' + url;
                }
                console.log('Renaming file with URL:', url); // Debugging log
                const formData = new FormData();
                formData.append('url', url);
                formData.append('action', 'rename');
                formData.append('newFilename', newFilenameInput.value);
                formData.append('newFolder', newFolderInput.value);
                
                const response = await fetch('/admin', {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                
                if (data.success) {
                    // Construct new URL based on the same domain as the original URL
                    const originalUrl = new URL(url);
                    const newPath = (data.fileInfo.newFolder ? '/' + data.fileInfo.newFolder : '') + '/' + data.fileInfo.newFilename;
                    const newUrl = originalUrl.origin + newPath;
                    
                    resultDiv.innerHTML = 
                        '<div class="result success">' +
                        ' ' + data.message +
                        '<div class="file-info">' +
                        '<h3>Renamed File Information:</h3>' +
                        '<p><strong>Old filename:</strong> ' + data.fileInfo.oldFilename + '</p>' +
                        '<p><strong>Old folder:</strong> ' + (data.fileInfo.oldFolder || 'None') + '</p>' +
                        '<p><strong>New filename:</strong> ' + data.fileInfo.newFilename + '</p>' +
                        '<p><strong>New folder:</strong> ' + (data.fileInfo.newFolder || 'None') + '</p>' +
                        '<p><strong>New URL:</strong> <a href="' + newUrl + '" target="_blank">' + newUrl + '</a></p>' +
                        '</div>' +
                        '</div>';
                    
                    // Reset form and UI
                    urlInput.value = '';
                    resetUI();
                } else {
                    resultDiv.innerHTML = '<div class="result error">❌ ' + data.error + '</div>';
                }
            } catch (error) {
                console.error('Error during rename operation:', error); // Debugging log
                resultDiv.innerHTML = '<div class="result error">❌ Error: ' + error.message + '</div>';
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Rename File';
            }
        });
    </script>
</body>
</html>
    `;
}    
