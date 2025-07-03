// server.js

const DEFAULT_CONFIG = {
    CORS: {
        ALLOWED_ORIGINS: [
            'https://your-domain.com',
        ]
    },
    RATE_LIMIT: {
        MAX_REQUESTS: 500000,
        TIME_WINDOW_MINUTES: 5,
    },
    STORAGE: {
        MAX_SIZE_GB: 7000,
    },
    FILE: {
        MAX_SIZE_MB: 500000,
        ALLOWED_TYPES: [] // Allow all file types
    },
    PATH: {
        FOLDER_LENGTH: 0,
        FILENAME_LENGTH: 8,
    },
    ABUSE_PROTECTION: {
        MAX_FAILED_READS: 50,
        TIME_WINDOW_MINUTES: 1440,
        BLOCK_DURATION_HOURS: 24,
    },
    MULTIPART: {
        MAX_BATCH_SIZE_MB: 40,
        PART_SIZE_MB: 10, // Size of each part in multipart upload
    },
};

// S3-compatible storage account configuration
// Format: [account_id, bucket_name, region, access_key_id, secret_access_key, endpoint, storage_type (optional), public_account_id (optional)]
// storage_type: only add 'r2' for Cloudflare R2, omit for other S3-compatible storage
// public_account_id: only add for Cloudflare R2 if different from account_id, omit for other storage
//    ["3d9acad2f6d4b918907f0c18", "image-archive-s3", "us-east-005", "005daa564980fc80000000001", "K005rTcC+6jZoGKvtJflNGtYxYr+oIE", "s3.us-east-005.backblazeb2.com", "s3"],
const STORAGE_ACCOUNTS = [
    
["YOUR_ACCOUNT_ID_1", "load001", "auto", "YOUR_ACCESS_KEY_1", "YOUR_SECRET_KEY_1", "YOUR_ACCOUNT_ID_1.r2.cloudflarestorage.com", "r2", "YOUR_PUBLIC_ACCOUNT_ID_1"],
["YOUR_ACCOUNT_ID_2", "load002", "auto", "YOUR_ACCESS_KEY_2", "YOUR_SECRET_KEY_2", "YOUR_ACCOUNT_ID_2.r2.cloudflarestorage.com", "r2", "YOUR_PUBLIC_ACCOUNT_ID_2"],
["YOUR_ACCOUNT_ID_3", "load003", "auto", "YOUR_ACCESS_KEY_3", "YOUR_SECRET_KEY_3", "YOUR_ACCOUNT_ID_3.r2.cloudflarestorage.com", "r2", "YOUR_PUBLIC_ACCOUNT_ID_3"],
["YOUR_ACCOUNT_ID_4", "load004", "auto", "YOUR_ACCESS_KEY_4", "YOUR_SECRET_KEY_4", "YOUR_ACCOUNT_ID_4.r2.cloudflarestorage.com", "r2", "YOUR_PUBLIC_ACCOUNT_ID_4"],
["YOUR_ACCOUNT_ID_5", "load005", "auto", "YOUR_ACCESS_KEY_5", "YOUR_SECRET_KEY_5", "YOUR_ACCOUNT_ID_5.r2.cloudflarestorage.com", "r2", "YOUR_PUBLIC_ACCOUNT_ID_5"],

];

const CONFIG = {
    CORS: DEFAULT_CONFIG.CORS,
    RATE_LIMIT: {
        MAX_REQUESTS: DEFAULT_CONFIG.RATE_LIMIT.MAX_REQUESTS,
        TIME_WINDOW_MINUTES: DEFAULT_CONFIG.RATE_LIMIT.TIME_WINDOW_MINUTES,
        TIME_WINDOW_MS: DEFAULT_CONFIG.RATE_LIMIT.TIME_WINDOW_MINUTES * 60 * 1000
    },
    FILE: {
        MAX_SIZE_MB: DEFAULT_CONFIG.FILE.MAX_SIZE_MB,
        MAX_SIZE_BYTES: DEFAULT_CONFIG.FILE.MAX_SIZE_MB * 1024 * 1024,
        ALLOWED_TYPES: DEFAULT_CONFIG.FILE.ALLOWED_TYPES
    },
    STORAGE: {
        MAX_SIZE_GB: DEFAULT_CONFIG.STORAGE.MAX_SIZE_GB,
        MAX_SIZE_BYTES: DEFAULT_CONFIG.STORAGE.MAX_SIZE_GB * 1024 * 1024 * 1024
    },    
    PATH: DEFAULT_CONFIG.PATH,
    ABUSE_PROTECTION: {
        MAX_FAILED_READS: DEFAULT_CONFIG.ABUSE_PROTECTION.MAX_FAILED_READS,
        TIME_WINDOW_MINUTES: DEFAULT_CONFIG.ABUSE_PROTECTION.TIME_WINDOW_MINUTES,
        TIME_WINDOW_MS: DEFAULT_CONFIG.ABUSE_PROTECTION.TIME_WINDOW_MINUTES * 60 * 1000,
        BLOCK_DURATION_HOURS: DEFAULT_CONFIG.ABUSE_PROTECTION.BLOCK_DURATION_HOURS,
        BLOCK_DURATION_MS: DEFAULT_CONFIG.ABUSE_PROTECTION.BLOCK_DURATION_HOURS * 60 * 60 * 1000
    },
    MULTIPART: {
        MAX_BATCH_SIZE_MB: DEFAULT_CONFIG.MULTIPART.MAX_BATCH_SIZE_MB,
        MAX_BATCH_SIZE_BYTES: DEFAULT_CONFIG.MULTIPART.MAX_BATCH_SIZE_MB * 1024 * 1024,
        PART_SIZE_MB: DEFAULT_CONFIG.MULTIPART.PART_SIZE_MB,
        PART_SIZE_BYTES: DEFAULT_CONFIG.MULTIPART.PART_SIZE_MB * 1024 * 1024,
    },
};

