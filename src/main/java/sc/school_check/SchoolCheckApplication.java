package sc.school_check;

import org.mybatis.spring.annotation.MapperScan;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@MapperScan("sc.school_check.infrastructure.persistence.mapper")
public class SchoolCheckApplication {

    private static final Logger log = LoggerFactory.getLogger(SchoolCheckApplication.class);

    public static void main(String[] args) {
        SpringApplication.run(SchoolCheckApplication.class, args);
        log.info("数据中心巡检管理系统启动成功");
    }
}
