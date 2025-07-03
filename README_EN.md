## File Archive System

English | [Tiếng Việt](README.md)

The File Archive System is a high-performance file and image management and storage system designed to optimize cost and performance. The system uses Cloudflare R2 for image storage, Cloudflare Pages for deployment, and integrates Jetpack for image optimization. By distributing uploads across multiple Cloudflare R2 accounts, the system overcomes the storage limits of the free plan and maximizes access performance through Cloudflare's CDN.

### System Architecture

- **Frontend**: Hosted on Cloudflare Pages, providing user interface and client-side functionality.
- **Backend**: Deployed using Cloudflare Pages Functions, handling server-side logic and API endpoints.
- **Database**: Uses Cloudflare D1 (SQLite) for data storage and management.
- **Storage**: Utilizes Cloudflare R2 for reliable and scalable object storage.
- **Image Optimization**: Jetpack is used to optimize images to improve performance and reduce load times.

This architecture leverages Cloudflare's services to provide a secure, efficient, and scalable platform for your application.

## Key Features

- **Multi-account Support**: Distributes uploads across multiple Cloudflare R2 accounts to increase storage capacity.
- **Image Optimization**: Automatically optimizes images after upload through Jetpack.
- **Access Control**: Limits the number of requests from each IP and detects abnormal behavior.
- **High Performance**: Integrates with Cloudflare's CDN to accelerate access speed.
- **Batch Upload**: Supports uploading multiple files at once with a custom batch splitting mechanism.
- **File Management**: Simple File Manager page to delete or rename files.
- **Authentication**: Enables basic authentication for admin or homepage.

## User Interface Features

- **Intuitive Drag-and-Drop Interface**: Allows previewing images before uploading.
- **Automatic URL Generation**: Each file automatically generates 4 URL formats: Direct, Markdown, BBCode, and HTML.
- **Copy URL**: Click on a URL to automatically copy it to the clipboard.
- **"Copy All" Button**: Allows copying all URLs in the selected format.
- **Automatic File Check**: Automatically checks file size and type.
- **Error Notification**: Automatically detects and notifies errors.

## Installing the File Archive System

