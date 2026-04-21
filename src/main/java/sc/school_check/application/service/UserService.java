package sc.school_check.application.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.IService;
import sc.school_check.domain.model.User;

public interface UserService extends IService<User> {

    User getByUsername(String username);

    IPage<User> getUserPage(Integer pageNum, Integer pageSize);

    boolean forceDeleteById(Long id);

    void purgeDeletedConflicts(String employeeId, String username);
}
