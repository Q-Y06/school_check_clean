package sc.school_check.application.service;

public interface UserSessionService {

    boolean hasActiveSession(String username);

    void registerLogin(String username, String token);

    boolean isTokenActive(String username, String token);

    void logout(String username, String token);
}
