package sc.school_check.interfaces.rest;

import lombok.RequiredArgsConstructor;
import com.baomidou.mybatisplus.core.metadata.IPage;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import sc.school_check.domain.model.Knowledge;
import sc.school_check.shared.exception.BusinessException;
import sc.school_check.application.service.KnowledgeService;
import sc.school_check.shared.util.ResponseUtil;

import java.time.LocalDate;

@RequiredArgsConstructor
@RestController
@RequestMapping("/api/knowledge")
public class KnowledgeController {
    private final KnowledgeService knowledgeService;

    @GetMapping("/list")
    public ResponseUtil<IPage<Knowledge>> getKnowledgeList(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String tag,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate createDate) {
        IPage<Knowledge> knowledgePage = knowledgeService.getKnowledgePage(pageNum, pageSize, tag, createDate);
        return ResponseUtil.success(knowledgePage);
    }

    @PostMapping
    public ResponseUtil<?> addKnowledge(@RequestBody Knowledge knowledge) {
        if (knowledge.getTitle() == null || knowledge.getTitle().trim().isEmpty()) {
            throw new BusinessException(400, "知识标题不能为空");
        }
        if (knowledge.getContent() == null || knowledge.getContent().trim().isEmpty()) {
            throw new BusinessException(400, "知识内容不能为空");
        }

        if (knowledge.getType() == null || knowledge.getType().isBlank()) {
            knowledge.setType("通用故障");
        }
        if (knowledge.getCreatorId() == null) {
            knowledge.setCreatorId(knowledge.getCreateUserId());
        }
        if (knowledge.getCreatorName() == null || knowledge.getCreatorName().isBlank()) {
            knowledge.setCreatorName(knowledge.getCreateUserName());
        }

        if (knowledgeService.save(knowledge)) {
            return ResponseUtil.success("知识上传成功");
        }
        throw new BusinessException(500, "知识上传失败");
    }

    @PutMapping
    public ResponseUtil<?> updateKnowledge(@RequestBody Knowledge knowledge) {
        if (knowledge.getId() == null) {
            throw new BusinessException(400, "知识 ID 不能为空");
        }
        if (knowledge.getType() == null || knowledge.getType().isBlank()) {
            knowledge.setType("通用故障");
        }
        if (knowledge.getCreatorId() == null) {
            knowledge.setCreatorId(knowledge.getCreateUserId());
        }
        if (knowledge.getCreatorName() == null || knowledge.getCreatorName().isBlank()) {
            knowledge.setCreatorName(knowledge.getCreateUserName());
        }
        if (knowledgeService.updateById(knowledge)) {
            return ResponseUtil.success("知识更新成功");
        }
        throw new BusinessException(500, "知识更新失败");
    }

    @DeleteMapping("/{id}")
    public ResponseUtil<?> deleteKnowledge(@PathVariable Long id) {
        if (knowledgeService.forceDeleteById(id)) {
            return ResponseUtil.success("知识删除成功");
        }
        throw new BusinessException(500, "知识删除失败");
    }
}

