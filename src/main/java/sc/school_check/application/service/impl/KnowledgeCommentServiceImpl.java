package sc.school_check.application.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;
import sc.school_check.domain.model.KnowledgeComment;
import sc.school_check.infrastructure.persistence.mapper.KnowledgeCommentMapper;
import sc.school_check.application.service.KnowledgeCommentService;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class KnowledgeCommentServiceImpl extends ServiceImpl<KnowledgeCommentMapper, KnowledgeComment> implements KnowledgeCommentService {

    @Override
    public IPage<KnowledgeComment> getCommentPage(Long knowledgeId, Integer pageNum, Integer pageSize) {
        Page<KnowledgeComment> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<KnowledgeComment> wrapper = new LambdaQueryWrapper<KnowledgeComment>()
                .eq(KnowledgeComment::getKnowledgeId, knowledgeId)
                .orderByDesc(KnowledgeComment::getPinned)
                .orderByDesc(KnowledgeComment::getFeatured)
                .orderByDesc(KnowledgeComment::getCreateTime);
        return this.baseMapper.selectPage(page, wrapper);
    }

    @Override
    public Map<Long, Long> countByKnowledgeIds(List<Long> knowledgeIds) {
        if (knowledgeIds == null || knowledgeIds.isEmpty()) {
            return Collections.emptyMap();
        }
        Map<Long, Long> result = new HashMap<>();
        this.baseMapper.countByKnowledgeIds(knowledgeIds).forEach(row -> {
            Object knowledgeId = row.get("knowledgeId");
            Object commentCount = row.get("commentCount");
            if (knowledgeId != null && commentCount != null) {
                result.put(Long.valueOf(String.valueOf(knowledgeId)), Long.valueOf(String.valueOf(commentCount)));
            }
        });
        return result;
    }

    @Override
    public void forceDeleteByKnowledgeId(Long knowledgeId) {
        this.baseMapper.forceDeleteByKnowledgeId(knowledgeId);
    }

    @Override
    public void forceDeleteByUserId(Long userId) {
        this.baseMapper.forceDeleteByUserId(userId);
    }
}
