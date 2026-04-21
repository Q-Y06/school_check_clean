package sc.school_check.infrastructure.persistence.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Param;
import sc.school_check.domain.model.Knowledge;

public interface KnowledgeMapper extends BaseMapper<Knowledge> {

    @Delete("DELETE FROM knowledge WHERE id = #{id}")
    int forceDeleteById(@Param("id") Long id);

    @Delete("DELETE FROM knowledge WHERE create_user_id = #{userId} OR creator_id = #{userId}")
    int forceDeleteByUserId(@Param("userId") Long userId);
}