function getCorsHeaders(origin) {
    return CONFIG.CORS.ALLOWED_ORIGINS.includes(origin) ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin'
    } : {};
}

async function getAvailableAccounts(env) {
    const usage = await env.DB.prepare(`
        SELECT account_id, used_bytes FROM storage_usage
    `).all();
    
    return STORAGE_ACCOUNTS.filter(account => {
        const accountUsage = usage.results.find(u => u.account_id === account[0]);
        const usedBytes = accountUsage ? accountUsage.used_bytes : 0;
        return usedBytes < CONFIG.STORAGE.MAX_SIZE_BYTES;
    });
}

function getStorageAccount(env, index, availableAccounts = STORAGE_ACCOUNTS, accountId = null) {
    console.log('getStorageAccount called with:', { index, accountId });
    console.log('STORAGE_ACCOUNTS:', JSON.stringify(STORAGE_ACCOUNTS.map(acc => acc[0])));
    
    // If accountId is provided, find the specific account
    if (accountId) {
        console.log('Looking for account with ID:', accountId);
        const account = STORAGE_ACCOUNTS.find(acc => acc[0] === accountId);
        if (!account) {
            console.error(`Storage account with ID ${accountId} not found`);
            throw new Error(`Storage account with ID ${accountId} not found`);
        }
        
        const [account_id, bucket_name, region, access_key_id, secret_access_key, endpoint, storage_type, public_account_id] = account;
        
        console.log('Found account:', { account_id, bucket_name, region, endpoint, storage_type });
        
        return {
            account_id,
            bucket_name,
            region,
            access_key_id,
            secret_access_key,
            endpoint,
            storage_type: storage_type || 's3',
            public_account_id: public_account_id || account_id,
            index: STORAGE_ACCOUNTS.indexOf(account)
        };
    }
    
    // Otherwise use the original logic
    const count = availableAccounts.length;
    if (count === 0) throw new Error('All storage accounts exceeded quota');
    
    const id = Number(index);
    const safeIndex = (index == null || index === '' || isNaN(id) || id < 0 || id >= count) ? 
        Math.floor(Date.now() / 1000) % count : id;
    
    const [account_id, bucket_name, region, access_key_id, secret_access_key, endpoint, storage_type, public_account_id] = availableAccounts[safeIndex];
    
    console.log('Using account:', { account_id, bucket_name, region, endpoint, storage_type });
    
    return {
        account_id,
        bucket_name,
        region,
        access_key_id,
        secret_access_key,
        endpoint,
        storage_type: storage_type || 's3',
        public_account_id: public_account_id || account_id, // fallback to account_id
        index: safeIndex
    };
}

