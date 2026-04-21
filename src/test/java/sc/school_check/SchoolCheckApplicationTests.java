package sc.school_check;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;

@SpringBootTest
class SchoolCheckApplicationTests {

    @Autowired
    private DataSource dataSource;

    @Autowired(required = false)
    private JdbcTemplate jdbcTemplate;

    @Test
    void contextLoads() {
        System.out.println("Context started successfully.");
    }

    @Test
    void testDataSourceConnection() throws SQLException {
        try (Connection connection = dataSource.getConnection()) {
            System.out.println("DataSource: " + dataSource.getClass().getName());
            System.out.println("URL: " + connection.getMetaData().getURL());
            System.out.println("User: " + connection.getMetaData().getUserName());
        }
    }

    @Test
    void testJdbcTemplate() {
        if (jdbcTemplate == null) {
            System.out.println("JdbcTemplate not configured, skip SQL check.");
            return;
        }
        String version = jdbcTemplate.queryForObject("SELECT VERSION()", String.class);
        System.out.println("MySQL version: " + version);
    }
}
