SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS sys_user (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(64) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(64),
    department VARCHAR(100),
    employee_id VARCHAR(64),
    email VARCHAR(128),
    phone VARCHAR(32),
    role VARCHAR(32) DEFAULT 'viewer',
    status INT DEFAULT 0,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_deleted TINYINT DEFAULT 0,
    INDEX idx_sys_user_status (status),
    INDEX idx_sys_user_deleted (is_deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS room (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(120) NOT NULL,
    type VARCHAR(64),
    location VARCHAR(255),
    status VARCHAR(32) DEFAULT 'unchecked',
    guide_content MEDIUMTEXT,
    manager_id BIGINT,
    manager_name VARCHAR(64),
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_deleted TINYINT DEFAULT 0,
    INDEX idx_room_status (status),
    INDEX idx_room_deleted (is_deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inspection_record (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    room_id BIGINT,
    room_name VARCHAR(120),
    user_id BIGINT,
    user_name VARCHAR(64),
    status VARCHAR(32),
    notes TEXT,
    rich_content MEDIUMTEXT,
    images MEDIUMTEXT,
    inspection_time DATETIME,
    inspector_id BIGINT,
    inspector_name VARCHAR(64),
    inspect_time DATETIME,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_deleted TINYINT DEFAULT 0,
    INDEX idx_inspection_room_id (room_id),
    INDEX idx_inspection_user_id (user_id),
    INDEX idx_inspection_time (inspect_time),
    INDEX idx_inspection_deleted (is_deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS knowledge (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    tags VARCHAR(255),
    content MEDIUMTEXT,
    device_type VARCHAR(100),
    create_user_id BIGINT,
    create_user_name VARCHAR(64),
    type VARCHAR(64),
    attachment_path VARCHAR(500),
    creator_id BIGINT,
    creator_name VARCHAR(64),
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_deleted TINYINT DEFAULT 0,
    INDEX idx_knowledge_title (title),
    INDEX idx_knowledge_deleted (is_deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS knowledge_comment (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    knowledge_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    user_name VARCHAR(64) NOT NULL,
    content VARCHAR(500) NOT NULL,
    parent_id BIGINT DEFAULT NULL,
    reply_to_user_name VARCHAR(64) DEFAULT NULL,
    pinned TINYINT DEFAULT 0,
    featured TINYINT DEFAULT 0,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_deleted TINYINT DEFAULT 0,
    INDEX idx_knowledge_comment_knowledge_id (knowledge_id),
    INDEX idx_knowledge_comment_user_id (user_id),
    INDEX idx_knowledge_comment_parent_id (parent_id),
    INDEX idx_knowledge_comment_deleted (is_deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shift_schedule (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    schedule_date DATETIME,
    user_id BIGINT,
    user_name VARCHAR(64),
    room_id BIGINT,
    room_name VARCHAR(120),
    shift_type VARCHAR(64),
    notes TEXT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_deleted TINYINT DEFAULT 0,
    INDEX idx_shift_schedule_date (schedule_date),
    INDEX idx_shift_schedule_user_id (user_id),
    INDEX idx_shift_schedule_room_id (room_id),
    INDEX idx_shift_schedule_deleted (is_deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ncic_device (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    model VARCHAR(100),
    type VARCHAR(50),
    ncic_room_id VARCHAR(64),
    ncic_room_name VARCHAR(100),
    status VARCHAR(30),
    owner VARCHAR(100),
    inspection_count INT DEFAULT 0,
    fault_count INT DEFAULT 0,
    updated_at VARCHAR(30),
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ncic_management_page (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50),
    system_name VARCHAR(100),
    status VARCHAR(30),
    owner VARCHAR(100),
    url VARCHAR(255),
    description TEXT,
    last_inspection VARCHAR(30),
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ncic_document (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    category VARCHAR(50),
    size VARCHAR(30),
    updated_at VARCHAR(30),
    description TEXT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ncic_duty (
    id VARCHAR(64) PRIMARY KEY,
    duty_date DATE NOT NULL,
    swpu_user_id VARCHAR(64),
    swpu_user_name VARCHAR(100),
    phone VARCHAR(30),
    note TEXT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_ncic_duty_date (duty_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ncic_patrol_record (
    id VARCHAR(64) PRIMARY KEY,
    target_type VARCHAR(30) NOT NULL,
    target_id VARCHAR(64) NOT NULL,
    status VARCHAR(30),
    notes TEXT,
    rich_content MEDIUMTEXT,
    images MEDIUMTEXT,
    inspector VARCHAR(100),
    patrol_date DATE,
    patrol_time DATETIME,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_ncic_patrol_target (target_type, target_id),
    INDEX idx_ncic_patrol_time (patrol_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ncic_operation_log (
    id VARCHAR(80) PRIMARY KEY,
    action VARCHAR(100),
    level VARCHAR(30),
    operator VARCHAR(100),
    log_time DATETIME,
    payload TEXT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ncic_operation_time (log_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ncic_ai_setting (
    id VARCHAR(40) PRIMARY KEY,
    api_key TEXT,
    api_url VARCHAR(255),
    model VARCHAR(100),
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO ncic_ai_setting (id, api_key, api_url, model)
VALUES ('default', NULL, '', '');
