package sc.school_check.interfaces.rest;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import sc.school_check.shared.util.ResponseUtil;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

@RestController
@RequestMapping("/api/ncic")
public class NcicDataController {

    private static final TypeReference<List<Map<String, Object>>> LIST_TYPE = new TypeReference<>() {};
    private static final Set<String> DOCUMENT_EXTENSIONS = Set.of(
            ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".html", ".htm", ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".zip", ".rar"
    );

    private final Path documentUploadDir;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public NcicDataController(
            JdbcTemplate jdbcTemplate,
            ObjectMapper objectMapper,
            @Value("${app.upload-dir:${UPLOAD_DIR:./upload}}") String uploadDir
    ) {
        String resolvedUploadDir = (uploadDir == null || uploadDir.isBlank()) ? "./upload" : uploadDir;
        this.documentUploadDir = Path.of(resolvedUploadDir).toAbsolutePath().normalize().resolve("documents").normalize();
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    @GetMapping("/bootstrap")
    public ResponseUtil<Map<String, Object>> bootstrap() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("swpuUsers", listUsers());
        data.put("ncicRooms", listRooms());
        data.put("devices", listDevices());
        data.put("managementPages", listManagementPages());
        data.put("documents", listDocuments());
        data.put("ncicDutyList", listDuty());
        data.put("dailyPatrolRecords", patrolRecordsByTarget("room"));
        data.put("devicePatrolRecords", patrolRecordsByTarget("device"));
        data.put("managementPatrolRecords", patrolRecordsByTarget("management"));
        data.put("duty_log", listOperationLogs());
        return ResponseUtil.success(data);
    }

    @PostMapping("/sync/{key}")
    @Transactional(rollbackFor = Exception.class)
    public ResponseUtil<?> sync(@PathVariable String key, @RequestBody Object value) {
        switch (key) {
            case "swpuUsers" -> replaceUsers(toList(value));
            case "ncicRooms" -> replaceRooms(toList(value));
            case "devices" -> replaceDevices(toList(value));
            case "managementPages" -> replaceManagementPages(toList(value));
            case "documents" -> replaceDocuments(toList(value));
            case "ncicDutyList" -> replaceDuty(toList(value));
            case "dailyPatrolRecords" -> replacePatrolRecords("room", toRecordList(value));
            case "devicePatrolRecords" -> replacePatrolRecords("device", toRecordList(value));
            case "managementPatrolRecords" -> replacePatrolRecords("management", toRecordList(value));
            case "duty_log" -> replaceOperationLogs(toList(value));
            default -> {
                return ResponseUtil.error(400, "不支持同步的数据类型: " + key);
            }
        }
        return ResponseUtil.success("同步成功");
    }

