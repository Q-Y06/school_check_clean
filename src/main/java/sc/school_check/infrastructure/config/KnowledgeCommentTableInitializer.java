package sc.school_check.infrastructure.config;

import jakarta.annotation.PostConstruct;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class KnowledgeCommentTableInitializer {

    private final JdbcTemplate jdbcTemplate;

    public KnowledgeCommentTableInitializer(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostConstruct
    public void init() {
        jdbcTemplate.execute("""
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
                    INDEX idx_knowledge_comment_parent_id (parent_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """);
        ensureColumn("parent_id", "ALTER TABLE knowledge_comment ADD COLUMN parent_id BIGINT DEFAULT NULL");
        ensureColumn("reply_to_user_name", "ALTER TABLE knowledge_comment ADD COLUMN reply_to_user_name VARCHAR(64) DEFAULT NULL");
        ensureColumn("pinned", "ALTER TABLE knowledge_comment ADD COLUMN pinned TINYINT DEFAULT 0");
        ensureColumn("featured", "ALTER TABLE knowledge_comment ADD COLUMN featured TINYINT DEFAULT 0");
    }

    private void ensureColumn(String columnName, String ddl) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'knowledge_comment' AND COLUMN_NAME = ?",
                Integer.class,
                columnName
        );
        if (count != null && count == 0) {
            jdbcTemplate.execute(ddl);
        }
    }
}
