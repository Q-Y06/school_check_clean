package sc.school_check.application.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.IService;
import sc.school_check.domain.model.Knowledge;

import java.time.LocalDate;

public interface KnowledgeService extends IService<Knowledge> {
    IPage<Knowledge> getKnowledgePage(Integer pageNum, Integer pageSize, String tag, LocalDate createDate);

    boolean forceDeleteById(Long id);

    void forceDeleteByUserId(Long userId);
}

