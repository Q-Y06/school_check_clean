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
@TableName("inspection_record")
public class InspectionRecord {
    @TableId(type = IdType.AUTO)
    private Long id;

    private Long roomId;
    private String roomName;

    private Long userId;
    private String userName;

    private String status;
    private String notes;
    private String richContent;
    private String images;

    // Legacy column kept for compatibility
    @TableField("inspection_time")
    private Date inspectionTime;

    // Required columns in current table schema
    @TableField("inspector_id")
    private Long inspectorId;

    @TableField("inspector_name")
    private String inspectorName;

    @TableField("inspect_time")
    private Date inspectTime;

    @TableField(fill = FieldFill.INSERT)
    private Date createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private Date updateTime;

    @TableLogic
    private Integer isDeleted;
}

