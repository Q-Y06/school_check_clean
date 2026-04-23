package sc.school_check.application.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import sc.school_check.application.service.UserSessionService;
import sc.school_check.shared.util.JwtUtil;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
public class UserSessionServiceImpl implements UserSessionService {

    private static final String SESSION_KEY_PREFIX = "school_check:login:";

    private final RedisTemplate<String, Object> redisTemplate;
    private final JwtUtil jwtUtil;
    private final Map<String, String> fallbackSessions = new ConcurrentHashMap<>();

    @Override
    public boolean hasActiveSession(String username) {
        String key = key(username);
        try {
            return Boolean.TRUE.equals(redisTemplate.hasKey(key));
        } catch (RuntimeException ex) {
            return fallbackSessions.containsKey(key);
        }
    }

    @Override
    public void registerLogin(String username, String token) {
        String key = key(username);
        String tokenHash = hash(token);
        try {
            redisTemplate.opsForValue().set(key, tokenHash, Duration.ofMillis(jwtUtil.getExpirationTimeMillis()));
        } catch (RuntimeException ex) {
            fallbackSessions.put(key, tokenHash);
        }
    }

    @Override
    public boolean isTokenActive(String username, String token) {
        String key = key(username);
        String tokenHash = hash(token);
        try {
            Object activeTokenHash = redisTemplate.opsForValue().get(key);
            return tokenHash.equals(activeTokenHash);
        } catch (RuntimeException ex) {
            return tokenHash.equals(fallbackSessions.get(key));
        }
    }

    @Override
    public void logout(String username, String token) {
        String key = key(username);
        if (!isTokenActive(username, token)) {
            return;
        }
        try {
            redisTemplate.delete(key);
        } catch (RuntimeException ex) {
            fallbackSessions.remove(key);
        }
    }

    private String key(String username) {
        return SESSION_KEY_PREFIX + (username == null ? "" : username.trim());
    }

    private String hash(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] encoded = digest.digest((token == null ? "" : token).getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder(encoded.length * 2);
            for (byte value : encoded) {
                builder.append(String.format("%02x", value));
            }
            return builder.toString();
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is unavailable", ex);
        }
    }
}