Download the entire File Archive System source code [here](https://load.bibica.net/file-archive-system.zip)

- Create a new project on Github, select private mode
- Extract, upload all files to the project

## Server Setup

### Database Configuration

1. **Create a D1 Database**:
   - Log in to your Cloudflare account.
   - Navigate to the D1 section in the Cloudflare dashboard.
   - Create a new D1 database instance.
   - Record the database name and ID for later use.

2. **Run the SQL Script**:
   - Go to the Console tab, paste the SQL snippet below, then Execute:
    
     ```sql
     CREATE TABLE IF NOT EXISTS images (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         folder TEXT,
         filename TEXT,
         storage_url TEXT NOT NULL,
         file_size INTEGER,
         account_id TEXT,
         upload_time INTEGER DEFAULT (strftime('%s', 'now')),
         content_type TEXT
     );

     CREATE TABLE IF NOT EXISTS rate_limits (
         ip TEXT PRIMARY KEY,
         count INTEGER,
         reset_time INTEGER
     );

     CREATE TABLE IF NOT EXISTS abuse_blocks (
         ip TEXT PRIMARY KEY,
         failed_count INTEGER,
         block_until INTEGER,
         last_attempt INTEGER
     );

     CREATE TABLE IF NOT EXISTS storage_usage (
         account_id TEXT PRIMARY KEY,
         used_bytes INTEGER DEFAULT 0,
         last_updated INTEGER DEFAULT 0
     );

     CREATE TABLE IF NOT EXISTS multipart_uploads (
         upload_id TEXT PRIMARY KEY,
         filename TEXT NOT NULL,
         folder TEXT NOT NULL,
         generated_filename TEXT NOT NULL,
         content_type TEXT,
         file_size INTEGER,
         account_id TEXT NOT NULL,
         created_at INTEGER NOT NULL,
         status TEXT DEFAULT 'pending'
     );

     CREATE TABLE IF NOT EXISTS multipart_parts (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         upload_id TEXT NOT NULL,
         part_number INTEGER NOT NULL,
         etag TEXT NOT NULL,
         size INTEGER NOT NULL,
         FOREIGN KEY (upload_id) REFERENCES multipart_uploads(upload_id) ON DELETE CASCADE
     );

     CREATE INDEX idx_images_folder_filename ON images(folder, filename);
     CREATE INDEX idx_multipart_parts_upload_id ON multipart_parts(upload_id);
     CREATE INDEX idx_images_account_id ON images(account_id);
     CREATE INDEX idx_images_upload_time ON images(upload_time);
     ```

3. **Update D1 Configuration**:
   - Open `scripts/generate-pages.js`.
   - Update the configuration as follows:
     ```toml
     [[env.production.d1_databases]]
     binding = "DB"
     database_name = "DATABASE_NAME"
     database_id = "DATABASE_ID"
     ```
   - `DATABASE_NAME`: Replace with your D1 database name.
   - `DATABASE_ID`: Replace with your D1 database ID.
   - `SERVER_PREFIX`: replace `loader` with a name you like, this is the name used to call the servers (by default, 19 servers will be created)

### Cloudflare API Token Configuration

1. Create an API Key on Cloudflare at https://dash.cloudflare.com/profile/api-tokens.
2. Select API token templates `Cloudflare Workers`
3. Configure access permissions:
    - Account Resources and Zone Resources: must manually select the account being used (Cloudflare does not allow use on all accounts)
4. Save the created API token: `YOUR_CLOUDFLARE_API_TOKEN`
5. Get the account ID from the Cloudflare dashboard URL:
   - Visit https://dash.cloudflare.com/
   - The URL will be in the format: https://dash.cloudflare.com/YOUR_CLOUDFLARE_ACCOUNT_ID/home
   - `YOUR_CLOUDFLARE_ACCOUNT_ID` is the required ID.

### GitHub Actions Configuration

1. Click on Actions in the project, select `Skip this and set up a workflow yourself`:
   - Fill in the content below:
     
     ```yaml
     name: Deploy Cloudflare Pages

     on:
       workflow_dispatch:

     jobs:
       deploy:
         runs-on: ubuntu-latest

         env:
           CLOUDFLARE_API_TOKEN: YOUR_CLOUDFLARE_API_TOKEN
           CLOUDFLARE_ACCOUNT_ID: YOUR_CLOUDFLARE_ACCOUNT_ID
           CUSTOM_DOMAIN_SUFFIX: your-domain.com
           SERVER_PREFIX: loader
           SERVER_COUNT: 19

         steps:
           - uses: actions/checkout@v3

           - name: Setup Node.js
             uses: actions/setup-node@v3
             with:
               node-version: '20'

           - name: Install Wrangler
             run: npm install -g wrangler

           - name: Generate page configurations
             run: node scripts/generate-pages.js

           - name: Deploy Cloudflare Pages
             run: |
               for i in $(seq 1 $SERVER_COUNT); do
                 PROJECT_NAME="${SERVER_PREFIX}${i}"
                 CUSTOM_DOMAIN="${PROJECT_NAME}.${CUSTOM_DOMAIN_SUFFIX}"
                 PAGES_DOMAIN="${PROJECT_NAME}.pages.dev"

                 cd "${SERVER_PREFIX}/${PROJECT_NAME}"

                 if ! wrangler pages project list | grep -q "$PROJECT_NAME"; then
                   wrangler pages project create "$PROJECT_NAME" --production-branch=main > /dev/null
                   echo "Successfully created the '${PROJECT_NAME}' project. It will be available at https://${PAGES_DOMAIN} once you create your first deployment."
                 fi

                 wrangler pages deploy . --project-name="$PROJECT_NAME" --commit-dirty=true > /dev/null

                 DOMAIN_EXISTS=$(curl -s -X GET "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/domains" \
                   -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" | grep -o "$CUSTOM_DOMAIN" | head -1)

                 if [ -z "$DOMAIN_EXISTS" ]; then
                   curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${PROJECT_NAME}/domains" \
                     -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
                     -H "Content-Type: application/json" \
                     --data '{"name":"'"$CUSTOM_DOMAIN"'"}' > /dev/null
                 fi

                 echo "CNAME ${CUSTOM_DOMAIN} -> ${PAGES_DOMAIN}"

                 cd ../..
               done
     ```
   - Replace `YOUR_CLOUDFLARE_API_TOKEN` with the token created in the previous steps.
   - Replace `YOUR_CLOUDFLARE_ACCOUNT_ID` with your account ID.
   - Replace `your-domain.com` with your domain name.
   - Use the name generated in `scripts/generate-pages.js` for `SERVER_PREFIX`.

3. **Run GitHub Action**:
   - After creating the GitHub Action, run the workflow
   - From the Actions menu -> Deploy Cloudflare Pages
   - The first run usually takes 4-8 minutes as it creates and configures 19 servers.
   - The server URLs generated by Cloudflare Pages will be in the format `loader1.pages.dev` to `loader19.pages.dev`.
   - If you want to use a subdomain, create a CNAME according to the displayed name
     
     ```
     Run for i in $(seq 1 $SERVER_COUNT); do
     CNAME loader1.your-domain.com -> loader1.pages.dev
     CNAME loader2.your-domain.com -> loader2.pages.dev
     CNAME loader3.your-domain.com -> loader3.pages.dev
     ...
     CNAME loader19.your-domain.com -> loader19.pages.dev
     ```
     
## Client Setup

### Configure index.html Page

Open the `index.html` file, modify the configuration including settings for uploads and the server list (created above):

```javascript
this.maxFiles = 10; // Maximum number of files that can be uploaded
this.maxFileSize = 100 * 1024 * 1024; // Maximum file size (bytes)
this.allowedTypes = []; // Leave empty to allow all file types
this.maxBatchSize = 40 * 1024 * 1024; // Use default value
this.timeWindowMinutes = 5; // Rate limit time window
this.servers = [
    "https://loader1.pages.dev",
    "https://loader3.pages.dev",
    "https://loader4.pages.dev",
    // Add more servers if needed
];

// Multipart upload configuration
this.partSize = 10 * 1024 * 1024; // Use default value
this.useMultipart = true; // Enable multipart upload
this.multipartThreshold = 40 * 1024 * 1024; // Use default value
this.maxConcurrentParts = 5; // Use default value
```

The settings `this.maxBatchSize`, `this.partSize`, `this.multipartThreshold`, and `this.maxConcurrentParts`: should use default values to ensure the system can handle a large number of files with varying sizes.

### Deploy to Cloudflare Pages

After configuring the index.html page, follow these steps to deploy to Cloudflare Pages:

1. Go to Cloudflare Dashboard > Pages > Create a project.
2. Connect to your GitHub repository.
3. Build configuration: (leave all default).

### Bind D1 Database Configuration

After deployment, configure Bind D1 Database as follows:

1. Go to Settings > Functions > D1 database bindings.
2. Add the D1 created above.
   - Variable name: `DB`
   - D1 database: select the database created above

## Server Account and ALLOWED_ORIGINS Configuration

Open the `server.js` file:

```javascript
const DEFAULT_CONFIG = {
    CORS: {
        ALLOWED_ORIGINS: [        // Replace with the domain running index.html
            'https://example.com', 
            'https://file-archive-system.pages.dev', 
        ]
    },
    RATE_LIMIT: {
        MAX_REQUESTS: 10, // Maximum number of requests in the specified time window (TIME_WINDOW_MINUTES)
        TIME_WINDOW_MINUTES: 5, // Time window (minutes) for rate limit calculation
    },
    STORAGE: {
        MAX_SIZE_GB: 7, // Maximum storage size (GB)
    },
    FILE: {
        MAX_SIZE_MB: 100, // Maximum file size (MB)
        ALLOWED_TYPES: [] // Allow all file types
    },
    PATH: {
        FOLDER_LENGTH: 0, // Folder length
        FILENAME_LENGTH: 8, // Filename length
    },
    ABUSE_PROTECTION: {
        MAX_FAILED_READS: 50, // Maximum failed reads before blocking
        TIME_WINDOW_MINUTES: 1440, // Time window (minutes) for abuse protection calculation
        BLOCK_DURATION_HOURS: 24, // Block duration (hours) after exceeding failed reads
    },
    MULTIPART: {
        MAX_BATCH_SIZE_MB: 40, // Maximum batch size (MB) for multipart upload
        PART_SIZE_MB: 10, // Part size (MB) in multipart upload
    },
};

const STORAGE_ACCOUNTS = [
    ["YOUR_ACCOUNT_ID_1", "load001", "auto", "YOUR_ACCESS_KEY_1", "YOUR_SECRET_KEY_1", "YOUR_ACCOUNT_ID_1.r2.cloudflarestorage.com", "r2", "YOUR_PUBLIC_ACCOUNT_ID_1"],
    ["YOUR_ACCOUNT_ID_2", "load002", "auto", "YOUR_ACCESS_KEY_2", "YOUR_SECRET_KEY_2", "YOUR_ACCOUNT_ID_2.r2.cloudflarestorage.com", "r2", "YOUR_PUBLIC_ACCOUNT_ID_2"],
    ["YOUR_ACCOUNT_ID_3", "load003", "auto", "YOUR_ACCESS_KEY_3", "YOUR_SECRET_KEY_3", "YOUR_ACCOUNT_ID_3.r2.cloudflarestorage.com", "r2", "YOUR_PUBLIC_ACCOUNT_ID_3"],
    ["YOUR_ACCOUNT_ID_4", "load004", "auto", "YOUR_ACCESS_KEY_4", "YOUR_SECRET_KEY_4", "YOUR_ACCOUNT_ID_4.r2.cloudflarestorage.com", "r2", "YOUR_PUBLIC_ACCOUNT_ID_4"],
    ["YOUR_ACCOUNT_ID_5", "load005", "auto", "YOUR_ACCESS_KEY_5", "YOUR_SECRET_KEY_5", "YOUR_ACCOUNT_ID_5.r2.cloudflarestorage.com", "r2", "YOUR_PUBLIC_ACCOUNT_ID_5"],
];
```

### Configuration Explanation

- **ALLOWED_ORIGINS**: Specifies the domains allowed to access your server. Replace with the domain running `index.html`.
- **RATE_LIMIT MAX_REQUESTS**: Limits the maximum number of requests an IP can make in the specified time window. For example, with `MAX_REQUESTS: 10` and `TIME_WINDOW_MINUTES: 5`, an IP can upload up to 10 files in 5 minutes.
- **STORAGE MAX_SIZE_GB**: Maximum storage capacity of an account. For example, 7 is 7GB. When an account uses up 7GB, the system will automatically switch to another account. If all accounts exceed this limit, the system will notify that the account is out of space.
- **FILE MAX_SIZE_MB**: Maximum file size allowed for upload.
- **FILE ALLOWED_TYPES**: List of allowed file types for upload. Leave empty to allow all file types.
- **PATH FOLDER_LENGTH**: Length of the folder name. For example, 0 means no folder is used, if changed to 4, the system will create a random folder with 4 characters.
- **PATH FILENAME_LENGTH**: Length of the file name after upload. For example, 8 will create a random file name with 8 characters.
- **ABUSE_PROTECTION**: Leave default to protect against abuse.
- **MULTIPART**: Similar to the configuration in `index.html`, should be used according to the default configuration.

### STORAGE_ACCOUNTS

The `STORAGE_ACCOUNTS` configuration allows you to specify storage accounts using Cloudflare R2. The structure of each storage account is an array with the following elements:

- **account_id**: Cloudflare account ID.
- **bucket_name**: Name of the bucket in Cloudflare R2.
- **region**: Storage region, usually "auto" to automatically select the region.
- **access_key_id**: Access key ID for the account.
- **secret_access_key**: Secret key corresponding to `access_key_id`.
- **endpoint**: Endpoint to access the bucket, usually in the format `[account_id].r2.cloudflarestorage.com`.
- **storage_type**: Storage type, e.g., "r2" for Cloudflare R2.
- **public_account_id**: Public Development URL of the bucket pub-[public_account_id].r2.dev.

Specific example:

```
["a9c8b0be9cf31827553430aaf67d61e4", "load001", "auto", "a23ac123ca059992d1721951ec5d1af4", "86d8a587921e3765f13dec4d524de1e4d27417ff52598f3a053e10498190a48b", "a9c8b0be9cf31827553430aaf67d61e4.r2.cloudflarestorage.com", "r2", "69c084182ffd4f99ac64d8951a78d074"],
```

### Cloudflare R2 Account Creation Guide

1. **Register a Cloudflare Account**: Visit Cloudflare's website and sign up for an account if you don't have one.

2. **Create an R2 Bucket**:
   - Log in to the Cloudflare dashboard.
   - Select "R2" from the service menu. (you need to provide card or PayPal information to verify the account)
   - Click "Create Bucket" and enter a name for your bucket.
   - Choose Location: Automatic or click Provide a location hint to select the region closest to you
   - Default Storage Class: Standard

3. **Enable Public Development URL**:
   - After creating the bucket, go to Settings, you will see the Public Development URL, enable it to create a URL in the format `pub-[public_account_id].r2.dev`.

4. **Set CORS Policy**:
    - After creating the bucket, go to Settings, you will see CORS Policy
   - Add a CORS policy as follows:
     ```json
     [
       {
         "AllowedOrigins": [
           "*"
         ],
         "AllowedMethods": [
           "PUT",
           "POST",
           "GET",
           "HEAD"
         ],
         "AllowedHeaders": [
           "*"
         ]
       }
     ]
     ```

5. **Create Account API Tokens**:
   - In the main menu of R2 Object Storage, click API -> Manager API Tokens  
   - Click "Create Account API Tokens".
   - Select Permissions "Admin Read & Write" to ensure the token has the necessary access rights.

Replace Cloudflare R2 information in the `STORAGE_ACCOUNTS` configuration inside `server.js`, you can create multiple accounts to take advantage of 10GB of free R2 on each account

### Update Server, Re-run GitHub Action
   - After updating multiple Cloudflare R2 accounts into the server, editing the configuration ... you need to re-run GitHub Action to update the values for 19 servers
   - Go to Github, navigate to the "Actions" tab in your GitHub repository.
   - Select "Deploy Cloudflare Pages" to re-run the action to deploy your server.
   
## Configure cron to check STORAGE capacity

1. **Create Cloudflare Worker**:
   - Log in to the Cloudflare dashboard.
   - Select "Workers" from the service menu.
   - Click "Create a Service" to create a new service.
   - Name your service and click "Create Service".
   - In the editor, replace with the code below

```javascript
const TELEGRAM_BOT_TOKEN = 'YOUR_TELEGRAM_BOT_TOKEN';
const TELEGRAM_CHAT_ID = 'YOUR_TELEGRAM_CHAT_ID';

// Copy from server.js - only check these accounts
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
```

2. **Specific Configuration**:
   - **STORAGE_ACCOUNTS**: Replace the values in the `STORAGE_ACCOUNTS` array with your actual Cloudflare R2 account information. This should match the configuration in `server.js`.
   - **TELEGRAM_BOT_TOKEN** and **TELEGRAM_CHAT_ID**: Replace these values with your actual Telegram bot token and chat ID to enable notifications.

3. **Bind D1 Database**:
   - Bindings -> Add binding, add the D1 created above.

4. **Set Trigger Events**:
   - Go to the Cloudflare Workers dashboard.
   - Navigate to the "Settings" tab and then to "Trigger Events".
   - Set up a cron trigger to run every 5 minutes using the cron expression `*/5 * * * *`.

## Configure `functions/admin.js`

1. **Replace STORAGE_ACCOUNTS**:
   - In `admin.js`, replace the values in the `STORAGE_ACCOUNTS` array with your actual Cloudflare R2 account information. This should match the configuration in `server.js`.

2. **Main Functionality**:
   - `admin.js` manages actions such as deleting, renaming files in the storage system. It uses information from `STORAGE_ACCOUNTS` to perform operations on Cloudflare R2.

### Configure `functions/auth.js`

1. **AUTH_CONFIG Configuration**:
   - In `auth.js`, you can enable or disable authentication by changing the `enabled` value in `AUTH_CONFIG`.
   - Change `username` and `password` to your desired authentication credentials.

2. **Set Authentication for Pages**:
   - By default, authentication is applied to the paths `/`, `/index.html`, and `/admin`. This means users will need to provide authentication credentials to access these pages.

3. **Path Configuration**:
    - If you want to allow public uploads, only authenticate admin, then change 

```
if (path === "/" || path === "/index.html" || path === "/admin") {
```

To

```
if (path === "/admin") {
```