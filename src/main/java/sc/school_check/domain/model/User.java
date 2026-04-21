package sc.school_check.domain.model;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.util.Date;

@Data
@TableName("sys_user")
public class User {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 登录账号，唯一。 */
    @TableField("username")
    private String username;

    /** 加密后的密码。 */
    private String password;

    /** 真实姓名。 */
    private String fullName;

    /** 所属部门。 */
    private String department;

    /** 工号或学号。 */
    private String employeeId;

    /** 邮箱。 */
    private String email;

    /** 手机号。 */
    private String phone;

    /** 角色：admin / engineer / viewer。 */
    private String role;

    /** 账号状态：0-待审核，1-正常，2-禁用。 */
    private Integer status;

    /** 创建时间，由 MyBatis Plus 自动填充。 */
    @TableField(fill = FieldFill.INSERT)
    private Date createTime;

    /** 更新时间，由 MyBatis Plus 自动填充。 */
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private Date updateTime;

    /** 逻辑删除标记：0-未删除，1-已删除。 */
    @TableLogic
    private Integer isDeleted;
}