package sc.school_check.interfaces.rest;

import lombok.RequiredArgsConstructor;
import com.baomidou.mybatisplus.core.metadata.IPage;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import sc.school_check.domain.model.User;
import sc.school_check.shared.exception.BusinessException;
import sc.school_check.application.service.InspectionRecordService;
import sc.school_check.application.service.KnowledgeCommentService;
import sc.school_check.application.service.KnowledgeService;
import sc.school_check.application.service.ShiftScheduleService;
import sc.school_check.application.service.UserService;
import sc.school_check.shared.util.ResponseUtil;

@RequiredArgsConstructor
@RestController
@RequestMapping("/api/user")
public class UserController {
    private final UserService userService;
    private final PasswordEncoder passwordEncoder;
    private final InspectionRecordService inspectionRecordService;
    private final ShiftScheduleService shiftScheduleService;
    private final KnowledgeService knowledgeService;
    private final KnowledgeCommentService knowledgeCommentService;

    @GetMapping("/list")
    public ResponseUtil<IPage<User>> getUserList(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize) {
        IPage<User> userPage = userService.getUserPage(pageNum, pageSize);
        userPage.getRecords().forEach(user -> user.setPassword(null));
        return ResponseUtil.success(userPage);
    }

    @GetMapping("/{id}")
    public ResponseUtil<User> getUserById(@PathVariable Long id) {
        User user = userService.getById(id);
        if (user == null) {
            throw new BusinessException(404, "用户不存在");
        }
        user.setPassword(null);
        return ResponseUtil.success(user);
    }

    @PostMapping
    public ResponseUtil<?> addUser(@RequestBody User user) {
        if (isBlank(user.getEmployeeId())) {
            throw new BusinessException(400, "账号不能为空");
        }
        if (isBlank(user.getUsername())) {
            throw new BusinessException(400, "账号不能为空");
        }
        if (user.getEmployeeId().trim().length() < 6) {
            throw new BusinessException(400, "工号格式不正确");
        }
        if (isBlank(user.getPassword())) {
            throw new BusinessException(400, "密码不能为空");
        }

        String employeeId = user.getEmployeeId().trim();
        String username = user.getUsername().trim();
        userService.purgeDeletedConflicts(employeeId, username);

        User sameEmployeeId = userService.lambdaQuery().eq(User::getEmployeeId, employeeId).one();
        if (sameEmployeeId != null) {
            throw new BusinessException(400, "账号已存在");
        }

        User sameUsername = userService.getByUsername(username);
        if (sameUsername != null) {
            throw new BusinessException(400, "账号已存在");
        }

        if (isBlank(user.getRole())) {
            user.setRole("engineer");
        }
        if (user.getStatus() == null) {
            user.setStatus(1);
        }

        user.setEmployeeId(employeeId);
        user.setUsername(username);
        user.setPassword(passwordEncoder.encode(user.getPassword().trim()));

        if (userService.save(user)) {
            return ResponseUtil.success("用户新增成功");
        }
        throw new BusinessException(500, "用户新增失败");
    }

    @PutMapping
    public ResponseUtil<?> updateUser(@RequestBody User user) {
        if (user.getId() == null) {
            throw new BusinessException(400, "用户 ID 不能为空");
        }
        User existing = userService.getById(user.getId());
        if (existing == null) {
            throw new BusinessException(404, "用户不存在");
        }
        if (isBlank(user.getEmployeeId())) {
            throw new BusinessException(400, "账号不能为空");
        }
        if (isBlank(user.getUsername())) {
            throw new BusinessException(400, "账号不能为空");
        }
        if (user.getEmployeeId().trim().length() < 6) {
            throw new BusinessException(400, "工号格式不正确");
        }

        String employeeId = user.getEmployeeId().trim();
        String username = user.getUsername().trim();
        userService.purgeDeletedConflicts(employeeId, username);

        User sameEmployeeId = userService.lambdaQuery()
                .eq(User::getEmployeeId, employeeId)
                .ne(User::getId, user.getId())
                .one();
        if (sameEmployeeId != null) {
            throw new BusinessException(400, "账号已存在");
        }

        User sameUsername = userService.getByUsername(username);
        if (sameUsername != null && !sameUsername.getId().equals(user.getId())) {
            throw new BusinessException(400, "账号已存在");
        }

        existing.setEmployeeId(employeeId);
        existing.setUsername(username);
        existing.setFullName(user.getFullName());
        existing.setDepartment(user.getDepartment());
        existing.setEmail(user.getEmail());
        existing.setPhone(user.getPhone());
        existing.setRole(user.getRole());
        existing.setStatus(user.getStatus());
        if (!isBlank(user.getPassword())) {
            existing.setPassword(passwordEncoder.encode(user.getPassword().trim()));
        }

        if (userService.updateById(existing)) {
            return ResponseUtil.success("用户修改成功");
        }
        throw new BusinessException(500, "用户修改失败");
    }

    @PutMapping("/status/{id}")
    public ResponseUtil<?> updateUserStatus(@PathVariable Long id, @RequestParam Integer status) {
        if (status != 0 && status != 1 && status != 2) {
            throw new BusinessException(400, "状态值只能是 0(待审核)、1(正常)、2(禁用)");
        }
        User user = new User();
        user.setId(id);
        user.setStatus(status);
        if (userService.updateById(user)) {
            String msg = status == 1 ? "审核通过" : (status == 2 ? "禁用成功" : "状态已改为待审核");
            return ResponseUtil.success(msg);
        }
        throw new BusinessException(500, "状态修改失败");
    }

    @DeleteMapping("/{id}")
    @Transactional(rollbackFor = Exception.class)
    public ResponseUtil<?> deleteUser(@PathVariable Long id) {
        User user = userService.getById(id);
        if (user == null) {
            throw new BusinessException(404, "用户不存在");
        }
        inspectionRecordService.forceDeleteByUserId(id);
        shiftScheduleService.forceDeleteByUserId(id);
        knowledgeCommentService.forceDeleteByUserId(id);
        knowledgeService.forceDeleteByUserId(id);
        if (userService.forceDeleteById(id)) {
            return ResponseUtil.success("用户及关联数据删除成功");
        }
        throw new BusinessException(500, "删除失败");
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}

