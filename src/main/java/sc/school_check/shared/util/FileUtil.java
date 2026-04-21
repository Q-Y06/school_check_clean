package sc.school_check.shared.util;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.UUID;

@Component
public class FileUtil {

    private static final String[] ALLOWED_SUFFIX = {".jpg", ".jpeg", ".png", ".bmp", ".gif"};

    private final Path uploadRoot;

    public FileUtil(@Value("${app.upload-dir:${UPLOAD_DIR:./upload}}") String uploadDir) {
        String resolvedUploadDir = (uploadDir == null || uploadDir.isBlank()) ? "./upload" : uploadDir;
        this.uploadRoot = Path.of(resolvedUploadDir).toAbsolutePath().normalize();
    }

    public String uploadFiles(List<MultipartFile> fileList) {
        if (fileList == null || fileList.isEmpty()) {
            return null;
        }
        StringBuilder fileUrls = new StringBuilder();
        for (MultipartFile file : fileList) {
            String url = uploadSingleFile(file);
            if (url != null) {
                fileUrls.append(url).append(",");
            }
        }
        if (fileUrls.length() > 0) {
            fileUrls.deleteCharAt(fileUrls.length() - 1);
        }
        return fileUrls.toString();
    }

    public String uploadSingleFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return null;
        }
        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null || originalFilename.isEmpty() || !originalFilename.contains(".")) {
            return null;
        }
        String suffix = originalFilename.substring(originalFilename.lastIndexOf(".")).toLowerCase();
        boolean isAllowed = false;
        for (String allowed : ALLOWED_SUFFIX) {
            if (allowed.equals(suffix)) {
                isAllowed = true;
                break;
            }
        }
        if (!isAllowed) {
            throw new RuntimeException("不支持的图片格式，仅支持 jpg、jpeg、png、bmp、gif");
        }
        String newFileName = UUID.randomUUID().toString().replace("-", "") + suffix;
        Path target = uploadRoot.resolve(newFileName).normalize();
        if (!target.startsWith(uploadRoot)) {
            throw new RuntimeException("文件路径不合法");
        }
        try {
            Files.createDirectories(uploadRoot);
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
            return "/upload/" + newFileName;
        } catch (IOException e) {
            throw new RuntimeException("文件上传失败，请检查服务器路径权限", e);
        }
    }
}
