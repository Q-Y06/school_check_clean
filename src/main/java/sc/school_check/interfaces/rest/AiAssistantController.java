package sc.school_check.interfaces.rest;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ai")
public class AiAssistantController {

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final JdbcTemplate jdbcTemplate;

    @Value("${ai.assistant.api-key:}")
    private String apiKey;

    @Value("${ai.assistant.api-url:}")
    private String apiUrl;

    @Value("${ai.assistant.model:}")
    private String model;

    public AiAssistantController(ObjectMapper objectMapper, JdbcTemplate jdbcTemplate) {
        this.objectMapper = objectMapper;
        this.jdbcTemplate = jdbcTemplate;
        this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    }

    @GetMapping("/settings")
    public Map<String, Object> settings() {
        AiRuntimeConfig config = readDefaultConfig();
        return Map.of(
                "configured", hasCompleteConfig(config),
                "apiUrl", config.apiUrl(),
                "model", config.model(),
                "apiKeyMasked", maskKey(config.apiKey())
        );
    }

    @PostMapping("/settings")
    public ResponseEntity<Map<String, Object>> saveSettings(@RequestBody(required = false) AiSettingsRequest request) {
        AiRuntimeConfig current = readDefaultConfig();
        String nextKey = request != null && StringUtils.hasText(request.apiKey()) ? request.apiKey().trim() : current.apiKey();
        String nextUrl = request != null && StringUtils.hasText(request.apiUrl()) ? normalizeApiUrl(request.apiUrl()) : current.apiUrl();
        String nextModel = request != null && StringUtils.hasText(request.model()) ? normalizeModel(request.model()) : current.model();
        AiRuntimeConfig nextConfig = new AiRuntimeConfig(nextKey, nextUrl, nextModel);
        AiValidationResult validation = validateRuntimeConfig(nextConfig);
        if (!validation.valid()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                    "configured", false,
                    "valid", false,
                    "message", validation.message()
            ));
        }
        jdbcTemplate.update("""
                INSERT INTO ncic_ai_setting (id, api_key, api_url, model)
                VALUES ('default', ?, ?, ?)
                ON DUPLICATE KEY UPDATE api_key = VALUES(api_key), api_url = VALUES(api_url), model = VALUES(model)
                """, nextKey, nextUrl, nextModel);
        return ResponseEntity.ok(Map.of(
                "configured", true,
                "valid", true,
                "message", "AI 配置保存成功",
                "apiUrl", nextUrl,
                "model", nextModel,
                "apiKeyMasked", maskKey(nextKey)
        ));
    }

    @PostMapping("/validate")
    public ResponseEntity<Map<String, Object>> validateSettings(@RequestBody(required = false) AiSettingsRequest request) {
        AiRuntimeConfig current = readDefaultConfig();
        AiRuntimeConfig config = new AiRuntimeConfig(
                request != null && StringUtils.hasText(request.apiKey()) ? request.apiKey().trim() : current.apiKey(),
                request != null && StringUtils.hasText(request.apiUrl()) ? normalizeApiUrl(request.apiUrl()) : current.apiUrl(),
                request != null && StringUtils.hasText(request.model()) ? normalizeModel(request.model()) : current.model()
        );
        AiValidationResult validation = validateRuntimeConfig(config);
        return ResponseEntity.status(validation.valid() ? HttpStatus.OK : HttpStatus.BAD_REQUEST).body(Map.of(
                "valid", validation.valid(),
                "configured", hasCompleteConfig(config),
                "message", validation.message(),
                "apiKeyMasked", maskKey(config.apiKey()),
                "apiUrl", config.apiUrl(),
                "model", config.model()
        ));
    }

    @PostMapping("/chat")
    public ResponseEntity<Map<String, Object>> chat(@RequestBody AiChatRequest request) {
        if (request == null || !StringUtils.hasText(request.question())) {
            return ResponseEntity.badRequest().body(Map.of("configured", true, "answer", "请输入要咨询的问题。"));
        }
        AiRuntimeConfig runtimeConfig = resolveRuntimeConfig(request);
        if (!hasCompleteConfig(runtimeConfig)) {
            return ResponseEntity.ok(Map.of("configured", false, "answer", "AI 尚未配置，请先在后台系统设置或小巡 AI 设置中填写 API Key、接口地址和模型。"));
        }
        try {
            Map<String, Object> payload = buildOpenAiCompatiblePayload(request, runtimeConfig.model());
            HttpRequest httpRequest = HttpRequest.newBuilder(URI.create(runtimeConfig.apiUrl()))
                    .timeout(Duration.ofSeconds(45))
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + runtimeConfig.apiKey())
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload)))
                    .build();
            HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of(
                        "configured", true,
                        "answer", formatRemoteFailure(response.statusCode(), response.body(), "AI 调用失败")
                ));
            }
            String answer = extractAnswer(response.body());
            return ResponseEntity.ok(Map.of(
                    "configured", true,
                    "answer", StringUtils.hasText(answer) ? answer : "AI 已返回结果，但没有可展示的文本内容。"
            ));
        } catch (IllegalArgumentException error) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("configured", true, "answer", "AI 接口地址不合法，请使用 http 或 https 地址。"));
        } catch (Exception error) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of("configured", true, "answer", "AI 连接异常，请检查接口地址、模型和网络。" + summarizeException(error)));
        }
    }

    private AiRuntimeConfig resolveRuntimeConfig(AiChatRequest request) {
        if (request != null && "custom".equals(request.aiMode())) {
            return new AiRuntimeConfig(clean(request.apiKey()), normalizeApiUrl(request.apiUrl()), normalizeModel(request.model()));
        }
        return readDefaultConfig();
    }

    private AiRuntimeConfig readDefaultConfig() {
        try {
            Map<String, Object> row = jdbcTemplate.queryForMap("""
                    SELECT api_key, api_url, model
                    FROM ncic_ai_setting
                    WHERE id = 'default'
                    """);
            String dbKey = text(row.get("api_key"));
            String dbUrl = text(row.get("api_url"));
            String dbModel = text(row.get("model"));
            return new AiRuntimeConfig(
                    StringUtils.hasText(dbKey) ? dbKey : clean(apiKey),
                    StringUtils.hasText(dbUrl) ? normalizeApiUrl(dbUrl) : normalizeApiUrl(apiUrl),
                    StringUtils.hasText(dbModel) ? normalizeModel(dbModel) : normalizeModel(model)
            );
        } catch (Exception error) {
            return new AiRuntimeConfig(clean(apiKey), normalizeApiUrl(apiUrl), normalizeModel(model));
        }
    }

    private Map<String, Object> buildOpenAiCompatiblePayload(AiChatRequest request, String activeModel) {
        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content", "你是西南石油大学数据中心巡检管理系统的小巡助手。回答要结合巡检、告警、值班、设备文档和故障知识库上下文，给出可执行步骤。"));
        if (request.context() != null && !request.context().isEmpty()) {
            messages.add(Map.of("role", "system", "content", "系统上下文：" + request.context()));
        }
        if (request.history() != null) {
            request.history().stream()
                    .filter(item -> item != null && StringUtils.hasText(item.role()) && StringUtils.hasText(item.content()))
                    .limit(8)
                    .forEach(item -> messages.add(Map.of("role", item.role(), "content", item.content())));
        }
        messages.add(Map.of("role", "user", "content", request.question()));
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", activeModel);
        payload.put("messages", messages);
        payload.put("temperature", 0.3);
        return payload;
    }

    private AiValidationResult validateRuntimeConfig(AiRuntimeConfig config) {
        if (!hasCompleteConfig(config)) {
            return new AiValidationResult(false, "请填写 AI API Key、接口地址和模型。");
        }
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("model", config.model());
            payload.put("messages", List.of(Map.of("role", "user", "content", "请回复 OK")));
            payload.put("temperature", 0);
            HttpRequest httpRequest = HttpRequest.newBuilder(URI.create(config.apiUrl()))
                    .timeout(Duration.ofSeconds(20))
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + config.apiKey())
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload)))
                    .build();
            HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                return new AiValidationResult(false, formatRemoteFailure(response.statusCode(), response.body(), "AI 接口校验失败"));
            }
            if (!StringUtils.hasText(extractAnswer(response.body()))) {
                return new AiValidationResult(false, "AI 接口已响应，但返回格式不是兼容的 Chat Completions 结构。");
            }
            return new AiValidationResult(true, "AI 配置可用");
        } catch (IllegalArgumentException error) {
            return new AiValidationResult(false, "AI 接口地址不合法，请使用 http 或 https 地址。");
        } catch (Exception error) {
            return new AiValidationResult(false, "AI 接口校验失败，请检查网络、接口地址、模型和 API Key。" + summarizeException(error));
        }
    }

    private boolean hasCompleteConfig(AiRuntimeConfig config) {
        return config != null && StringUtils.hasText(config.apiKey()) && StringUtils.hasText(config.apiUrl()) && StringUtils.hasText(config.model());
    }

    private String clean(String value) {
        return value == null ? "" : value.trim();
    }

    private String normalizeApiUrl(String value) {
        String url = clean(value);
        while (url.endsWith("/")) {
            url = url.substring(0, url.length() - 1);
        }
        if (url.endsWith("/api/paas/v4") || "https://api.deepseek.com".equalsIgnoreCase(url)) {
            return url + "/chat/completions";
        }
        return url;
    }
    private String normalizeModel(String value) {
        String activeModel = clean(value);
        if ("glm-4.6v".equalsIgnoreCase(activeModel) || "gim-4.7".equalsIgnoreCase(activeModel)) {
            return "glm-4.6";
        }
        if ("deepseek-v3".equalsIgnoreCase(activeModel) || "DeepSeek-V3".equals(activeModel)) {
            return "deepseek-chat";
        }
        if ("deepseek-r1".equalsIgnoreCase(activeModel) || "DeepSeek-R1".equals(activeModel)) {
            return "deepseek-reasoner";
        }
        return activeModel;
    }
    private String text(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private String maskKey(String value) {
        if (!StringUtils.hasText(value)) {
            return "";
        }
        String trimmed = value.trim();
        if (trimmed.length() <= 10) {
            return "****";
        }
        return trimmed.substring(0, 6) + "..." + trimmed.substring(trimmed.length() - 4);
    }

    private String formatRemoteFailure(int statusCode, String body, String fallback) {
        String reason = extractRemoteReason(body);
        String compact = (body == null ? "" : body).toLowerCase();
        if (statusCode == 402 || compact.contains("insufficient balance") || compact.contains("insufficient_balance")) {
            return "AI 账号余额不足，请充值或更换 API Key。";
        }
        if (statusCode == 401 || statusCode == 403 || compact.contains("invalid api key") || compact.contains("unauthorized")) {
            return "AI API Key 无效或无权限，请检查后重新保存。";
        }
        if (statusCode == 404) {
            return "AI 接口地址或模型名称不正确，请检查接口地址和模型。";
        }
        if (statusCode == 429 || compact.contains("rate limit")) {
            return "AI 调用过于频繁，请稍后再试。";
        }
        return StringUtils.hasText(reason) ? fallback + "：" + reason : fallback + "，请检查接口地址、模型和 API Key。";
    }

    private String extractRemoteReason(String body) {
        if (!StringUtils.hasText(body)) {
            return "";
        }
        try {
            JsonNode root = objectMapper.readTree(body);
            JsonNode message = root.path("error").path("message");
            if (message.isTextual() && StringUtils.hasText(message.asText())) {
                return message.asText();
            }
            JsonNode msg = root.path("msg");
            if (msg.isTextual() && StringUtils.hasText(msg.asText())) {
                return msg.asText();
            }
            JsonNode error = root.path("error");
            if (error.isTextual() && StringUtils.hasText(error.asText())) {
                return error.asText();
            }
        } catch (Exception ignored) {
            // Use compact plain text below.
        }
        String compact = body.replaceAll("\\s+", " ").trim();
        return compact.length() > 120 ? compact.substring(0, 120) + "..." : compact;
    }
    private String summarizeException(Exception error) {
        if (error == null || !StringUtils.hasText(error.getMessage())) {
            return "";
        }
        String message = error.getMessage().replaceAll("\\s+", " ").trim();
        return message.length() > 120 ? " 原因：" + message.substring(0, 120) + "..." : " 原因：" + message;
    }

    private String extractAnswer(String responseBody) throws Exception {
        JsonNode root = objectMapper.readTree(responseBody);
        JsonNode content = root.path("choices").path(0).path("message").path("content");
        if (content.isTextual()) {
            return content.asText();
        }
        JsonNode text = root.path("choices").path(0).path("text");
        return text.isTextual() ? text.asText() : "";
    }

    public record AiChatRequest(String question, Map<String, Object> context, List<AiChatMessage> history,
                                String aiMode, String apiKey, String apiUrl, String model) {
    }

    public record AiChatMessage(String role, String content) {
    }

    public record AiSettingsRequest(String apiKey, String apiUrl, String model) {
    }

    private record AiRuntimeConfig(String apiKey, String apiUrl, String model) {
    }

    private record AiValidationResult(boolean valid, String message) {
    }
}
