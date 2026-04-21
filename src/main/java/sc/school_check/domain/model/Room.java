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
@TableName("room")
public class Room {
    /** 主键ID。 */
    @TableId(type = IdType.AUTO)
    private Long id;

    /** 机房名称。 */
    private String name;

    /** 机房类型：普通机房、UPS机房、核心机房。 */
    private String type;

    /** 机房位置。 */
    private String location;

    /** 机房状态：unchecked、normal、warning、error。 */
    private String status;

    /** 巡检指南或注意事项。 */
    private String guideContent;

    /** 负责人ID。 */
    private Long managerId;

    /** 负责人姓名。 */
    private String managerName;

    /** 创建时间。 */
    @TableField(fill = FieldFill.INSERT)
    private Date createTime;

    /** 更新时间。 */
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private Date updateTime;

    /** 逻辑删除标记。 */
    @TableLogic
    private Integer isDeleted;
}