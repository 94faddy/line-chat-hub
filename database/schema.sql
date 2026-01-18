-- LINE Chat Hub Database Schema
-- สร้าง Database
CREATE DATABASE IF NOT EXISTS line_chat_hub CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE line_chat_hub;

-- ตาราง Users (ผู้ใช้งานระบบ)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    avatar VARCHAR(500),
    role ENUM('super_admin', 'admin', 'user') DEFAULT 'user',
    status ENUM('pending', 'active', 'suspended') DEFAULT 'pending',
    email_verified_at DATETIME,
    verification_token VARCHAR(255),
    reset_token VARCHAR(255),
    reset_token_expires DATETIME,
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_status (status),
    INDEX idx_role (role)
) ENGINE=InnoDB;

-- ตาราง LINE Channels (ช่องทาง LINE OA)
CREATE TABLE IF NOT EXISTS line_channels (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    channel_name VARCHAR(100) NOT NULL,
    channel_id VARCHAR(100) NOT NULL,
    channel_secret VARCHAR(100) NOT NULL,
    channel_access_token TEXT NOT NULL,
    webhook_url VARCHAR(500),
    basic_id VARCHAR(50),
    picture_url VARCHAR(500),
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_channel (user_id, channel_id),
    INDEX idx_user_id (user_id),
    INDEX idx_channel_id (channel_id),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- ตาราง LINE Users (ผู้ใช้ LINE ที่ทักมา)
CREATE TABLE IF NOT EXISTS line_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    channel_id INT NOT NULL,
    line_user_id VARCHAR(100) NOT NULL,
    display_name VARCHAR(255),
    picture_url VARCHAR(500),
    status_message TEXT,
    language VARCHAR(10),
    tags JSON,
    notes TEXT,
    is_blocked TINYINT(1) DEFAULT 0,
    is_spam TINYINT(1) DEFAULT 0,
    last_message_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (channel_id) REFERENCES line_channels(id) ON DELETE CASCADE,
    UNIQUE KEY unique_line_user (channel_id, line_user_id),
    INDEX idx_channel_id (channel_id),
    INDEX idx_line_user_id (line_user_id),
    INDEX idx_last_message (last_message_at)
) ENGINE=InnoDB;

-- ตาราง Conversations (การสนทนา)
CREATE TABLE IF NOT EXISTS conversations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    channel_id INT NOT NULL,
    line_user_id INT NOT NULL,
    status ENUM('unread', 'read', 'processing', 'completed', 'spam') DEFAULT 'unread',
    assigned_to INT,
    priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
    last_message_preview TEXT,
    last_message_at DATETIME,
    unread_count INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (channel_id) REFERENCES line_channels(id) ON DELETE CASCADE,
    FOREIGN KEY (line_user_id) REFERENCES line_users(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_conversation (channel_id, line_user_id),
    INDEX idx_status (status),
    INDEX idx_last_message (last_message_at),
    INDEX idx_assigned (assigned_to)
) ENGINE=InnoDB;

-- ตาราง Messages (ข้อความ)
CREATE TABLE IF NOT EXISTS messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT NOT NULL,
    channel_id INT NOT NULL,
    line_user_id INT NOT NULL,
    message_id VARCHAR(100),
    direction ENUM('incoming', 'outgoing') NOT NULL,
    message_type ENUM('text', 'image', 'video', 'audio', 'file', 'location', 'sticker', 'template', 'flex') NOT NULL,
    content TEXT,
    media_url VARCHAR(500),
    media_type VARCHAR(50),
    sticker_id VARCHAR(50),
    package_id VARCHAR(50),
    reply_token VARCHAR(100),
    sent_by INT,
    is_read TINYINT(1) DEFAULT 0,
    read_at DATETIME,
    delivered_at DATETIME,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (channel_id) REFERENCES line_channels(id) ON DELETE CASCADE,
    FOREIGN KEY (line_user_id) REFERENCES line_users(id) ON DELETE CASCADE,
    FOREIGN KEY (sent_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_conversation (conversation_id),
    INDEX idx_created (created_at),
    INDEX idx_direction (direction)
) ENGINE=InnoDB;