// AWS4 Signature helpers
async function sha256(data) {
    const encoder = new TextEncoder();
    const buffer = typeof data === 'string' ? encoder.encode(data) : data;
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

async function hmacSha256(key, data) {
    const encoder = new TextEncoder();
    const keyData = typeof key === 'string' ? encoder.encode(key) : key;
    const dataBuffer = encoder.encode(data);
    
    const cryptoKey = await crypto.subtle.importKey(
        'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataBuffer);
    return new Uint8Array(signature);
}

function getAmzDate() {
    return new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
}

function getDateStamp() {
    return new Date().toISOString().substring(0, 10).replace(/-/g, '');
}

async function createSignature(method, objectKey, headers, payload, account, queryParams = '') {
    const amzDate = getAmzDate();
    const dateStamp = getDateStamp();
    const region = account.region;
    const service = 's3';
    
    // Canonical request
    const canonicalUri = `/${objectKey}`;
    
    // Cloudflare R2 expects queryParams in a specific format
    // For uploads=, it should be just 'uploads='
    // For partNumber and uploadId, it needs to be in the format 'partNumber=1&uploadId=xxx'
    const canonicalQuerystring = queryParams;
    
    // Ensure required headers
    const allHeaders = {
        'host': account.endpoint,
        'x-amz-date': amzDate,
        'x-amz-content-sha256': await sha256(payload),
        ...headers
    };
    
    // Cloudflare R2 requires these headers to be lowercase
    const normalizedHeaders = {};
    Object.keys(allHeaders).forEach(key => {
        normalizedHeaders[key.toLowerCase()] = allHeaders[key];
    });
    
    const signedHeaders = Object.keys(normalizedHeaders).sort().join(';');
    const canonicalHeaders = Object.keys(normalizedHeaders).sort()
        .map(key => `${key}:${normalizedHeaders[key]}\n`).join('');
    
    const payloadHash = await sha256(payload);
    const canonicalRequest = [
        method,
        canonicalUri,
        canonicalQuerystring,
        canonicalHeaders,
        signedHeaders,
        payloadHash
    ].join('\n');
    
    console.log('Canonical Request:', canonicalRequest);
    
    // String to sign
    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [
        algorithm,
        amzDate,
        credentialScope,
        await sha256(canonicalRequest)
    ].join('\n');
    
    console.log('String to Sign:', stringToSign);
    
    // Calculate signature
    const kDate = await hmacSha256(`AWS4${account.secret_access_key}`, dateStamp);
    const kRegion = await hmacSha256(kDate, region);
    const kService = await hmacSha256(kRegion, service);
    const kSigning = await hmacSha256(kService, 'aws4_request');
    const signature = await hmacSha256(kSigning, stringToSign);
    
    const signatureHex = Array.from(signature)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    
    // Authorization header
    const authorization = `${algorithm} Credential=${account.access_key_id}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signatureHex}`;
    
    console.log('Authorization:', authorization);
    
    // Return only normalized headers
    return {
        ...normalizedHeaders,
        'Authorization': authorization
    };
}

// Multipart Upload functions
async function initiateMultipartUpload(account, objectKey, contentType) {
    // Đối với Cloudflare R2, cần đảm bảo URL được tạo đúng cách
    const queryParams = 'uploads=';
    const url = `https://${account.endpoint}/${account.bucket_name}/${objectKey}?uploads`;
    
    const headers = await createSignature(
        'POST',
        `${account.bucket_name}/${objectKey}`,
        {
            'content-type': contentType,
        },
        '',
        account,
        queryParams
    );
    
    console.log('Initiating multipart upload to:', url);
    console.log('Headers:', JSON.stringify(headers));
    
    const response = await fetch(url, {
        method: 'POST',
        headers: headers
    });
    
    const responseText = await response.text();
    
    if (!response.ok) {
        console.error('Multipart initiation failed:', response.status, responseText);
        throw new Error(`Failed to initiate multipart upload: ${response.status} - ${responseText}`);
    }
    
    console.log('Multipart initiation response:', responseText);
    
    const uploadIdMatch = responseText.match(/<UploadId>([^<]+)<\/UploadId>/);
    
    if (!uploadIdMatch) {
        throw new Error('Failed to extract upload ID from response');
    }
    
    return uploadIdMatch[1];
}

async function uploadPart(account, objectKey, uploadId, partNumber, partData) {
    // Đối với Cloudflare R2, cần đảm bảo URL và queryParams được tạo đúng cách
    const queryParams = `partNumber=${partNumber}&uploadId=${encodeURIComponent(uploadId)}`;
    const url = `https://${account.endpoint}/${account.bucket_name}/${objectKey}?${queryParams}`;
    
    const headers = await createSignature(
        'PUT',
        `${account.bucket_name}/${objectKey}`,
        {
            'content-length': partData.byteLength.toString()
        },
        partData,
        account,
        queryParams
    );
    
    console.log(`Uploading part ${partNumber} to: ${url}`);
    
    // Add retry logic for any server errors
    const maxRetries = 5;
    let retryCount = 0;
    let backoffTime = 1000; // Start with 1 second delay
    
    while (retryCount <= maxRetries) {
        try {
            const response = await fetch(url, {
                method: 'PUT',
                headers: headers,
                body: partData
            });
            
            if (response.ok) {
                const etag = response.headers.get('ETag');
                if (!etag) {
                    throw new Error(`No ETag returned for part ${partNumber}`);
                }
                
                console.log(`Part ${partNumber} uploaded successfully, ETag: ${etag}`);
                return etag;
            }
            
            // Get response text for error details
            const responseText = await response.text();
            
            // If we get any 5xx error, retry
            if (response.status >= 500 && response.status < 600) {
                if (retryCount < maxRetries) {
                    console.log(`Part ${partNumber} upload failed with ${response.status} error, retrying (${retryCount + 1}/${maxRetries}): ${responseText}`);
                    retryCount++;
                    
                    // Exponential backoff with jitter
                    const jitter = Math.random() * 0.3 + 0.85; // Random between 0.85 and 1.15
                    await new Promise(resolve => setTimeout(resolve, backoffTime * jitter));
                    backoffTime *= 2; // Exponential backoff
                    continue;
                }
            }
            
            // If we reach here, either it's not a 5xx error or we've exceeded retries
            console.error(`Part ${partNumber} upload failed:`, response.status, responseText);
            throw new Error(`Failed to upload part ${partNumber}: ${response.status} - ${responseText}`);
        } catch (error) {
            // For network errors, also implement retry
            if (retryCount < maxRetries && (error.message.includes('network') || error.message.includes('connection'))) {
                console.log(`Part ${partNumber} upload failed with network error, retrying (${retryCount + 1}/${maxRetries}): ${error.message}`);
                retryCount++;
                
                // Exponential backoff with jitter
                const jitter = Math.random() * 0.3 + 0.85;
                await new Promise(resolve => setTimeout(resolve, backoffTime * jitter));
                backoffTime *= 2;
                continue;
            }
            
            throw error;
        }
    }
    
    throw new Error(`Failed to upload part ${partNumber} after ${maxRetries} retries`);
}

async function completeMultipartUpload(account, objectKey, uploadId, parts) {
    // Đối với Cloudflare R2, cần đảm bảo URL và queryParams được tạo đúng cách
    const queryParams = `uploadId=${encodeURIComponent(uploadId)}`;
    const url = `https://${account.endpoint}/${account.bucket_name}/${objectKey}?${queryParams}`;
    
    const partsXml = parts.map(part => 
        `<Part><PartNumber>${part.partNumber}</PartNumber><ETag>${part.etag}</ETag></Part>`
    ).join('');
    
    const completeXml = `<CompleteMultipartUpload>${partsXml}</CompleteMultipartUpload>`;
    
    console.log(`Completing multipart upload to: ${url}`);
    console.log(`XML payload: ${completeXml}`);
    
    const headers = await createSignature(
        'POST',
        `${account.bucket_name}/${objectKey}`,
        {
            'content-type': 'application/xml',
            'content-length': completeXml.length.toString()
        },
        completeXml,
        account,
        queryParams
    );
    
    // Add retry logic for any server errors
    const maxRetries = 5;
    let retryCount = 0;
    let backoffTime = 1000; // Start with 1 second delay
    
    while (retryCount <= maxRetries) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: completeXml
            });
            
            const responseText = await response.text();
            
            if (response.ok) {
                console.log('Complete multipart upload response:', responseText);
                
                // Trả về một đối tượng giả lập response vì response.text() đã được gọi
                return {
                    ok: response.ok,
                    status: response.status,
                    headers: response.headers,
                    text: () => Promise.resolve(responseText)
                };
            }
            
            // If we get any 5xx error, retry
            if (response.status >= 500 && response.status < 600) {
                if (retryCount < maxRetries) {
                    console.log(`Complete multipart upload failed with ${response.status} error, retrying (${retryCount + 1}/${maxRetries}): ${responseText}`);
                    retryCount++;
                    
                    // Exponential backoff with jitter
                    const jitter = Math.random() * 0.3 + 0.85; // Random between 0.85 and 1.15
                    await new Promise(resolve => setTimeout(resolve, backoffTime * jitter));
                    backoffTime *= 2; // Exponential backoff
                    continue;
                }
            }
            
            // If we reach here, either it's not a 5xx error or we've exceeded retries
            console.error('Complete multipart upload failed:', response.status, responseText);
            throw new Error(`Failed to complete multipart upload: ${response.status} - ${responseText}`);
        } catch (error) {
            // For network errors, also implement retry
            if (retryCount < maxRetries && (error.message.includes('network') || error.message.includes('connection'))) {
                console.log(`Complete multipart upload failed with network error, retrying (${retryCount + 1}/${maxRetries}): ${error.message}`);
                retryCount++;
                
                // Exponential backoff with jitter
                const jitter = Math.random() * 0.3 + 0.85;
                await new Promise(resolve => setTimeout(resolve, backoffTime * jitter));
                backoffTime *= 2;
                continue;
            }
            
            throw error;
        }
    }
    
    throw new Error(`Failed to complete multipart upload after ${maxRetries} retries`);
}

