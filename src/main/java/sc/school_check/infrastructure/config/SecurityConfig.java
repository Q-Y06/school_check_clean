package sc.school_check.infrastructure.config;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import java.nio.charset.StandardCharsets;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .httpBasic(basic -> basic.disable())
                .headers(headers -> headers.frameOptions(frame -> frame.sameOrigin()))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((request, response, authException) ->
                                writeJson(response, HttpServletResponse.SC_UNAUTHORIZED, "未登录或登录已过期"))
                        .accessDeniedHandler((request, response, accessDeniedException) ->
                                writeJson(response, HttpServletResponse.SC_FORBIDDEN, "没有访问权限"))
                )
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(
                                "/",
                                "/index.html",
                                "/login.html",
                                "/register.html",
                                "/detail.html",
                                "/admin.html",
                                "/document-viewer.html",
                                "/docs/**",
                                "/css/**",
                                "/js/**",
                                "/upload/**"
                        ).permitAll()
                        .requestMatchers("/api/auth/login", "/api/auth/register").permitAll()
                        .requestMatchers("/api/ncic/**").permitAll()
                        .requestMatchers("/api/ai/**").permitAll()
                        .requestMatchers("/api/auth/me").authenticated()
                        .requestMatchers("/api/user/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/room/**").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/room/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/room/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/room/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/knowledge/**").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/knowledge/**").authenticated()
                        .requestMatchers(HttpMethod.PUT, "/api/knowledge/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/knowledge/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/inspection/**").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/inspection/**").hasAnyRole("ADMIN", "ENGINEER")
                        .requestMatchers("/api/**").authenticated()
                        .anyRequest().permitAll()
                )
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    private void writeJson(HttpServletResponse response, int httpCode, String message) throws java.io.IOException {
        response.setStatus(httpCode);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        String json = String.format("{\"code\":%d,\"msg\":\"%s\",\"data\":null}", httpCode, message);
        response.getWriter().write(json);
    }
}

