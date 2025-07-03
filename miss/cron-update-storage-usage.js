const TELEGRAM_BOT_TOKEN = 'YOUR_TELEGRAM_BOT_TOKEN';
const TELEGRAM_CHAT_ID = 'YOUR_TELEGRAM_CHAT_ID';

// Copy từ server.js - chỉ check các account này
const STORAGE_ACCOUNTS = [
    
    ["YOUR_ACCOUNT_ID_1", "load001", "auto", "YOUR_ACCESS_KEY_1", "YOUR_SECRET_KEY_1", "YOUR_ACCOUNT_ID_1.r2.cloudflarestorage.com", "r2", "YOUR_PUBLIC_ACCOUNT_ID_1"],
    ["YOUR_ACCOUNT_ID_2", "load002", "auto", "YOUR_ACCESS_KEY_2", "YOUR_SECRET_KEY_2", "YOUR_ACCOUNT_ID_2.r2.cloudflarestorage.com", "r2", "YOUR_PUBLIC_ACCOUNT_ID_2"],
    ["YOUR_ACCOUNT_ID_3", "load003", "auto", "YOUR_ACCESS_KEY_3", "YOUR_SECRET_KEY_3", "YOUR_ACCOUNT_ID_3.r2.cloudflarestorage.com", "r2", "YOUR_PUBLIC_ACCOUNT_ID_3"],
    ["YOUR_ACCOUNT_ID_4", "load004", "auto", "YOUR_ACCESS_KEY_4", "YOUR_SECRET_KEY_4", "YOUR_ACCOUNT_ID_4.r2.cloudflarestorage.com", "r2", "YOUR_PUBLIC_ACCOUNT_ID_4"],
    ["YOUR_ACCOUNT_ID_5", "load005", "auto", "YOUR_ACCESS_KEY_5", "YOUR_SECRET_KEY_5", "YOUR_ACCOUNT_ID_5.r2.cloudflarestorage.com", "r2", "YOUR_PUBLIC_ACCOUNT_ID_5"],
    
    ];

async function updateStorageUsage(env) {
    try {
        const usage = await env.DB.prepare(`
            SELECT account_id, SUM(file_size) as used_bytes
            FROM images 
            WHERE account_id IN (${STORAGE_ACCOUNTS.map(() => '?').join(',')})
            GROUP BY account_id
        `).bind(...STORAGE_ACCOUNTS.map(acc => acc[0])).all();
        
        for (const account of STORAGE_ACCOUNTS) {
            const accountId = account[0];
            const accountUsage = usage.results.find(u => u.account_id === accountId);
            const usedBytes = accountUsage ? accountUsage.used_bytes : 0;
            
            await env.DB.prepare(`
                INSERT INTO storage_usage (account_id, used_bytes, last_updated)
                VALUES (?, ?, ?)
                ON CONFLICT(account_id) DO UPDATE SET
                    used_bytes = ?,
                    last_updated = ?
            `).bind(
                accountId,
                usedBytes,
                Date.now(),
                usedBytes,
                Date.now()
            ).run();
        }
        
        console.log(`Storage usage updated for ${STORAGE_ACCOUNTS.length} accounts`);
        return usage.results;
    } catch (error) {
        console.error('Update storage usage failed:', error);
        throw error;
    }
}

async function sendTelegramMessage(message) {
    try {
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'HTML'
            })
        });
        
        if (!response.ok) {
            throw new Error(`Telegram API error: ${response.status}`);
        }
        
        console.log('Telegram message sent successfully');
    } catch (error) {
        console.error('Send telegram message failed:', error);
    }
}

async function checkQuotaAndAlert(env) {
    try {
        const usage = await updateStorageUsage(env);
        
        // Check if it's midnight (0:00 VietNam) for daily report
        const now = new Date(); 
        const isMiddnight = now.getUTCHours() === 17 && now.getUTCMinutes() < 5;
        
        if (isMiddnight) {
            let message = '📊 <b>File Archive System - Storage Report</b>\n\n';
            
            for (const row of usage) {
                const usedGB = (row.used_bytes / (1024 * 1024 * 1024)).toFixed(2);
                const percentage = ((row.used_bytes / (7 * 1024 * 1024 * 1024)) * 100).toFixed(1);
                const status = percentage > 90 ? '🔴' : percentage > 70 ? '🟡' : '🟢';
                
                message += `${status} <code>${row.account_id.substring(0, 8)}...</code>\n`;
                message += `   Used: ${usedGB} GB / 7 GB (${percentage}%)\n\n`;
            }
            
            message += `<i>Report time: ${now.toISOString()}</i>`;
            await sendTelegramMessage(message);
        }
        
    } catch (error) {
        console.error('Quota check failed:', error);
        
        // Send error alert to Telegram
        await sendTelegramMessage(`🚨 <b>File Archive System - Quota Check Error</b>\n\n<code>${error.message}</code>`);
    }
}

export default {
    async scheduled(event, env, ctx) {
        console.log('Running quota check...');
        await checkQuotaAndAlert(env);
    },
    
    async fetch(request, env, ctx) {
        return new Response('Quota Monitor Cron Job', { 
            status: 200,
            headers: { 'Content-Type': 'text/plain' }
        });
    }
};