async function uploadToStorageMultipart(account, file, folder, filename) {
    try {
        const objectKey = folder ? `${folder}/${filename}` : filename;
        const contentType = file.type;
        const fileBuffer = await file.arrayBuffer();
        
        // Initiate multipart upload
        const uploadId = await initiateMultipartUpload(account, objectKey, contentType);
        
        // Split file into parts
        const partSize = CONFIG.MULTIPART.PART_SIZE_BYTES;
        const totalParts = Math.ceil(fileBuffer.byteLength / partSize);
        const parts = [];
        
        // Upload each part
        for (let i = 0; i < totalParts; i++) {
            const partNumber = i + 1;
            const start = i * partSize;
            const end = Math.min(start + partSize, fileBuffer.byteLength);
            const partData = fileBuffer.slice(start, end);
            
            const etag = await uploadPart(account, objectKey, uploadId, partNumber, partData);
            parts.push({ partNumber, etag });
        }
        
        // Complete multipart upload
        await completeMultipartUpload(account, objectKey, uploadId, parts);
        
        // Return public URL for the uploaded object
        let publicUrl;
        if (account.storage_type === 'r2') {
            // R2 sử dụng pub subdomain với public_account_id
            publicUrl = `https://pub-${account.public_account_id}.r2.dev/${objectKey}`;
        } else {
            // S3 và các storage khác sử dụng endpoint trực tiếp
            publicUrl = `https://${account.endpoint}/${account.bucket_name}/${objectKey}`;
        }
        
        return { secure_url: publicUrl };
        
    } catch (error) {
        console.error('Multipart upload error:', error);
        throw error;
    }
}

