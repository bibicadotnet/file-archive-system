## File Archive System

[English](README_EN.md) | Tiếng Việt

File Archive System là một hệ thống quản lý và lưu trữ tệp, hình ảnh hiệu năng cao, được thiết kế để tối ưu hóa chi phí và hiệu suất. Hệ thống sử dụng Cloudflare R2 để lưu trữ hình ảnh, Cloudflare Pages để triển khai, và tích hợp Jetpack để tối ưu hóa hình ảnh. Bằng cách phân phối tải lên nhiều tài khoản Cloudflare R2, hệ thống vượt qua giới hạn lưu trữ của gói miễn phí và tối đa hóa hiệu suất truy cập thông qua CDN của Cloudflare.

### Kiến trúc Hệ thống

- **Frontend**: Được lưu trữ trên Cloudflare Pages, cung cấp giao diện người dùng và chức năng phía khách hàng.
- **Backend**: Được triển khai bằng Cloudflare Pages Functions, xử lý logic phía máy chủ và các điểm cuối API.
- **Cơ sở dữ liệu**: Sử dụng Cloudflare D1 (SQLite) để lưu trữ và quản lý dữ liệu.
- **Lưu trữ**: Sử dụng Cloudflare R2 cho lưu trữ đối tượng đáng tin cậy và có khả năng mở rộng.
- **Tối ưu hóa hình ảnh**: Jetpack được sử dụng để tối ưu hóa hình ảnh nhằm cải thiện hiệu suất và giảm thời gian tải.

Kiến trúc này tận dụng các dịch vụ của Cloudflare để cung cấp một nền tảng an toàn, hiệu quả và có khả năng mở rộng cho ứng dụng của bạn.

## Tính năng chính

- **Hỗ trợ nhiều tài khoản**: Phân phối tải lên nhiều tài khoản Cloudflare R2 để tăng dung lượng lưu trữ.
- **Tối ưu hóa hình ảnh**: Tự động tối ưu hóa hình ảnh sau khi tải lên thông qua Jetpack.
- **Kiểm soát truy cập**: Hạn chế số lượng yêu cầu từ mỗi IP và phát hiện hành vi bất thường.
- **Hiệu suất cao**: Tích hợp với CDN của Cloudflare để tăng tốc độ truy cập.
- **Upload hàng loạt**: Hỗ trợ tải lên nhiều file cùng lúc với cơ chế phân chia batch tùy chỉnh.
- **Quản lý file**: Trang File Manager đơn giản để xóa hoặc đổi tên file.
- **Xác thực**: Bật xác thực cơ bản cho admin hoặc trang chủ.

## Tính năng giao diện người dùng

- **Giao diện kéo thả trực quan**: Cho phép xem trước ảnh trước khi tải lên.
- **Tạo URL tự động**: Mỗi file tự động tạo 4 định dạng URL: Direct, Markdown, BBCode và HTML.
- **Sao chép URL**: Click vào URL để tự động copy vào clipboard.
- **Nút "Copy All"**: Cho phép copy tất cả URL theo định dạng đã chọn.
- **Kiểm tra file tự động**: Kiểm tra kích thước và loại file tự động.
- **Thông báo lỗi**: Tự động phát hiện và thông báo lỗi.

## Cài đặt File Archive System 

