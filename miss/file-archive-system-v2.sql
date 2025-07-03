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