async function uploadToStorage(account, file, folder, filename) {
    try {
        // Check if file size exceeds batch size limit for multipart upload
        if (file.size > CONFIG.MULTIPART.MAX_BATCH_SIZE_BYTES) {
            return await uploadToStorageMultipart(account, file, folder, filename);
        }
        
        const objectKey = folder ? `${folder}/${filename}` : filename;
        const contentType = file.type;
        const fileBuffer = await file.arrayBuffer();
        
        // Create upload URL
        const uploadUrl = `https://${account.endpoint}/${account.bucket_name}/${objectKey}`;
        
        // Create AWS4 signature
        const headers = await createSignature(
            'PUT',
            `${account.bucket_name}/${objectKey}`,
            {
                'content-type': contentType,
                'content-length': fileBuffer.byteLength.toString()
            },
            fileBuffer,
            account
        );
        
        const response = await fetch(uploadUrl, {
            method: 'PUT',
            headers: headers,
            body: fileBuffer
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Upload failed:', response.status, errorText);
            throw new Error(`Upload failed: ${response.status} - ${errorText}`);
        }
        
        // Return public URL for the uploaded object
        let publicUrl;
        if (account.storage_type === 'r2') {
        // R2 sử dụng pub subdomain với public_account_id
        publicUrl = `https://pub-${account.public_account_id}.r2.dev/${objectKey}`;
        } else {
            // S3 và các storage khác sử dụng endpoint trực tiếp
            publicUrl = `https://${account.endpoint}/${account.bucket_name}/${objectKey}`;
        }
        
        return { secure_url: publicUrl };
        
    } catch (error) {
        console.error('Storage upload error:', error);
        throw error;
    }
}

async function checkRateLimit(env, ip) {
    const currentTime = Date.now();
    const resetTime = currentTime + CONFIG.RATE_LIMIT.TIME_WINDOW_MS;
    
    try {
        const result = await env.DB.prepare(`
            INSERT INTO rate_limits (ip, count, reset_time) 
            VALUES (?, 1, ?)
            ON CONFLICT(ip) DO UPDATE SET
                count = CASE 
                    WHEN reset_time <= ? THEN 1
                    WHEN count < ? THEN count + 1
                    ELSE count
                END,
                reset_time = CASE
                    WHEN reset_time <= ? THEN ?
                    ELSE reset_time
                END
            WHERE reset_time <= ? OR count < ?
            RETURNING count, reset_time
        `).bind(
            ip, resetTime, 
            currentTime, CONFIG.RATE_LIMIT.MAX_REQUESTS,
            currentTime, resetTime,
            currentTime, CONFIG.RATE_LIMIT.MAX_REQUESTS
        ).first();
        
        if (!result) {
            return { allowed: false };
        }
        
        return { allowed: true };
        
    } catch (error) {
        console.error('Rate limit check error:', error);
        
        try {
            const current = await env.DB.prepare(`
                SELECT count, reset_time FROM rate_limits WHERE ip = ?
            `).bind(ip).first();
            
            if (!current || currentTime > current.reset_time) {
                await env.DB.prepare(`
                    INSERT OR REPLACE INTO rate_limits (ip, count, reset_time) VALUES (?, 1, ?)
                `).bind(ip, resetTime).run();
                return { allowed: true };
            }
            
            if (current.count >= CONFIG.RATE_LIMIT.MAX_REQUESTS) {
                return { allowed: false };
            }
            
            const updateResult = await env.DB.prepare(`
                UPDATE rate_limits 
                SET count = count + 1 
                WHERE ip = ? AND count = ? AND count < ?
            `).bind(ip, current.count, CONFIG.RATE_LIMIT.MAX_REQUESTS).run();
            
            return { allowed: updateResult.changes > 0 };
            
        } catch (fallbackError) {
            console.error('Fallback error:', fallbackError);
            return { allowed: false };
        }
    }
}

async function checkIfBlocked(env, ip) {
    const currentTime = Date.now();
    const record = await env.DB.prepare(`SELECT block_until FROM abuse_blocks WHERE ip = ?`).bind(ip).first();
    return record && currentTime < record.block_until;
}

async function recordFailedRead(env, ip) {
    const currentTime = Date.now();
    const record = await env.DB.prepare(`SELECT failed_count, block_until, last_attempt FROM abuse_blocks WHERE ip = ?`).bind(ip).first();
    
    if (!record) {
        const newCount = 1;
        const blockUntil = newCount >= CONFIG.ABUSE_PROTECTION.MAX_FAILED_READS ? 
            currentTime + CONFIG.ABUSE_PROTECTION.BLOCK_DURATION_MS : 0;
        await env.DB.prepare(`INSERT INTO abuse_blocks (ip, failed_count, block_until, last_attempt) VALUES (?, ?, ?, ?)`).bind(ip, newCount, blockUntil, currentTime).run();
        return;
    }
    
    if (record.block_until > 0 && currentTime > record.block_until) {
        const newCount = 1;
        const blockUntil = newCount >= CONFIG.ABUSE_PROTECTION.MAX_FAILED_READS ? 
            currentTime + CONFIG.ABUSE_PROTECTION.BLOCK_DURATION_MS : 0;
        await env.DB.prepare(`UPDATE abuse_blocks SET failed_count = ?, block_until = ?, last_attempt = ? WHERE ip = ?`).bind(newCount, blockUntil, currentTime, ip).run();
        return;
    }
    
    if (currentTime > (record.last_attempt + CONFIG.ABUSE_PROTECTION.TIME_WINDOW_MS)) {
        const newCount = 1;
        const blockUntil = newCount >= CONFIG.ABUSE_PROTECTION.MAX_FAILED_READS ? 
            currentTime + CONFIG.ABUSE_PROTECTION.BLOCK_DURATION_MS : 0;
        await env.DB.prepare(`UPDATE abuse_blocks SET failed_count = ?, block_until = ?, last_attempt = ? WHERE ip = ?`).bind(newCount, blockUntil, currentTime, ip).run();
        return;
    }
    
    const newCount = record.failed_count + 1;
    const blockUntil = newCount >= CONFIG.ABUSE_PROTECTION.MAX_FAILED_READS ? 
        currentTime + CONFIG.ABUSE_PROTECTION.BLOCK_DURATION_MS : 0;
    await env.DB.prepare(`UPDATE abuse_blocks SET failed_count = ?, block_until = ?, last_attempt = ? WHERE ip = ?`).bind(newCount, blockUntil, currentTime, ip).run();
}

function generateRandomString(length) {
    if (length === 0) return '';
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
        result += chars.charAt(array[i] % chars.length);
    }
    return result;
}

