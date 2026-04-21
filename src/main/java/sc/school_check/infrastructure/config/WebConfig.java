package sc.school_check.infrastructure.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final String uploadResourceLocation;

    public WebConfig(@Value("${app.upload-dir:${UPLOAD_DIR:./upload}}") String uploadDir) {
        String resolvedUploadDir = (uploadDir == null || uploadDir.isBlank()) ? "./upload" : uploadDir;
        this.uploadResourceLocation = Path.of(resolvedUploadDir).toAbsolutePath().normalize().toUri().toString();
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns("*")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true)
                .maxAge(3600);
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/upload/**")
                .addResourceLocations(uploadResourceLocation);
        registry.addResourceHandler("/html/**")
                .addResourceLocations("classpath:/static/html/");
    }
}
