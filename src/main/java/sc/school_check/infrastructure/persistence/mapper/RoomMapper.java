package sc.school_check.infrastructure.persistence.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Param;
import sc.school_check.domain.model.Room;

public interface RoomMapper extends BaseMapper<Room> {

    @Delete("DELETE FROM room WHERE id = #{id}")
    int forceDeleteById(@Param("id") Long id);
}