-- ตาราง Quick Replies (ข้อความตอบกลับด่วน)
CREATE TABLE IF NOT EXISTS quick_replies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    channel_id INT,
    title VARCHAR(100) NOT NULL,
    shortcut VARCHAR(50),
    message_type ENUM('text', 'image', 'template') DEFAULT 'text',
    content TEXT NOT NULL,
    media_url VARCHAR(500),
    is_global TINYINT(1) DEFAULT 0,
    use_count INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (channel_id) REFERENCES line_channels(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_shortcut (shortcut)
) ENGINE=InnoDB;

-- ตาราง Tags (แท็กสำหรับจัดกลุ่ม)
CREATE TABLE IF NOT EXISTS tags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(50) NOT NULL,
    color VARCHAR(7) DEFAULT '#3B82F6',
    description VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_tag (user_id, name),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB;

-- ตาราง Conversation Tags (เชื่อมแท็กกับการสนทนา)
CREATE TABLE IF NOT EXISTS conversation_tags (
    conversation_id INT NOT NULL,
    tag_id INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (conversation_id, tag_id),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ตาราง Admin Permissions (สิทธิ์แอดมิน)
CREATE TABLE IF NOT EXISTS admin_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    owner_id INT NOT NULL,
    admin_id INT NOT NULL,
    channel_id INT,
    permissions JSON,
    status ENUM('pending', 'active', 'revoked') DEFAULT 'pending',
    invited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    accepted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (channel_id) REFERENCES line_channels(id) ON DELETE CASCADE,
    UNIQUE KEY unique_permission (owner_id, admin_id, channel_id),
    INDEX idx_admin (admin_id),
    INDEX idx_owner (owner_id)
) ENGINE=InnoDB;

-- ตาราง Activity Logs (บันทึกกิจกรรม)
CREATE TABLE IF NOT EXISTS activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INT,
    details JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user (user_id),
    INDEX idx_action (action),
    INDEX idx_created (created_at)
) ENGINE=InnoDB;

-- ตาราง Auto Replies (ข้อความตอบกลับอัตโนมัติ)
CREATE TABLE IF NOT EXISTS auto_replies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    channel_id INT,
    keyword VARCHAR(255) NOT NULL,
    match_type ENUM('exact', 'contains', 'starts_with', 'regex') DEFAULT 'contains',
    response_type ENUM('text', 'image', 'template') DEFAULT 'text',
    response_content TEXT NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    priority INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (channel_id) REFERENCES line_channels(id) ON DELETE SET NULL,
    INDEX idx_active (is_active),
    INDEX idx_keyword (keyword)
) ENGINE=InnoDB;

-- ตาราง Broadcasts (ส่งข้อความหาหลายคน)
CREATE TABLE IF NOT EXISTS broadcasts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    channel_id INT NOT NULL,
    message_type ENUM('text', 'image', 'template', 'flex') DEFAULT 'text',
    content TEXT NOT NULL,
    target_type ENUM('all', 'segment') DEFAULT 'all',
    target_count INT DEFAULT 0,
    sent_count INT DEFAULT 0,
    failed_count INT DEFAULT 0,
    status ENUM('draft', 'scheduled', 'sending', 'completed', 'failed') DEFAULT 'draft',
    scheduled_at DATETIME,
    sent_at DATETIME,
    created_by INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (channel_id) REFERENCES line_channels(id) ON DELETE CASCADE,
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- สร้าง Super Admin เริ่มต้น (password: admin123)
INSERT INTO users (email, password, name, role, status, email_verified_at) 
VALUES ('admin@bevchat.in', '$2a$10$rQnM1xGLKdH8N7yrJ7K8AO5Z3yVmG6W8X9B4Q2N1M0P3K7J5L9H2V', 'Super Admin', 'super_admin', 'active', NOW())
ON DUPLICATE KEY UPDATE name = name;

-- สร้าง Default Tags
INSERT INTO tags (user_id, name, color, description) VALUES 
(1, 'สนใจ', '#22C55E', 'ลูกค้าที่สนใจสินค้า'),
(1, 'รอตัดสินใจ', '#F59E0B', 'รอลูกค้าตัดสินใจ'),
(1, 'VIP', '#8B5CF6', 'ลูกค้า VIP'),
(1, 'ใหม่', '#3B82F6', 'ลูกค้าใหม่'),
(1, 'ซื้อแล้ว', '#10B981', 'ลูกค้าที่ซื้อแล้ว')
ON DUPLICATE KEY UPDATE name = name;
