package sc.school_check.application.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;
import sc.school_check.domain.model.User;
import sc.school_check.infrastructure.persistence.mapper.UserMapper;
import sc.school_check.application.service.UserService;

@Service
public class UserServiceImpl extends ServiceImpl<UserMapper, User> implements UserService {

    @Override
    public User getByUsername(String username) {
        LambdaQueryWrapper<User> wrapper = new LambdaQueryWrapper<User>()
                .eq(User::getUsername, username);
        return this.baseMapper.selectOne(wrapper);
    }

    @Override
    public IPage<User> getUserPage(Integer pageNum, Integer pageSize) {
        Page<User> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<User> wrapper = new LambdaQueryWrapper<User>()
                .orderByDesc(User::getCreateTime);
        return this.baseMapper.selectPage(page, wrapper);
    }

    @Override
    public boolean forceDeleteById(Long id) {
        return this.baseMapper.forceDeleteById(id) > 0;
    }

    @Override
    public void purgeDeletedConflicts(String employeeId, String username) {
        String normalizedEmployeeId = employeeId == null ? "" : employeeId.trim();
        String normalizedUsername = username == null ? "" : username.trim();
        if (normalizedEmployeeId.isEmpty() && normalizedUsername.isEmpty()) {
            return;
        }
        this.baseMapper.deleteDeletedConflicts(normalizedEmployeeId, normalizedUsername);
    }
}
