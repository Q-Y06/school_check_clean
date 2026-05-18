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
    private static final Duration SESSION_IDLE_TIMEOUT = Duration.ofMinutes(5);

    private final RedisTemplate<String, Object> redisTemplate;
    private final JwtUtil jwtUtil;
    private final Map<String, FallbackSession> fallbackSessions = new ConcurrentHashMap<>();

    @Override
    public boolean hasActiveSession(String username) {
        String key = key(username);
        try {
            return Boolean.TRUE.equals(redisTemplate.hasKey(key));
        } catch (RuntimeException ex) {
            return getFallbackSession(key) != null;
        }
    }

    @Override
    public void registerLogin(String username, String token) {
        String key = key(username);
        String tokenHash = hash(token);
        try {
            redisTemplate.opsForValue().set(key, tokenHash, sessionTimeout());
        } catch (RuntimeException ex) {
            fallbackSessions.put(key, new FallbackSession(tokenHash, nextExpiryTime()));
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
            FallbackSession session = getFallbackSession(key);
            return session != null && tokenHash.equals(session.tokenHash);
        }
    }

    @Override
    public boolean touchSession(String username, String token) {
        String key = key(username);
        String tokenHash = hash(token);
        try {
            Object activeTokenHash = redisTemplate.opsForValue().get(key);
            if (!tokenHash.equals(activeTokenHash)) {
                return false;
            }
            redisTemplate.expire(key, sessionTimeout());
            return true;
        } catch (RuntimeException ex) {
            FallbackSession session = getFallbackSession(key);
            if (session == null || !tokenHash.equals(session.tokenHash)) {
                return false;
            }
            session.expiresAt = nextExpiryTime();
            fallbackSessions.put(key, session);
            return true;
        }
    }

    @Override
    public void logout(String username, String token) {
        String key = key(username);
        String tokenHash = hash(token);
        try {
            Object activeTokenHash = redisTemplate.opsForValue().get(key);
            if (!tokenHash.equals(activeTokenHash)) {
                return;
            }
            redisTemplate.delete(key);
        } catch (RuntimeException ex) {
            FallbackSession session = getFallbackSession(key);
            if (session != null && tokenHash.equals(session.tokenHash)) {
                fallbackSessions.remove(key);
            }
        }
    }

    private String key(String username) {
        return SESSION_KEY_PREFIX + (username == null ? "" : username.trim());
    }

    private Duration sessionTimeout() {
        return Duration.ofMillis(Math.min(jwtUtil.getExpirationTimeMillis(), SESSION_IDLE_TIMEOUT.toMillis()));
    }

    private long nextExpiryTime() {
        return System.currentTimeMillis() + sessionTimeout().toMillis();
    }

    private FallbackSession getFallbackSession(String key) {
        FallbackSession session = fallbackSessions.get(key);
        if (session == null) {
            return null;
        }
        if (session.expiresAt <= System.currentTimeMillis()) {
            fallbackSessions.remove(key);
            return null;
        }
        return session;
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

    private static final class FallbackSession {
        private final String tokenHash;
        private volatile long expiresAt;

        private FallbackSession(String tokenHash, long expiresAt) {
            this.tokenHash = tokenHash;
            this.expiresAt = expiresAt;
        }
    }
}
