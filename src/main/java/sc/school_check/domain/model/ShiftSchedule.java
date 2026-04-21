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
@TableName("shift_schedule")
public class ShiftSchedule {
    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("schedule_date")
    private Date scheduleDate;

    private Long userId;
    private String userName;
    private Long roomId;
    private String roomName;
    private String shiftType;
    private String notes;

    @TableField(fill = FieldFill.INSERT)
    private Date createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private Date updateTime;

    @TableLogic
    private Integer isDeleted;
}

