package sc.school_check.infrastructure.config;

import jakarta.servlet.MultipartConfigElement;
import org.springframework.boot.autoconfigure.web.servlet.MultipartProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.unit.DataSize;

@Configuration
@EnableConfigurationProperties(MultipartProperties.class)
public class FileUploadConfig {

    private final MultipartProperties multipartProperties;

    public FileUploadConfig(MultipartProperties multipartProperties) {
        this.multipartProperties = multipartProperties;
    }

    @Bean
    public MultipartConfigElement multipartConfigElement() {
        multipartProperties.setMaxFileSize(DataSize.ofMegabytes(10));
        multipartProperties.setMaxRequestSize(DataSize.ofMegabytes(50));
        multipartProperties.setLocation(System.getenv().getOrDefault("UPLOAD_TEMP_DIR", "D:/school_check/temp"));
        return multipartProperties.createMultipartConfig();
    }
}