function getFileExtension(filename) {
    if (!filename) return 'bin';
    const parts = filename.toLowerCase().split('.');
    return parts.length > 1 ? parts.pop() : 'bin';
}

async function optimizeImage(account, folder, filename, storage_url, contentType) {
    try {
        const jetpackUrl = `https://i0.wp.com/${storage_url.replace('https://', '')}`;
        const optimizedResponse = await fetch(jetpackUrl, { signal: AbortSignal.timeout(60000) });
        
        if (!optimizedResponse.ok) return;
        
        const objectKey = folder ? `${folder}/${filename}` : filename;
        const optimizedBuffer = await optimizedResponse.arrayBuffer();
        
        // Dùng storage endpoint để upload, không phải public URL
        const uploadUrl = `https://${account.endpoint}/${account.bucket_name}/${objectKey}`;
        
        const headers = await createSignature(
            'PUT',
            `${account.bucket_name}/${objectKey}`,
            {
                'content-type': contentType,
                'content-length': optimizedBuffer.byteLength.toString()
            },
            optimizedBuffer,
            account
        );
        
        await fetch(uploadUrl, {
            method: 'PUT',
            headers: headers,
            body: optimizedBuffer,
            signal: AbortSignal.timeout(60000)
        });
        
    } catch (error) {}
}

export async function onRequest(context) {
    const { request } = context;
    const origin = request.headers.get('Origin');
    
    if (request.method === 'OPTIONS') {
        const corsHeaders = getCorsHeaders(origin);
        return Object.keys(corsHeaders).length === 0 ? 
            new Response('Forbidden', { status: 403 }) :
            new Response(null, { status: 200, headers: corsHeaders });
    }

    
    // Extract path from URL
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Handle multipart upload endpoints
    if (path === '/multipart-init') {
        return handleMultipartInit(context);
    } else if (path === '/multipart-upload') {
        return handleMultipartUpload(context);
    } else if (path === '/multipart-complete') {
        return handleMultipartComplete(context);
    }
    
    if (request.method === 'POST') {
        return onRequestPost(context);
    } else if (request.method === 'GET') {
        return onRequestGet(context);
    } else {
        const corsHeaders = getCorsHeaders(origin);
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { 
            status: 405,
            headers: { 'Content-Type': 'application/json', 'Allow': 'GET, POST', ...corsHeaders }
        });
    }
}

// Multipart Upload Handlers

