package sc.school_check;

import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

/**
 * 测试基类：统一配置 Spring Boot 测试上下文
 * 所有测试类继承此类，避免重复配置注解
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc // 自动配置 MockMvc
@SpringJUnitConfig
public class BaseTest {
}