package sc.school_check.interfaces.rest;

import lombok.RequiredArgsConstructor;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import sc.school_check.domain.model.User;
import sc.school_check.shared.exception.BusinessException;
import sc.school_check.application.service.UserService;
import sc.school_check.shared.util.JwtUtil;
import sc.school_check.shared.util.ResponseUtil;

import java.util.HashMap;
import java.util.Map;

@RequiredArgsConstructor
@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final UserService userService;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    @PostMapping("/register")
    public ResponseUtil<?> register(@RequestBody User user) {
        if (isBlank(user.getEmployeeId())) {
            throw new BusinessException(400, "账号不能为空");
        }
        if (isBlank(user.getUsername())) {
            throw new BusinessException(400, "账号不能为空");
        }
        if (isBlank(user.getPassword())) {
            throw new BusinessException(400, "密码不能为空");
        }

        String employeeId = user.getEmployeeId().trim();
        String username = user.getUsername().trim();

        userService.purgeDeletedConflicts(employeeId, username);

        User existEmployeeId = userService.getOne(new LambdaQueryWrapper<User>()
                .eq(User::getEmployeeId, employeeId));
        if (existEmployeeId != null) {
            throw new BusinessException(400, "工号已存在");
        }

        User existUser = userService.getByUsername(username);
        if (existUser != null) {
            throw new BusinessException(400, "账号已存在");
        }

        user.setEmployeeId(employeeId);
        user.setUsername(username);
        user.setPassword(passwordEncoder.encode(user.getPassword().trim()));
        user.setStatus(0);
        user.setRole("engineer");

        if (userService.save(user)) {
            return ResponseUtil.success("注册成功，请等待管理员审核");
        }
        throw new BusinessException(500, "注册失败");
    }

    @PostMapping("/login")
    public ResponseUtil<?> login(@RequestBody Map<String, String> loginParam) {
        String username = loginParam.get("username");
        String password = loginParam.get("password");

        if (isBlank(username) || isBlank(password)) {
            throw new BusinessException(400, "账号和密码不能为空");
        }

        User user = userService.getByUsername(username.trim());
        if (user == null) {
            throw new BusinessException(404, "用户未注册");
        }

        if (!matchesPassword(password.trim(), user)) {
            throw new BusinessException(401, "密码错误");
        }

        if (user.getStatus() != 1) {
            throw new BusinessException(401, "账号未审核或已禁用");
        }

        String token = jwtUtil.generateToken(user.getId(), user.getUsername(), user.getRole());

        Map<String, Object> userInfo = new HashMap<>();
        userInfo.put("userId", user.getId());
        userInfo.put("username", user.getUsername());
        userInfo.put("fullName", user.getFullName());
        userInfo.put("name", user.getFullName());
        userInfo.put("department", user.getDepartment());
        userInfo.put("employeeId", user.getEmployeeId());
        userInfo.put("email", user.getEmail());
        userInfo.put("phone", user.getPhone());
        userInfo.put("role", user.getRole());
        userInfo.put("status", user.getStatus());
        userInfo.put("token", token);

        return ResponseUtil.success(userInfo);
    }

    @GetMapping("/me")
    public ResponseUtil<?> me(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new BusinessException(401, "未登录");
        }

        User user = userService.getByUsername(authentication.getName());
        if (user == null) {
            throw new BusinessException(404, "用户不存在");
        }

        Map<String, Object> userInfo = new HashMap<>();
        userInfo.put("userId", user.getId());
        userInfo.put("username", user.getUsername());
        userInfo.put("employeeId", user.getEmployeeId());
        userInfo.put("fullName", user.getFullName());
        userInfo.put("role", user.getRole());
        userInfo.put("status", user.getStatus());
        return ResponseUtil.success(userInfo);
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private boolean matchesPassword(String rawPassword, User user) {
        String storedPassword = user.getPassword();
        if (storedPassword == null) {
            return false;
        }
        if (storedPassword.startsWith("$2a$") || storedPassword.startsWith("$2b$") || storedPassword.startsWith("$2y$")) {
            return passwordEncoder.matches(rawPassword, storedPassword);
        }
        if (rawPassword.equals(storedPassword)) {
            user.setPassword(passwordEncoder.encode(rawPassword));
            userService.updateById(user);
            return true;
        }
        return false;
    }
}