// Initialize multipart upload
async function handleMultipartInit(context) {
    const { request, env } = context;
    const origin = request.headers.get('Origin');
    const corsHeaders = getCorsHeaders(origin);
    
    try {
        // Parse request body
        const data = await request.json();
        const { filename, contentType, fileSize } = data;
        
        if (!filename) {
            return new Response(JSON.stringify({ error: 'Filename is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
        
        console.log('Initializing multipart upload for:', { filename, contentType, fileSize });
        
        // Check rate limit
        const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
        const rateLimitResult = await checkRateLimit(env, ip);
        if (!rateLimitResult.allowed) {
            const rateRecord = await env.DB.prepare(`SELECT reset_time FROM rate_limits WHERE ip = ?`).bind(ip).first();
            const resetTimeMs = rateRecord ? rateRecord.reset_time - Date.now() : CONFIG.RATE_LIMIT.TIME_WINDOW_MS;
            const resetMinutes = Math.ceil(resetTimeMs / (60 * 1000));
            
            return new Response(JSON.stringify({
                error: `Rate limit exceeded (${CONFIG.RATE_LIMIT.MAX_REQUESTS}/${CONFIG.RATE_LIMIT.MAX_REQUESTS}). You can try again after ${resetMinutes} minutes.`
            }), {
                status: 429,
                headers: { 
                    'Content-Type': 'application/json',
                    'Retry-After': String(Math.ceil(resetTimeMs / 1000)),
                    ...corsHeaders 
                }
            });
        }
        
        // Get available storage accounts
        const availableAccounts = await getAvailableAccounts(env);
        if (availableAccounts.length === 0) {
            return new Response(JSON.stringify({
                error: 'Storage quota exceeded. Please try again later.'
            }), {
                status: 507,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
        
        console.log('Available storage accounts:', availableAccounts.length);
        
        // Get storage account
        const account = getStorageAccount(env, null, availableAccounts);
        
        // Generate folder and filename
        const folder = generateRandomString(CONFIG.PATH.FOLDER_LENGTH);
        const generatedFilename = `${generateRandomString(CONFIG.PATH.FILENAME_LENGTH)}.${getFileExtension(filename)}`;
        
        console.log('Generated folder and filename:', { folder, generatedFilename });
        
        // Create object key
        const objectKey = folder ? `${folder}/${generatedFilename}` : generatedFilename;
        
        // Initiate multipart upload
        const uploadId = await initiateMultipartUpload(account, objectKey, contentType || 'application/octet-stream');
        
        console.log('Multipart upload initiated with ID:', uploadId);
        
        // Create upload session in database
        const currentTime = Date.now();
        try {
            await env.DB.prepare(
                `INSERT INTO multipart_uploads (upload_id, filename, folder, generated_filename, content_type, file_size, account_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(uploadId, filename, folder, generatedFilename, contentType || 'application/octet-stream', fileSize || 0, account.account_id, currentTime).run();
            
            console.log('Multipart upload session saved to database');
        } catch (dbError) {
            console.error('Failed to save multipart upload session to database:', dbError);
            throw new Error(`Database error: ${dbError.message}`);
        }
        
        return new Response(JSON.stringify({
            success: true,
            uploadId,
            folder,
            filename: generatedFilename,
            partSize: CONFIG.MULTIPART.PART_SIZE_BYTES
        }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    } catch (error) {
        console.error('Initiate multipart upload error:', error);
        return new Response(JSON.stringify({ error: 'Server error: ' + error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

// Handle upload part
async function handleMultipartUpload(context) {
    const { request, env } = context;
    const origin = request.headers.get('Origin');
    const corsHeaders = getCorsHeaders(origin);
    
    try {
        // Get query parameters
        const url = new URL(request.url);
        const uploadId = url.searchParams.get('uploadId');
        const partNumber = parseInt(url.searchParams.get('partNumber'), 10);
        
        if (!uploadId || isNaN(partNumber) || partNumber < 1) {
            return new Response(JSON.stringify({ error: 'Invalid uploadId or partNumber' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
        
        // Get upload session from database
        const session = await env.DB.prepare(
            `SELECT * FROM multipart_uploads WHERE upload_id = ?`
        ).bind(uploadId).first();
        
        if (!session) {
            return new Response(JSON.stringify({ error: 'Upload session not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
        
        console.log('Found upload session:', session);
        
        // Get storage account using the account_id from the session
        const account = getStorageAccount(env, null, null, session.account_id);
        
        // Create object key
        const objectKey = session.folder ? `${session.folder}/${session.generated_filename}` : session.generated_filename;
        
        // Get part data from request
        const partData = await request.arrayBuffer();
        console.log(`Received part ${partNumber}, size: ${partData.byteLength} bytes`);
        
        // Upload part to storage
        const etag = await uploadPart(account, objectKey, uploadId, partNumber, partData);
        
        // Store part information in database
        await env.DB.prepare(
            `INSERT INTO multipart_parts (upload_id, part_number, etag, size)
            VALUES (?, ?, ?, ?)`
        ).bind(uploadId, partNumber, etag, partData.byteLength).run();
        
        return new Response(JSON.stringify({
            success: true,
            partNumber,
            etag
        }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    } catch (error) {
        console.error('Upload part error:', error);
        return new Response(JSON.stringify({ error: 'Server error: ' + error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

// Complete multipart upload
async function handleMultipartComplete(context) {
    const { request, env } = context;
    const origin = request.headers.get('Origin');
    const corsHeaders = getCorsHeaders(origin);
    
    try {
        // Parse request body
        const data = await request.json();
        const { uploadId } = data;
        
        if (!uploadId) {
            return new Response(JSON.stringify({ error: 'uploadId is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
        
        // Get upload session from database
        const session = await env.DB.prepare(
            `SELECT * FROM multipart_uploads WHERE upload_id = ?`
        ).bind(uploadId).first();
        
        if (!session) {
            return new Response(JSON.stringify({ error: 'Upload session not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
        
        console.log('Found upload session for completion:', session);
        
        // Get all parts for this upload
        const partsResult = await env.DB.prepare(
            `SELECT part_number, etag FROM multipart_parts WHERE upload_id = ? ORDER BY part_number`
        ).bind(uploadId).all();
        
        const parts = partsResult.results.map(part => ({
            partNumber: part.part_number,
            etag: part.etag
        }));
        
        if (parts.length === 0) {
            return new Response(JSON.stringify({ error: 'No parts found for this upload' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
        
        console.log(`Found ${parts.length} parts for upload ${uploadId}`);
        
        // Get storage account using the account_id from the session
        const account = getStorageAccount(env, null, null, session.account_id);
        
        // Create object key
        const objectKey = session.folder ? `${session.folder}/${session.generated_filename}` : session.generated_filename;
        
        // Complete multipart upload
        await completeMultipartUpload(account, objectKey, uploadId, parts);
        
        // Generate public URL
        let publicUrl;
        if (account.storage_type === 'r2') {
            // R2 uses pub subdomain with public_account_id
            publicUrl = `https://pub-${account.public_account_id}.r2.dev/${objectKey}`;
        } else {
            // S3 and other storage use direct endpoint
            publicUrl = `https://${account.endpoint}/${account.bucket_name}/${objectKey}`;
        }
        
        console.log('Generated public URL:', publicUrl);
        
        // Validate that the file was uploaded correctly by checking its existence and size
        console.log('Validating uploaded file...');
        try {
            const headResponse = await fetch(publicUrl, { 
                method: 'HEAD',
                signal: AbortSignal.timeout(30000) // 30 second timeout
            });
            
            if (!headResponse.ok) {
                throw new Error(`File validation failed: ${headResponse.status}`);
            }
            
            const actualSize = parseInt(headResponse.headers.get('Content-Length') || '0');
            if (actualSize === 0) {
                throw new Error('File size is 0, upload may have failed');
            }
            
            // If file_size is provided in the session, validate it
            if (session.file_size && session.file_size > 0) {
                // Allow a small tolerance (1%) for size differences due to encoding/storage variations
                const tolerance = Math.max(1024, session.file_size * 0.01);
                if (Math.abs(actualSize - session.file_size) > tolerance) {
                    throw new Error(`File size mismatch: expected ${session.file_size}, got ${actualSize}`);
                }
            }
            
            console.log('File validation successful:', { expectedSize: session.file_size, actualSize });
            
            // Thêm upload_time khi lưu vào database
            const currentTime = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
            
            // Insert into images table
            await env.DB.prepare(
                `INSERT INTO images (folder, filename, storage_url, file_size, account_id, upload_time, content_type)
                VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).bind(session.folder || '', session.generated_filename, publicUrl, actualSize, account.account_id, currentTime, session.content_type).run();
            
            // Clean up multipart tables (optional, can be done by a background job)
            context.waitUntil((async () => {
                try {
                    await env.DB.prepare(`DELETE FROM multipart_parts WHERE upload_id = ?`).bind(uploadId).run();
                    await env.DB.prepare(`DELETE FROM multipart_uploads WHERE upload_id = ?`).bind(uploadId).run();
                } catch (e) {
                    console.error('Failed to clean up multipart tables:', e);
                }
            })());
            
            return new Response(JSON.stringify({
                success: true,
                folder: session.folder || '',
                filename: session.generated_filename
            }), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
            
        } catch (error) {
            console.error('File validation error:', error);
            
            // Don't clean up multipart tables so client can retry
            return new Response(JSON.stringify({ 
                error: 'File validation failed: ' + error.message,
                retryable: true
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
    } catch (error) {
        console.error('Complete multipart upload error:', error);
        return new Response(JSON.stringify({ error: 'Server error: ' + error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

export async function onRequestPost(context) {
    const { request, env } = context;
    const origin = request.headers.get('Origin');
    const corsHeaders = getCorsHeaders(origin);
    
    try {
        const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
        
        if (await checkIfBlocked(env, ip)) {
            const blockRecord = await env.DB.prepare(`SELECT block_until FROM abuse_blocks WHERE ip = ?`).bind(ip).first();
            const remainingTimeMs = blockRecord ? blockRecord.block_until - Date.now() : CONFIG.ABUSE_PROTECTION.BLOCK_DURATION_MS;
            const remainingHours = Math.ceil(remainingTimeMs / (60 * 60 * 1000));
            
            return new Response(JSON.stringify({
                error: `IP blocked due to abuse. You can try again after ${remainingHours} hours.`
            }), {
                status: 429,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        const rateLimitResult = await checkRateLimit(env, ip);
        if (!rateLimitResult.allowed) {
            const rateRecord = await env.DB.prepare(`SELECT reset_time FROM rate_limits WHERE ip = ?`).bind(ip).first();
            const resetTimeMs = rateRecord ? rateRecord.reset_time - Date.now() : CONFIG.RATE_LIMIT.TIME_WINDOW_MS;
            const resetMinutes = Math.ceil(resetTimeMs / (60 * 1000));
            
            return new Response(JSON.stringify({
                error: `Rate limit exceeded (${CONFIG.RATE_LIMIT.MAX_REQUESTS}/${CONFIG.RATE_LIMIT.MAX_REQUESTS}). You can try again after ${resetMinutes} minutes.`
            }), {
                status: 429,
                headers: { 
                    'Content-Type': 'application/json',
                    'Retry-After': String(Math.ceil(resetTimeMs / 1000)),
                    ...corsHeaders 
                }
            });
        }

        const contentLength = parseInt(request.headers.get('Content-Length') || '0');
        if (contentLength > CONFIG.FILE.MAX_SIZE_BYTES) {
            return new Response(JSON.stringify({
                error: `File too large (maximum size: ${CONFIG.FILE.MAX_SIZE_MB}MB)`
            }), {
                status: 413,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        const formData = await request.formData();
        const file = formData.get('file');

        if (!file || !(file instanceof File)) {
            return new Response(JSON.stringify({ error: 'No file provided' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // All file types are allowed, so we don't need to check file type

        const availableAccounts = await getAvailableAccounts(env);
        if (availableAccounts.length === 0) {
            return new Response(JSON.stringify({
                error: 'Storage quota exceeded. Please try again later.'
            }), {
                status: 507,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
        
        const account = getStorageAccount(env, null, availableAccounts);
        
        const folder = generateRandomString(CONFIG.PATH.FOLDER_LENGTH);
        const filename = `${generateRandomString(CONFIG.PATH.FILENAME_LENGTH)}.${getFileExtension(file.name)}`;

        const result = await uploadToStorage(account, file, folder, filename);
        
        // Thêm upload_time và content_type khi lưu vào database
        const currentTime = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
        await env.DB.prepare(
            `INSERT INTO images (folder, filename, storage_url, file_size, account_id, upload_time, content_type)
            VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(folder || '', filename, result.secure_url, file.size, account.account_id, currentTime, file.type).run();

        // Only optimize images, not other file types
        if (file.type && file.type.startsWith('image/')) {
            context.waitUntil(optimizeImage(account, folder, filename, result.secure_url, file.type));
        }

        return new Response(JSON.stringify({
            success: true,
            folder: folder || '',
            filename: filename,
        }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    } catch (err) {
        console.error('Upload error:', err);
        
        if (err.name === 'TypeError' && err.message.includes('Failed to parse body')) {
            return new Response(JSON.stringify({ error: 'Request body too large or malformed' }), {
                status: 413,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
        
        return new Response(JSON.stringify({ error: 'Server error: ' + err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}
