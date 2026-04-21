package sc.school_check.infrastructure.persistence.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import sc.school_check.domain.model.KnowledgeComment;

import java.util.List;
import java.util.Map;

public interface KnowledgeCommentMapper extends BaseMapper<KnowledgeComment> {

    @Delete("DELETE FROM knowledge_comment WHERE knowledge_id = #{knowledgeId}")
    int forceDeleteByKnowledgeId(@Param("knowledgeId") Long knowledgeId);

    @Delete("DELETE FROM knowledge_comment WHERE user_id = #{userId}")
    int forceDeleteByUserId(@Param("userId") Long userId);

    @Select({
            "<script>",
            "SELECT knowledge_id AS knowledgeId, COUNT(*) AS commentCount ",
            "FROM knowledge_comment ",
            "WHERE is_deleted = 0 AND knowledge_id IN ",
            "<foreach collection='knowledgeIds' item='id' open='(' separator=',' close=')'>",
            "#{id}",
            "</foreach>",
            "GROUP BY knowledge_id",
            "</script>"
    })
    List<Map<String, Object>> countByKnowledgeIds(@Param("knowledgeIds") List<Long> knowledgeIds);
}

