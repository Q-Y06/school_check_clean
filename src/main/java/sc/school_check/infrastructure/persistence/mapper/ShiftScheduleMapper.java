package sc.school_check.infrastructure.persistence.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Param;
import sc.school_check.domain.model.ShiftSchedule;

public interface ShiftScheduleMapper extends BaseMapper<ShiftSchedule> {

    @Delete("DELETE FROM shift_schedule WHERE id = #{id}")
    int forceDeleteById(@Param("id") Long id);

    @Delete("DELETE FROM shift_schedule WHERE room_id = #{roomId}")
    int forceDeleteByRoomId(@Param("roomId") Long roomId);

    @Delete("DELETE FROM shift_schedule WHERE user_id = #{userId}")
    int forceDeleteByUserId(@Param("userId") Long userId);
}
