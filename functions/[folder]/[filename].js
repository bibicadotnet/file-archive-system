// functions/[folder]/[filename].js - Folder-based file proxy

const CONFIG = {
    ABUSE_PROTECTION: {
        MAX_FAILED_READS: 50,
        TIME_WINDOW_MINUTES: 1440,
        BLOCK_DURATION_HOURS: 24,
        get TIME_WINDOW_MS() { return this.TIME_WINDOW_MINUTES * 60 * 1000; },
        get BLOCK_DURATION_MS() { return this.BLOCK_DURATION_HOURS * 60 * 60 * 1000; }
    }
};

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

async function recordBlockedAccess(env, ip) {
    const currentTime = Date.now();
    await env.DB.prepare(`UPDATE abuse_blocks SET last_attempt = ? WHERE ip = ?`).bind(currentTime, ip).run();
}

export async function onRequestGet(context) {
    const { params, env, request } = context;
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';  
    
    if (await checkIfBlocked(env, ip)) {
        await recordBlockedAccess(env, ip);
        
        const blockRecord = await env.DB.prepare(`SELECT block_until FROM abuse_blocks WHERE ip = ?`).bind(ip).first();
        const remainingTimeMs = blockRecord ? blockRecord.block_until - Date.now() : CONFIG.ABUSE_PROTECTION.BLOCK_DURATION_MS;
        const remainingHours = Math.ceil(remainingTimeMs / (60 * 60 * 1000));
        
        return new Response(JSON.stringify({
            error: `IP blocked due to abuse. You can try again after ${remainingHours} hours.`
        }), {
            status: 429,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const folder = params.folder;
    
    // Block access to protected folders
    if (folder === 'upload' || folder === 'api') {
        await recordFailedRead(env, ip);
        return new Response(JSON.stringify({ error: 'Not Found' }), { 
            status: 404,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    const filename = params.filename.split('?')[0];
    
    if (!filename.includes('.')) {
        await recordFailedRead(env, ip);
        return new Response(JSON.stringify({ error: 'Not Found' }), { 
            status: 404,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const image = await env.DB.prepare(`
            SELECT storage_url FROM images WHERE folder = ? AND filename = ?
        `).bind(folder, filename).first();

        if (!image) {
            await recordFailedRead(env, ip);
            return new Response(JSON.stringify({ error: 'File not found' }), { 
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Check if it's an image file by extension
        const isImage = /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(image.storage_url);
        
        try {
            // Only use Jetpack optimization for image files
            if (isImage) {
                const optimizedUrl = `https://i0.wp.com/${image.storage_url.replace('https://', '')}`;
                const imageResponse = await fetch(optimizedUrl, {
                    headers: {
                        'User-Agent': 'File-Archive-System/v2'
                    },
                    signal: AbortSignal.timeout(30000) // 30 second timeout
                });
                
                if (imageResponse.ok) {
                    return new Response(imageResponse.body, {
                        headers: {
                            'Content-Type': imageResponse.headers.get('Content-Type') || 'image/jpeg',
                            'Cache-Control': 'public, max-age=31536000',
                            'Access-Control-Allow-Origin': '*'
                        }
                    });
                }
            }
            
            // For non-image files or if optimization fails, use original URL
            const originalResponse = await fetch(image.storage_url, {
                headers: {
                    'User-Agent': 'File-Archive-System/v2'
                },
                signal: AbortSignal.timeout(30000)
            });

            if (!originalResponse.ok) {
                await recordFailedRead(env, ip);
                return new Response(JSON.stringify({ error: 'File not accessible' }), { 
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // For non-image files, force download
            if (!isImage) {
                return new Response(originalResponse.body, {
                    headers: {
                        'Content-Type': originalResponse.headers.get('Content-Type') || 'application/octet-stream',
                        'Content-Disposition': `attachment; filename="${filename}"`,
                        'Cache-Control': 'public, max-age=31536000',
                        'Access-Control-Allow-Origin': '*'
                    }
                });
            } else {
                // For image files (fallback when optimization fails)
                return new Response(originalResponse.body, {
                    headers: {
                        'Content-Type': originalResponse.headers.get('Content-Type') || 'image/jpeg',
                        'Cache-Control': 'public, max-age=31536000',
                        'Access-Control-Allow-Origin': '*'
                    }
                });
            }

        } catch (fetchError) {
            console.error('File fetch error:', fetchError);
            await recordFailedRead(env, ip);
            return new Response(JSON.stringify({ error: 'Failed to fetch file' }), { 
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

    } catch (error) {
        console.error('Folder file proxy error:', error);
        await recordFailedRead(env, ip);
        return new Response(JSON.stringify({ error: 'Server error: ' + error.message }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
