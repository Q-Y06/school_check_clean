package sc.school_check.application.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.IService;
import sc.school_check.domain.model.KnowledgeComment;

import java.util.List;
import java.util.Map;

public interface KnowledgeCommentService extends IService<KnowledgeComment> {

    IPage<KnowledgeComment> getCommentPage(Long knowledgeId, Integer pageNum, Integer pageSize);

    Map<Long, Long> countByKnowledgeIds(List<Long> knowledgeIds);

    void forceDeleteByKnowledgeId(Long knowledgeId);

    void forceDeleteByUserId(Long userId);
}
