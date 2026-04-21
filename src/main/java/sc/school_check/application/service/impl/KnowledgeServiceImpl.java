package sc.school_check.application.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;
import sc.school_check.domain.model.Knowledge;
import sc.school_check.infrastructure.persistence.mapper.KnowledgeMapper;
import sc.school_check.application.service.KnowledgeCommentService;
import sc.school_check.application.service.KnowledgeService;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class KnowledgeServiceImpl extends ServiceImpl<KnowledgeMapper, Knowledge> implements KnowledgeService {

    private final KnowledgeCommentService knowledgeCommentService;

    public KnowledgeServiceImpl(KnowledgeCommentService knowledgeCommentService) {
        this.knowledgeCommentService = knowledgeCommentService;
    }

    @Override
    public IPage<Knowledge> getKnowledgePage(Integer pageNum, Integer pageSize, String tag, LocalDate createDate) {
        Page<Knowledge> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<Knowledge> wrapper = new LambdaQueryWrapper<Knowledge>()
                .orderByDesc(Knowledge::getUpdateTime)
                .orderByDesc(Knowledge::getCreateTime);

        if (tag != null && !tag.isBlank()) {
            wrapper.like(Knowledge::getTags, tag.trim());
        }

        if (createDate != null) {
            ZoneId zoneId = ZoneId.systemDefault();
            Date start = Date.from(createDate.atStartOfDay(zoneId).toInstant());
            Date end = Date.from(createDate.plusDays(1).atStartOfDay(zoneId).toInstant());
            wrapper.ge(Knowledge::getCreateTime, start)
                    .lt(Knowledge::getCreateTime, end);
        }

        IPage<Knowledge> result = this.baseMapper.selectPage(page, wrapper);
        fillCommentCount(result.getRecords());
        return result;
    }

    @Override
    public boolean forceDeleteById(Long id) {
        knowledgeCommentService.forceDeleteByKnowledgeId(id);
        return this.baseMapper.forceDeleteById(id) > 0;
    }

    @Override
    public void forceDeleteByUserId(Long userId) {
        knowledgeCommentService.forceDeleteByUserId(userId);
        this.baseMapper.forceDeleteByUserId(userId);
    }

    private void fillCommentCount(List<Knowledge> records) {
        if (records == null || records.isEmpty()) {
            return;
        }
        List<Long> knowledgeIds = records.stream()
                .map(Knowledge::getId)
                .filter(id -> id != null)
                .collect(Collectors.toList());
        Map<Long, Long> countMap = knowledgeCommentService.countByKnowledgeIds(knowledgeIds);
        records.forEach(item -> item.setCommentCount(countMap.getOrDefault(item.getId(), 0L)));
    }
}

