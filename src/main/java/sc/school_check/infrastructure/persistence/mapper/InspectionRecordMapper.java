package sc.school_check.infrastructure.persistence.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Param;
import sc.school_check.domain.model.InspectionRecord;

public interface InspectionRecordMapper extends BaseMapper<InspectionRecord> {

    @Delete("DELETE FROM inspection_record WHERE id = #{id}")
    int forceDeleteById(@Param("id") Long id);

    @Delete("DELETE FROM inspection_record WHERE room_id = #{roomId}")
    int forceDeleteByRoomId(@Param("roomId") Long roomId);

    @Delete("DELETE FROM inspection_record WHERE user_id = #{userId}")
    int forceDeleteByUserId(@Param("userId") Long userId);
}
