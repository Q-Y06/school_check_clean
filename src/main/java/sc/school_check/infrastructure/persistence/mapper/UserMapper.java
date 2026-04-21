package sc.school_check.infrastructure.persistence.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Param;
import sc.school_check.domain.model.User;

public interface UserMapper extends BaseMapper<User> {

    @Delete("DELETE FROM sys_user WHERE id = #{id}")
    int forceDeleteById(@Param("id") Long id);

    @Delete("DELETE FROM sys_user WHERE is_deleted = 1 AND (username = #{username} OR employee_id = #{employeeId})")
    int deleteDeletedConflicts(@Param("employeeId") String employeeId, @Param("username") String username);
}
