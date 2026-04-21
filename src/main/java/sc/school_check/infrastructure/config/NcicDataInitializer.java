package sc.school_check.infrastructure.config;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

@Component
@Order(20)
public class NcicDataInitializer implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    public NcicDataInitializer(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        createTables();
        ensureDocumentSchema();
        seedDocumentUrls();
        seedData();
    }

    private void createTables() {
        jdbcTemplate.execute("""
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
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """);
        jdbcTemplate.execute("""
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
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS ncic_document (
                    id VARCHAR(64) PRIMARY KEY,
                    title VARCHAR(150) NOT NULL,
                    url VARCHAR(255),
                    category VARCHAR(50),
                    size VARCHAR(30),
                    updated_at VARCHAR(30),
                    description TEXT,
                    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """);
        jdbcTemplate.execute("""
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
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """);
        jdbcTemplate.execute("""
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
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS ncic_operation_log (
                    id VARCHAR(80) PRIMARY KEY,
                    action VARCHAR(100),
                    level VARCHAR(30),
                    operator VARCHAR(100),
                    log_time DATETIME,
                    payload TEXT,
                    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_ncic_operation_time (log_time)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS ncic_ai_setting (
                    id VARCHAR(40) PRIMARY KEY,
                    api_key TEXT,
                    api_url VARCHAR(255),
                    model VARCHAR(100),
                    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """);
        jdbcTemplate.update("""
                INSERT IGNORE INTO ncic_ai_setting (id, api_key, api_url, model)
                VALUES ('default', NULL, '', '')
                """);
    }

    private void ensureDocumentSchema() {
        try {
            jdbcTemplate.execute("ALTER TABLE ncic_document ADD COLUMN url VARCHAR(255) NULL AFTER title");
        } catch (Exception ignored) {
            // Column already exists on upgraded databases.
        }
    }

    private void seedDocumentUrls() {
        jdbcTemplate.update("""
                INSERT IGNORE INTO ncic_document
                (id, title, url, category, size, updated_at, description)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                "doc_example_inspection",
                "inspection-submit-example.html",
                "docs/inspection-submit-example.html",
                "操作示例",
                "12 KB",
                "2026-04-19",
                "示例文档，演示如何填写巡检状态、备注、上传截图并提交记录。");
        jdbcTemplate.update("""
                UPDATE ncic_document
                SET url = CASE id
                    WHEN 'doc_1' THEN 'docs/IBM-BladeCenter-H-maintenance.pdf'
                    WHEN 'doc_2' THEN 'docs/UPS-daily-inspection.xlsx'
                    WHEN 'doc_3' THEN 'docs/NetApp-storage-inspection.docx'
                    WHEN 'doc_4' THEN 'docs/database-audit-troubleshooting.pdf'
                    WHEN 'doc_5' THEN 'docs/management-page-checklist.xlsx'
                    WHEN 'doc_example_inspection' THEN 'docs/inspection-submit-example.html'
                    ELSE url
                END
                WHERE url IS NULL OR url = ''
                """);
    }

    private void seedData() {
        insertDevice("device_1", "IBM 刀片服务器", "BladeCenter H", "服务器", "ncicRoom-1", "明理楼 8210", "normal", "网络中心", 48, 1, "2026-04-10");
        insertDevice("device_2", "NetApp 存储", "FAS2750", "存储", "ncicRoom-2", "明理楼 8211", "normal", "网络中心", 52, 2, "2026-04-10");
        insertDevice("device_3", "UPS 主机 A", "Eaton 93PR", "UPS", "ncicRoom-4", "明理楼 UPS-112", "warning", "值班工程师", 40, 5, "2026-04-11");
        insertDevice("device_4", "核心交换机 01", "S12700E", "交换机", "ncicRoom-1", "明理楼 8210", "normal", "网络中心", 60, 1, "2026-04-10");
        insertDevice("device_5", "精密空调 A", "Vertiv PEX4", "空调", "ncicRoom-3", "明理楼 8108", "warning", "运维组", 35, 4, "2026-04-11");

        insertManagementPage("mgmt_1", "存储管理平台", "存储管理", "存储系统", "unchecked", "网络中心", "https://storage.swpu.edu.cn", "检查容量、快照、复制链路和告警。");
        insertManagementPage("mgmt_2", "ORACLE RAC", "数据库", "业务数据库", "unchecked", "数据库组", "https://rac.swpu.edu.cn", "检查集群状态、监听、表空间和备份任务。");
        insertManagementPage("mgmt_3", "站群系统", "管理页面", "内容管理", "unchecked", "网站运维", "https://site.swpu.edu.cn", "检查站点可用性、证书和访问日志。");

        insertDocument("doc_1", "IBM 刀片服务器维护手册.pdf", "服务器", "2.5 MB", "2026-04-01", "包含电源模块、风扇、管理口、故障灯判断与常见重启步骤。");
        insertDocument("doc_2", "UPS 日常巡检表.xlsx", "UPS", "0.8 MB", "2026-04-03", "记录 UPS 输入输出、电池组温度、旁路状态、负载率与告警灯状态。");
        insertDocument("doc_3", "NetApp 存储巡检作业指导.docx", "存储", "1.2 MB", "2026-04-06", "涵盖控制器健康、磁盘告警、快照保留策略、复制链路与容量阈值检查项。");

        LocalDate firstDay = LocalDate.now().withDayOfMonth(1);
        for (int offset = 0; offset < firstDay.lengthOfMonth(); offset++) {
            LocalDate dutyDate = firstDay.plusDays(offset);
            boolean even = offset % 2 == 0;
            insertDuty("duty-" + dutyDate, dutyDate.toString(), even ? "swpuUser_2" : "swpuUser_3", even ? "陈睿曦" : "张悦", even ? "13398289659" : "18113190179", "负责当日机房巡检、告警跟进与交接班记录。");
        }
    }

    private void insertDevice(String id, String name, String model, String type, String roomId, String roomName, String status, String owner, int inspectionCount, int faultCount, String updatedAt) {
        jdbcTemplate.update("""
                INSERT IGNORE INTO ncic_device
                (id, name, model, type, ncic_room_id, ncic_room_name, status, owner, inspection_count, fault_count, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, id, name, model, type, roomId, roomName, status, owner, inspectionCount, faultCount, updatedAt);
    }

    private void insertManagementPage(String id, String name, String type, String system, String status, String owner, String url, String description) {
        jdbcTemplate.update("""
                INSERT IGNORE INTO ncic_management_page
                (id, name, type, system_name, status, owner, url, description)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, id, name, type, system, status, owner, url, description);
    }

    private void insertDocument(String id, String title, String category, String size, String updatedAt, String description) {
        jdbcTemplate.update("""
                INSERT IGNORE INTO ncic_document
                (id, title, url, category, size, updated_at, description)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, id, title, defaultDocumentUrl(id), category, size, updatedAt, description);
    }

    private String defaultDocumentUrl(String id) {
        return switch (id) {
            case "doc_1" -> "docs/IBM-BladeCenter-H-maintenance.pdf";
            case "doc_2" -> "docs/UPS-daily-inspection.xlsx";
            case "doc_3" -> "docs/NetApp-storage-inspection.docx";
            case "doc_4" -> "docs/database-audit-troubleshooting.pdf";
            case "doc_5" -> "docs/management-page-checklist.xlsx";
            case "doc_example_inspection" -> "docs/inspection-submit-example.html";
            default -> null;
        };
    }

    private void insertDuty(String id, String date, String userId, String userName, String phone, String note) {
        jdbcTemplate.update("""
                INSERT IGNORE INTO ncic_duty
                (id, duty_date, swpu_user_id, swpu_user_name, phone, note)
                VALUES (?, ?, ?, ?, ?, ?)
                """, id, date, userId, userName, phone, note);
    }
}