    @PostMapping("/documents/upload")
    public ResponseUtil<Map<String, Object>> uploadDocument(@RequestPart("file") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return ResponseUtil.error(400, "请选择要上传的文档");
        }
        String originalName = Optional.ofNullable(file.getOriginalFilename()).orElse("document");
        String safeOriginalName = originalName.replaceAll("[\\\\/:*?\"<>|]+", "_");
        String extension = extensionOf(safeOriginalName);
        if (!DOCUMENT_EXTENSIONS.contains(extension.toLowerCase(Locale.ROOT))) {
            return ResponseUtil.error(400, "不支持的文档格式");
        }
        try {
            Files.createDirectories(documentUploadDir);
            String storedName = UUID.randomUUID().toString().replace("-", "") + extension;
            Path target = documentUploadDir.resolve(storedName);
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("title", safeOriginalName);
            data.put("url", "/upload/documents/" + storedName);
            data.put("size", humanSize(file.getSize()));
            return ResponseUtil.success(data);
        } catch (Exception ex) {
            return ResponseUtil.error(500, "文档上传失败，请稍后重试");
        }
    }

    @GetMapping("/documents/preview")
    public ResponseUtil<Map<String, Object>> previewDocument(@RequestParam("src") String src) {
        if (src == null || src.isBlank()) {
            return ResponseUtil.error(400, "缺少文档地址");
        }
        try {
            String decodedSrc = URLDecoder.decode(src, StandardCharsets.UTF_8);
            byte[] content = readDocumentBytes(decodedSrc);
            String extension = extensionOf(decodedSrc).toLowerCase(Locale.ROOT);
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("src", decodedSrc);
            data.put("mode", previewMode(extension));
            data.put("html", convertDocumentToHtml(content, extension, decodedSrc));
            return ResponseUtil.success(data);
        } catch (Exception ex) {
            return ResponseUtil.error(500, "文档转换失败: " + ex.getMessage());
        }
    }

    private List<Map<String, Object>> listDevices() {
        return jdbcTemplate.queryForList("""
                SELECT id, name, model, type,
                       ncic_room_id AS ncicRoomId,
                       ncic_room_name AS ncicRoomName,
                       status, owner,
                       inspection_count AS inspectionCount,
                       fault_count AS faultCount,
                       updated_at AS updatedAt
                FROM ncic_device
                ORDER BY id
                """);
    }

    private List<Map<String, Object>> listUsers() {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT CONCAT('swpuUser_', id) AS id,
                       username AS swpuUsername,
                       password,
                       full_name AS name,
                       phone,
                       email,
                       department,
                       employee_id AS employeeId,
                       role,
                       CASE WHEN status = 1 THEN 'active' ELSE 'inactive' END AS status
                FROM sys_user
                WHERE is_deleted = 0
                ORDER BY id
                """);
        for (Map<String, Object> row : rows) {
            String role = string(row.get("role"));
            row.put("roles", "admin".equals(role) ? List.of("admin") : List.of("engineer", "duty".equals(role) ? "duty" : "engineer"));
            if (String.valueOf(row.get("password")).startsWith("$2")) {
                row.put("password", "password123");
            }
        }
        return rows;
    }

    private List<Map<String, Object>> listRooms() {
        return jdbcTemplate.queryForList("""
                SELECT CONCAT('ncicRoom-', id) AS id,
                       name,
                       type,
                       location,
                       status,
                       guide_content AS description,
                       NULL AS lastInspection,
                       CASE WHEN type LIKE '%UPS%' THEN 1 ELSE 0 END AS isCore
                FROM room
                WHERE is_deleted = 0
                ORDER BY id
                """);
    }

    private List<Map<String, Object>> listManagementPages() {
        return jdbcTemplate.queryForList("""
                SELECT id, name, type,
                       system_name AS `system`,
                       status, owner, url, description,
                       last_inspection AS lastInspection
                FROM ncic_management_page
                ORDER BY id
                """);
    }

    private List<Map<String, Object>> listDocuments() {
        return jdbcTemplate.queryForList("""
                SELECT id, title, url, category, size, updated_at AS updatedAt, description
                FROM ncic_document
                ORDER BY id
                """);
    }

    private List<Map<String, Object>> listDuty() {
        return jdbcTemplate.queryForList("""
                SELECT id,
                       DATE_FORMAT(duty_date, '%Y-%m-%d') AS date,
                       swpu_user_id AS swpuUserId,
                       swpu_user_name AS swpuUserName,
                       phone,
                       note
                FROM ncic_duty
                ORDER BY duty_date
                """);
    }

    private Map<String, List<Map<String, Object>>> patrolRecordsByTarget(String targetType) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT id, target_id AS targetId, status, notes,
                       rich_content AS richContent,
                       images,
                       inspector,
                       DATE_FORMAT(patrol_date, '%Y-%m-%d') AS date,
                       DATE_FORMAT(patrol_time, '%Y-%m-%dT%H:%i:%s') AS timestamp
                FROM ncic_patrol_record
                WHERE target_type = ?
                ORDER BY patrol_time
                """, targetType);
        Map<String, List<Map<String, Object>>> grouped = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            String targetId = string(row.remove("targetId"));
            if (targetId != null) {
                grouped.computeIfAbsent(targetId, ignored -> new ArrayList<>()).add(row);
            }
        }
        return grouped;
    }

    private List<Map<String, Object>> listOperationLogs() {
        return jdbcTemplate.queryForList("""
                SELECT id, action, level, operator,
                       DATE_FORMAT(log_time, '%Y-%m-%dT%H:%i:%s') AS timestamp,
                       payload
                FROM ncic_operation_log
                ORDER BY log_time DESC
                LIMIT 300
                """);
    }

    private void replaceDevices(List<Map<String, Object>> rows) {
        jdbcTemplate.update("DELETE FROM ncic_device");
        for (Map<String, Object> row : rows) {
            jdbcTemplate.update("""
                    INSERT INTO ncic_device
                    (id, name, model, type, ncic_room_id, ncic_room_name, status, owner, inspection_count, fault_count, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    requiredId(row, "device"), string(row.get("name")), string(row.get("model")), string(row.get("type")),
                    string(row.get("ncicRoomId")), string(row.get("ncicRoomName")), string(row.get("status")), string(row.get("owner")),
                    number(row.get("inspectionCount")), number(row.get("faultCount")), string(row.get("updatedAt")));
        }
    }

    private void replaceUsers(List<Map<String, Object>> rows) {
        jdbcTemplate.update("DELETE FROM sys_user");
        long nextId = 1;
        for (Map<String, Object> row : rows) {
            Long id = numericId(row.get("id"));
            if (id == null) {
                id = nextId;
            }
            nextId = Math.max(nextId, id + 1);
            jdbcTemplate.update("""
                    INSERT INTO sys_user
                    (id, username, password, full_name, department, employee_id, email, phone, role, status, is_deleted)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
                    """,
                    id, string(row.get("swpuUsername")), string(row.get("password")), string(row.get("name")),
                    string(row.get("department")), string(row.get("employeeId")), string(row.get("email")),
                    string(row.get("phone")), string(row.get("role")),
                    "active".equals(string(row.get("status"))) ? 1 : 0);
        }
    }

    private void replaceRooms(List<Map<String, Object>> rows) {
        jdbcTemplate.update("DELETE FROM room");
        long nextId = 1;
        for (Map<String, Object> row : rows) {
            Long id = numericId(row.get("id"));
            if (id == null) {
                id = nextId;
            }
            nextId = Math.max(nextId, id + 1);
            jdbcTemplate.update("""
                    INSERT INTO room
                    (id, name, type, location, status, guide_content, manager_id, manager_name, is_deleted)
                    VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 0)
                    """,
                    id, string(row.get("name")), string(row.get("type")), string(row.get("location")),
                    string(row.get("status")), string(row.get("description")));
        }
    }

    private void replaceManagementPages(List<Map<String, Object>> rows) {
        jdbcTemplate.update("DELETE FROM ncic_management_page");
        for (Map<String, Object> row : rows) {
            jdbcTemplate.update("""
                    INSERT INTO ncic_management_page
                    (id, name, type, system_name, status, owner, url, description, last_inspection)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    requiredId(row, "mgmt"), string(row.get("name")), string(row.get("type")), string(row.get("system")),
                    string(row.get("status")), string(row.get("owner")), string(row.get("url")),
                    string(row.get("description")), string(row.get("lastInspection")));
        }
    }

    private void replaceDocuments(List<Map<String, Object>> rows) {
        jdbcTemplate.update("DELETE FROM ncic_document");
        for (Map<String, Object> row : rows) {
            jdbcTemplate.update("""
                    INSERT INTO ncic_document
                    (id, title, url, category, size, updated_at, description)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    requiredId(row, "doc"), string(row.get("title")),
                    firstText(row.get("url"), firstText(row.get("link"), row.get("href"))), string(row.get("category")),
                    string(row.get("size")), string(row.get("updatedAt")), string(row.get("description")));
        }
    }

    private void replaceDuty(List<Map<String, Object>> rows) {
        jdbcTemplate.update("DELETE FROM ncic_duty");
        for (Map<String, Object> row : rows) {
            jdbcTemplate.update("""
                    INSERT INTO ncic_duty
                    (id, duty_date, swpu_user_id, swpu_user_name, phone, note)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    requiredId(row, "duty"), sqlDate(row.get("date")), string(row.get("swpuUserId")),
                    string(row.get("swpuUserName")), string(row.get("phone")), string(row.get("note")));
        }
    }

    private void replacePatrolRecords(String targetType, List<Map<String, Object>> rows) {
        jdbcTemplate.update("DELETE FROM ncic_patrol_record WHERE target_type = ?", targetType);
        for (Map<String, Object> row : rows) {
            String targetId = string(row.get("targetId"));
            if (targetId == null || targetId.isBlank()) {
                continue;
            }
            jdbcTemplate.update("""
                    INSERT INTO ncic_patrol_record
                    (id, target_type, target_id, status, notes, rich_content, images, inspector, patrol_date, patrol_time)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    requiredId(row, "patrol"), targetType, targetId, string(row.get("status")), string(row.get("notes")),
                    firstText(row.get("richContent"), row.get("richText")), json(row.get("images")), string(row.get("inspector")),
                    sqlDate(row.get("date")), sqlTimestamp(row.get("timestamp")));
        }
    }

    private void replaceOperationLogs(List<Map<String, Object>> rows) {
        jdbcTemplate.update("DELETE FROM ncic_operation_log");
        for (Map<String, Object> row : rows) {
            jdbcTemplate.update("""
                    INSERT INTO ncic_operation_log
                    (id, action, level, operator, log_time, payload)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    requiredId(row, "op"), string(row.get("action")), string(row.get("level")),
                    string(row.get("operator")), sqlTimestamp(row.get("timestamp")), json(row.get("payload")));
        }
    }

    private List<Map<String, Object>> toRecordList(Object value) {
        Map<String, Object> grouped = objectMapper.convertValue(value, new TypeReference<>() {});
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Map.Entry<String, Object> entry : grouped.entrySet()) {
            List<Map<String, Object>> records = objectMapper.convertValue(entry.getValue(), LIST_TYPE);
            for (Map<String, Object> record : records) {
                record.put("targetId", entry.getKey());
                rows.add(record);
            }
        }
        return rows;
    }

    private List<Map<String, Object>> toList(Object value) {
        return objectMapper.convertValue(value, LIST_TYPE);
    }

    private String requiredId(Map<String, Object> row, String prefix) {
        String id = string(row.get("id"));
        return id == null || id.isBlank() ? prefix + "_" + UUID.randomUUID() : id;
    }

    private Long numericId(Object value) {
        String raw = string(value);
        if (raw == null) {
            return null;
        }
        String digits = raw.replaceAll("\\D+", "");
        return digits.isBlank() ? null : Long.parseLong(digits);
    }

    private String string(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private String firstText(Object first, Object second) {
        String value = string(first);
        if (value != null && !value.isBlank()) {
            return value;
        }
        return string(second);
    }

    private int number(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value == null || String.valueOf(value).isBlank()) {
            return 0;
        }
        return Integer.parseInt(String.valueOf(value));
    }

    private Date sqlDate(Object value) {
        String raw = string(value);
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return Date.valueOf(LocalDate.parse(raw.substring(0, 10)));
    }

    private Timestamp sqlTimestamp(Object value) {
        String raw = string(value);
        if (raw == null || raw.isBlank()) {
            return new Timestamp(System.currentTimeMillis());
        }
        return Timestamp.valueOf(LocalDateTime.parse(raw.replace("Z", "").substring(0, 19)));
    }

    private String json(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof String text) {
            return text;
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception ex) {
            return String.valueOf(value);
        }
    }

    private String extensionOf(String fileName) {
        int index = fileName.lastIndexOf('.');
        return index >= 0 ? fileName.substring(index) : "";
    }

    private String humanSize(long bytes) {
        if (bytes >= 1024 * 1024) {
            return String.format(Locale.ROOT, "%.1f MB", bytes / 1024.0 / 1024.0);
        }
        if (bytes >= 1024) {
            return String.format(Locale.ROOT, "%.1f KB", bytes / 1024.0);
        }
        return bytes + " B";
    }

    private byte[] readDocumentBytes(String src) throws Exception {
        String normalized = src.replace("\\", "/");
        if (normalized.startsWith("/")) {
            normalized = normalized.substring(1);
        }
        if (normalized.startsWith("upload/documents/")) {
            Path path = documentUploadDir.resolve(normalized.substring("upload/documents/".length())).normalize();
            if (!path.startsWith(documentUploadDir)) {
                throw new IllegalArgumentException("文档路径不合法");
            }
            return Files.readAllBytes(path);
        }
        if (normalized.startsWith("docs/")) {
            ClassPathResource resource = new ClassPathResource("static/" + normalized);
            if (!resource.exists()) {
                return createMissingDocument(normalized).getBytes(StandardCharsets.UTF_8);
            }
            try (InputStream inputStream = resource.getInputStream()) {
                return inputStream.readAllBytes();
            }
        }
        throw new IllegalArgumentException("仅支持系统内文档预览");
    }

    private String previewMode(String extension) {
        if (Set.of(".html", ".htm").contains(extension)) return "html";
        if (Set.of(".txt").contains(extension)) return "text";
        if (Set.of(".docx").contains(extension)) return "docx";
        if (Set.of(".xlsx").contains(extension)) return "xlsx";
        if (Set.of(".pdf", ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp").contains(extension)) return "embed";
        return "unsupported";
    }

    private String convertDocumentToHtml(byte[] content, String extension, String src) throws Exception {
        return switch (extension) {
            case ".html", ".htm" -> new String(content, StandardCharsets.UTF_8);
            case ".txt" -> "<pre>" + escapeHtml(new String(content, StandardCharsets.UTF_8)) + "</pre>";
            case ".docx" -> convertDocxToHtml(content);
            case ".xlsx" -> convertXlsxToHtml(content);
            case ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp" -> "";
            default -> """
                    <div class="preview-empty">
                        <h2>暂不支持自动转换该文件</h2>
                        <p>当前文档：%s</p>
                        <p>建议上传 docx、xlsx、txt、html、pdf 或图片格式。</p>
                    </div>
                    """.formatted(escapeHtml(src));
        };
    }

    private String convertDocxToHtml(byte[] content) throws Exception {
        String xml = readZipEntry(content, "word/document.xml");
        if (xml == null || xml.isBlank()) {
            throw new IllegalArgumentException("未读取到 docx 正文");
        }
        List<String> paragraphs = new ArrayList<>();
        Matcher paragraphMatcher = Pattern.compile("<w:p[\\s\\S]*?</w:p>").matcher(xml);
        while (paragraphMatcher.find()) {
            String paragraphXml = paragraphMatcher.group();
            Matcher textMatcher = Pattern.compile("<w:t[^>]*>([\\s\\S]*?)</w:t>").matcher(paragraphXml);
            StringBuilder paragraph = new StringBuilder();
            while (textMatcher.find()) {
                paragraph.append(unescapeXml(textMatcher.group(1)));
            }
            String text = paragraph.toString().trim();
            if (!text.isBlank()) {
                paragraphs.add("<p>" + escapeHtml(text) + "</p>");
            }
        }
        return paragraphs.isEmpty()
                ? "<div class=\"preview-empty\">该 docx 文档没有可转换的正文。</div>"
                : String.join("\n", paragraphs);
    }

    private String convertXlsxToHtml(byte[] content) throws Exception {
        List<String> sharedStrings = readSharedStrings(content);
        List<String> sheetNames = listZipEntries(content, "xl/worksheets/sheet", ".xml");
        if (sheetNames.isEmpty()) {
            throw new IllegalArgumentException("未读取到 xlsx 工作表");
        }
        StringBuilder html = new StringBuilder();
        int sheetIndex = 1;
        for (String sheetName : sheetNames) {
            String sheetXml = readZipEntry(content, sheetName);
            html.append("<h2>工作表 ").append(sheetIndex++).append("</h2><table class=\"preview-table\"><tbody>");
            Matcher rowMatcher = Pattern.compile("<row[^>]*>([\\s\\S]*?)</row>").matcher(sheetXml);
            while (rowMatcher.find()) {
                html.append("<tr>");
                Matcher cellMatcher = Pattern.compile("<c([^>]*)>[\\s\\S]*?<v>([\\s\\S]*?)</v>[\\s\\S]*?</c>").matcher(rowMatcher.group(1));
                while (cellMatcher.find()) {
                    String attrs = cellMatcher.group(1);
                    String value = unescapeXml(cellMatcher.group(2));
                    if (attrs.contains("t=\"s\"")) {
                        int index = Integer.parseInt(value);
                        value = index >= 0 && index < sharedStrings.size() ? sharedStrings.get(index) : value;
                    }
                    html.append("<td>").append(escapeHtml(value)).append("</td>");
                }
                html.append("</tr>");
            }
            html.append("</tbody></table>");
        }
        return html.toString();
    }

    private List<String> readSharedStrings(byte[] content) throws Exception {
        String xml = readZipEntry(content, "xl/sharedStrings.xml");
        if (xml == null) return List.of();
        List<String> result = new ArrayList<>();
        Matcher matcher = Pattern.compile("<si[\\s\\S]*?</si>").matcher(xml);
        while (matcher.find()) {
            Matcher textMatcher = Pattern.compile("<t[^>]*>([\\s\\S]*?)</t>").matcher(matcher.group());
            StringBuilder text = new StringBuilder();
            while (textMatcher.find()) {
                text.append(unescapeXml(textMatcher.group(1)));
            }
            result.add(text.toString());
        }
        return result;
    }

    private String readZipEntry(byte[] content, String entryName) throws Exception {
        try (ZipInputStream zip = new ZipInputStream(new java.io.ByteArrayInputStream(content))) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                if (entryName.equals(entry.getName())) {
                    ByteArrayOutputStream output = new ByteArrayOutputStream();
                    zip.transferTo(output);
                    return output.toString(StandardCharsets.UTF_8);
                }
            }
        }
        return null;
    }

    private List<String> listZipEntries(byte[] content, String prefix, String suffix) throws Exception {
        List<String> entries = new ArrayList<>();
        try (ZipInputStream zip = new ZipInputStream(new java.io.ByteArrayInputStream(content))) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                String name = entry.getName();
                if (name.startsWith(prefix) && name.endsWith(suffix)) {
                    entries.add(name);
                }
            }
        }
        entries.sort(Comparator.naturalOrder());
        return entries;
    }

    private String createMissingDocument(String src) {
        return """
                <div class="preview-empty">
                    <h2>示例文档未上传原文件</h2>
                    <p>系统已保留文档记录，但服务器中还没有对应原文件。</p>
                    <p>%s</p>
                </div>
                """.formatted(escapeHtml(src));
    }

    private String escapeHtml(String value) {
        return String.valueOf(value)
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    private String unescapeXml(String value) {
        return String.valueOf(value)
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&quot;", "\"")
                .replace("&apos;", "'")
                .replace("&amp;", "&");
    }
}