Download toàn bộ source code File Archive System tại [đây](https://load.bibica.net/file-archive-system.zip)

- Tạo 1 dự án mới trên Github, chọn chế độ private
- Giải nén, upload tất cả file vào dự án

## Cài đặt máy chủ

### Cấu hình cơ sở dữ liệu

1. **Tạo cơ sở dữ liệu D1**:
   - Đăng nhập vào tài khoản Cloudflare của bạn.
   - Điều hướng đến phần D1 trong bảng điều khiển Cloudflare.
   - Tạo một phiên bản cơ sở dữ liệu D1 mới.
   - Ghi lại tên và ID cơ sở dữ liệu để sử dụng sau này.

2. **Chạy tập lệnh SQL**:
   - Sang tab Console, dán đoạn SQL bên dưới vào, sau đó Execute:
    
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

3. **Cập nhật cấu hình D1**:
   - Mở `scripts/generate-pages.js`.
   - Cập nhật cấu hình như sau:
     ```toml
     [[env.production.d1_databases]]
     binding = "DB"
     database_name = "DATABASE_NAME"
     database_id = "DATABASE_ID"
     ```
   - `DATABASE_NAME`: Thay bằng tên cơ sở dữ liệu D1 của bạn.
   - `DATABASE_ID`: Thay bằng ID của cơ sở dữ liệu D1 của bạn.
   - `SERVER_PREFIX`: thay thế `loader` sang 1 tên gọi mà bạn thích, đây là tên dùng để gọi các server (mặc định sẽ tạo ra 19 server)

### Cấu hình mã thông báo API của Cloudflare

1. Tạo một API Key trên Cloudflare tại https://dash.cloudflare.com/profile/api-tokens.
2. Chọn API token templates `Cloudflare Workers`
3. Cấu hình quyền truy cập:
    - Account Resources và Zone Resources: bắt buộc chọn thủ công vào tài khoản đang dùng (Cloudflare không cho dùng trên tất cả tài khoản)
4. Lưu mã thông báo API đã tạo: `YOUR_CLOUDFLARE_API_TOKEN`
5. Lấy ID tài khoản từ URL bảng điều khiển Cloudflare:
   - Truy cập https://dash.cloudflare.com/
   - URL sẽ có định dạng: https://dash.cloudflare.com/YOUR_CLOUDFLARE_ACCOUNT_ID/home
   - `YOUR_CLOUDFLARE_ACCOUNT_ID` là ID cần thiết.

### Cấu hình GitHub Actions

1. Nhấp vào Actions trên dự án, chọn `Skip this and set up a workflow yourself`:
   - Điền vào nội dung bên dưới:
     
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
   - Thay thế `YOUR_CLOUDFLARE_API_TOKEN` bằng mã thông báo được tạo trong các bước trước.
   - Thay thế `YOUR_CLOUDFLARE_ACCOUNT_ID` bằng ID tài khoản của bạn.
   - Thay thế `your-domain.com` bằng tên miền của bạn.
   - Sử dụng tên được tạo trong `scripts/generate-pages.js` cho `SERVER_PREFIX`.

3. **Chạy GitHub Action**:
   - Sau khi tạo GitHub Action, chạy runs workflow
   - Từ menu Actions -> Deploy Cloudflare Pages
   - Lần chạy đầu tiên thường mất 4-8 phút vì nó tạo và cấu hình 19 máy chủ.
   - Các URL máy chủ được tạo bởi Cloudflare Pages sẽ có định dạng `loader1.pages.dev` đến `loader19.pages.dev`.
   - Nếu muốn dùng subdomain thì tạo CNAME theo tên hiển thị ra
     
     ```
     Run for i in $(seq 1 $SERVER_COUNT); do
     CNAME loader1.your-domain.com -> loader1.pages.dev
     CNAME loader2.your-domain.com -> loader2.pages.dev
     CNAME loader3.your-domain.com -> loader3.pages.dev
     ...
     CNAME loader19.your-domain.com -> loader19.pages.dev
     ```
     
## Cài đặt máy khách

### Cấu hình trang index.html

Mở file `index.html`, sửa lại cấu hình bao gồm các thiết lập cho tải lên và danh sách máy chủ (tạo ra ở bên trên):

```javascript
this.maxFiles = 10; // Số lượng tệp tối đa có thể tải lên
this.maxFileSize = 100 * 1024 * 1024; // Kích thước tệp tối đa (bytes)
this.allowedTypes = []; // Để trống để cho phép tất cả các loại tệp
this.maxBatchSize = 40 * 1024 * 1024; // Sử dụng giá trị mặc định
this.timeWindowMinutes = 5; // Thời gian giới hạn tốc độ
this.servers = [
    "https://loader1.pages.dev",
    "https://loader3.pages.dev",
    "https://loader4.pages.dev",
    // Thêm các máy chủ khác nếu cần
];

// Cấu hình Multipart upload
this.partSize = 10 * 1024 * 1024; // Sử dụng giá trị mặc định
this.useMultipart = true; // Bật tải lên nhiều phần
this.multipartThreshold = 40 * 1024 * 1024; // Sử dụng giá trị mặc định
this.maxConcurrentParts = 5; // Sử dụng giá trị mặc định
```

Các thiết lập  `this.maxBatchSize`, `this.partSize`, `this.multipartThreshold`, và `this.maxConcurrentParts`: nên sử dụng giá trị mặc định để đảm bảo rằng hệ thống có thể xử lý một lượng lớn tệp với kích thước khác nhau.

### Triển khai lên Cloudflare Pages

Sau khi cấu hình trang index.html, thực hiện các bước sau để triển khai lên Cloudflare Pages:

1. Vào Cloudflare Dashboard > Pages > Create a project.
2. Kết nối với GitHub repository của bạn.
3. Cấu hình build: (tất cả để mặc định).

### Cấu hình Bind D1 Database

Sau khi triển khai, cấu hình Bind D1 Database như sau:

1. Vào Settings > Functions > D1 database bindings.
2. Thêm vào D1 đã tạo ở trên.
   - Variable name: `DB`
   - D1 database: chọn database tạo ra ở trên

## Cấu hình tài khoản máy chủ và ALLOWED_ORIGINS

Mở tệp `server.js`:

```javascript
const DEFAULT_CONFIG = {
    CORS: {
        ALLOWED_ORIGINS: [        // Thay thế bằng domain chạy index.html
            'https://example.com', 
            'https://file-archive-system.pages.dev', 
        ]
    },
    RATE_LIMIT: {
        MAX_REQUESTS: 10, // Số lượng yêu cầu tối đa trong khoảng thời gian quy định (TIME_WINDOW_MINUTES)
        TIME_WINDOW_MINUTES: 5, // Khoảng thời gian (phút) để tính toán giới hạn yêu cầu
    },
    STORAGE: {
        MAX_SIZE_GB: 7, // Dung lượng lưu trữ tối đa (GB)
    },
    FILE: {
        MAX_SIZE_MB: 100, // Kích thước tệp tối đa (MB)
        ALLOWED_TYPES: [] // Cho phép tất cả các loại tệp
    },
    PATH: {
        FOLDER_LENGTH: 0, // Độ dài thư mục
        FILENAME_LENGTH: 8, // Độ dài tên tệp
    },
    ABUSE_PROTECTION: {
        MAX_FAILED_READS: 50, // Số lần đọc thất bại tối đa trước khi chặn
        TIME_WINDOW_MINUTES: 1440, // Khoảng thời gian (phút) để tính toán bảo vệ lạm dụng
        BLOCK_DURATION_HOURS: 24, // Thời gian chặn (giờ) sau khi vượt quá số lần đọc thất bại
    },
    MULTIPART: {
        MAX_BATCH_SIZE_MB: 40, // Kích thước batch tối đa (MB) cho tải lên nhiều phần
        PART_SIZE_MB: 10, // Kích thước mỗi phần (MB) trong tải lên nhiều phần
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

### Giải thích cấu hình

- **ALLOWED_ORIGINS**: Chỉ định các domain được phép truy cập vào server của bạn. Thay thế bằng domain chạy `index.html`.
- **RATE_LIMIT MAX_REQUESTS**: Giới hạn số lượng yêu cầu tối đa mà một IP có thể thực hiện trong khoảng thời gian quy định. Ví dụ, với `MAX_REQUESTS: 10` và `TIME_WINDOW_MINUTES: 5`, một IP có thể tải lên tối đa 10 tệp trong 5 phút.
- **STORAGE MAX_SIZE_GB**: Dung lượng lưu trữ tối đa của 1 tài khoản. Ví dụ, 7 là 7GB. Khi tài khoản dùng hết 7GB, hệ thống sẽ tự động chuyển sang sử dụng tài khoản khác. Nếu tất cả tài khoản đều quá hạn mức này, hệ thống sẽ thông báo tài khoản hết dung lượng.
- **FILE MAX_SIZE_MB**: Kích thước tệp tối đa có thể cho phép tải lên.
- **FILE ALLOWED_TYPES**: Danh sách các loại tệp được phép tải lên. Để trống để cho phép tất cả các loại tệp.
- **PATH FOLDER_LENGTH**: Độ dài của tên thư mục. Ví dụ, 0 là không sử dụng thư mục, nếu sửa thành 4, hệ thống sẽ tạo ra thư mục ngẫu nhiên với 4 ký tự.
- **PATH FILENAME_LENGTH**: Độ dài của tên tệp sau khi tải lên. Ví dụ, 8 sẽ tạo ra tên tệp ngẫu nhiên với 8 ký tự.
- **ABUSE_PROTECTION**: Để mặc định để bảo vệ chống lạm dụng.
- **MULTIPART**: Tương tự như cấu hình trong `index.html`, nên sử dụng theo cấu hình mặc định.

### STORAGE_ACCOUNTS

Cấu hình `STORAGE_ACCOUNTS` cho phép bạn chỉ định các tài khoản lưu trữ sử dụng Cloudflare R2. Cấu trúc của mỗi tài khoản lưu trữ là một mảng với các phần tử sau:

- **account_id**: ID của tài khoản Cloudflare.
- **bucket_name**: Tên của bucket trong Cloudflare R2.
- **region**: Vùng lưu trữ, thường là "auto" để tự động chọn vùng.
- **access_key_id**: ID khóa truy cập cho tài khoản.
- **secret_access_key**: Khóa bí mật tương ứng với `access_key_id`.
- **endpoint**: Điểm cuối để truy cập vào bucket, thường có dạng `[account_id].r2.cloudflarestorage.com`.
- **storage_type**: Loại lưu trữ, ví dụ "r2" cho Cloudflare R2.
- **public_account_id**: Public Development URL của bucket pub-[public_account_id].r2.dev.

Ví dụ cụ thể:

```
["a9c8b0be9cf31827553430aaf67d61e4", "load001", "auto", "a23ac123ca059992d1721951ec5d1af4", "86d8a587921e3765f13dec4d524de1e4d27417ff52598f3a053e10498190a48b", "a9c8b0be9cf31827553430aaf67d61e4.r2.cloudflarestorage.com", "r2", "69c084182ffd4f99ac64d8951a78d074"],
```

### Hướng dẫn tạo tài khoản Cloudflare R2

1. **Đăng ký tài khoản Cloudflare**: Truy cập vào trang web của Cloudflare và đăng ký một tài khoản nếu bạn chưa có.

2. **Tạo một R2 Bucket**:
   - Đăng nhập vào bảng điều khiển Cloudflare.
   - Chọn "R2" từ menu dịch vụ. (cần điền thông tin thẻ hoặc paypal để xác nhận tài khoản)
   - Nhấp vào "Create Bucket" và nhập tên cho bucket của bạn.
   - Chọn Location: Automatic hoặc nhấp vào Provide a location hint chọn khu vực gần với bạn nhất
   - Default Storage Class: Standard

3. **Mở Public Development URL**:
   - Sau khi tạo bucket, sang Settings, sẽ thấy Public Development URL, bật lên sẽ tạo ra URL có dạng `pub-[public_account_id].r2.dev`.

4. **Thiết lập CORS Policy**:
    - Sau khi tạo bucket, sang Settings, sẽ thấy CORS Policy
   - Thêm chính sách CORS như sau:
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

5. **Tạo Account API Tokens**:
   - Ở menu chính của R2 Object Storage, nhấp vào API -> Manager API Tokens  
   - Nhấp vào "Create Account API Tokens".
   - Chọn Permissions "Admin Read & Write" để đảm bảo token có quyền truy cập cần thiết.

Thay các thông tin Cloudflare R2 vào cấu hình `STORAGE_ACCOUNTS` bên trong `server.js`, có thể tạo nhiều tài khoản, để tận dụng 10GB R2 miễn phí ở mỗi tài khoản

### Cập nhập máy chủ, chạy lại GitHub Action
   - Sau khi cập nhập nhiều tài khoản Cloudflare R2 vào server, chỉnh sửa cấu hình ... cần chạy lại GitHub Action để cập nhập lại các giá trị cho 19 server
   - Vào Github, điều hướng đến tab "Actions" trong kho lưu trữ GitHub của bạn.
   - Chọn "Deploy Cloudflare Pages" để chạy lại hành động triển khai máy chủ của bạn.
   
## Cấu hình cron chạy kiểm tra dung lượng STORAGE

1. **Tạo Cloudflare Worker**:
   - Đăng nhập vào bảng điều khiển Cloudflare.
   - Chọn "Workers" từ menu dịch vụ.
   - Nhấp vào "Create a Service" để tạo một dịch vụ mới.
   - Đặt tên cho dịch vụ của bạn và nhấp vào "Create Service".
   - Trong trình chỉnh sửa, thay bằng mã bên dưới

```javascript
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
```

2. **Cấu hình cụ thể**:
   - **STORAGE_ACCOUNTS**: Thay thế các giá trị trong mảng `STORAGE_ACCOUNTS` bằng thông tin tài khoản Cloudflare R2 thực tế của bạn. Điều này nên khớp với cấu hình trong `server.js`.
   - **TELEGRAM_BOT_TOKEN** và **TELEGRAM_CHAT_ID**: Thay thế các giá trị này bằng token bot Telegram và ID chat thực tế của bạn để kích hoạt thông báo.

3. **Bind D1 Database**:
   - Bindings -> Add bingding, thêm vào D1 đã tạo ở trên.

4. **Thiết lập Trigger Events**:
   - Truy cập vào bảng điều khiển Cloudflare Workers.
   - Điều hướng đến tab "Settings" và sau đó đến "Trigger Events".
   - Thiết lập một cron trigger để chạy mỗi 5 phút bằng cách sử dụng biểu thức cron `*/5 * * * *`.

## Cấu hình `functions/admin.js`

1. **Thay thế STORAGE_ACCOUNTS**:
   - Trong `admin.js`, thay thế các giá trị trong mảng `STORAGE_ACCOUNTS` bằng thông tin tài khoản Cloudflare R2 thực tế của bạn. Điều này nên khớp với cấu hình trong `server.js`.

2. **Chức năng chính**:
   - `admin.js` quản lý các hành động như xóa, đổi tên các tệp trong hệ thống lưu trữ. Nó sử dụng thông tin từ `STORAGE_ACCOUNTS` để thực hiện các thao tác trên Cloudflare R2.

### Cấu hình `functions/auth.js`

1. **Cấu hình AUTH_CONFIG**:
   - Trong `auth.js`, bạn có thể bật hoặc tắt xác thực bằng cách thay đổi giá trị `enabled` trong `AUTH_CONFIG`.
   - Thay đổi `username` và `password` theo thông tin xác thực mong muốn của bạn.

2. **Thiết lập xác thực cho các trang**:
   - Mặc định, xác thực được áp dụng cho các đường dẫn `/`, `/index.html`, và `/admin`. Điều này có nghĩa là người dùng sẽ cần cung cấp thông tin xác thực để truy cập các trang này.

3. **Cấu hình đường dẫn**:
    - Nếu muốn cho phép người dùng upload công khai, chỉ xác thực admin, thì sửa 

```
if (path === "/" || path === "/index.html" || path === "/admin") {
```

Thành

```
if (path === "/admin") {
```