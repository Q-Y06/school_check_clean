package sc.school_check.interfaces.rest;

import lombok.RequiredArgsConstructor;
import com.baomidou.mybatisplus.core.metadata.IPage;
import org.springframework.security.core.Authentication;
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
import sc.school_check.domain.model.KnowledgeComment;
import sc.school_check.domain.model.User;
import sc.school_check.shared.exception.BusinessException;
import sc.school_check.application.service.KnowledgeCommentService;
import sc.school_check.application.service.KnowledgeService;
import sc.school_check.application.service.UserService;
import sc.school_check.shared.util.ResponseUtil;

import java.util.Map;

@RequiredArgsConstructor
@RestController
@RequestMapping("/api/knowledge")
public class KnowledgeCommentController {
    private final KnowledgeCommentService knowledgeCommentService;
    private final KnowledgeService knowledgeService;
    private final UserService userService;

    @GetMapping("/{knowledgeId}/comments")
    public ResponseUtil<IPage<KnowledgeComment>> getComments(@PathVariable Long knowledgeId,
                                                             @RequestParam(defaultValue = "1") Integer pageNum,
                                                             @RequestParam(defaultValue = "10") Integer pageSize) {
        ensureKnowledgeExists(knowledgeId);
        return ResponseUtil.success(knowledgeCommentService.getCommentPage(knowledgeId, pageNum, pageSize));
    }

    @PostMapping("/{knowledgeId}/comments")
    public ResponseUtil<?> addComment(@PathVariable Long knowledgeId,
                                      @RequestBody Map<String, Object> payload,
                                      Authentication authentication) {
        ensureKnowledgeExists(knowledgeId);
        User user = requireLoginUser(authentication);

        String content = trimText(payload.get("content"));
        validateContent(content);

        Long parentId = parseLong(payload.get("parentId"));
        String replyToUserName = trimText(payload.get("replyToUserName"));
        if (parentId != null) {
            KnowledgeComment parent = requireComment(knowledgeId, parentId);
            if (replyToUserName == null || replyToUserName.isEmpty()) {
                replyToUserName = parent.getUserName();
            }
        }

        KnowledgeComment comment = new KnowledgeComment();
        comment.setKnowledgeId(knowledgeId);
        comment.setUserId(user.getId());
        comment.setUserName(displayName(user));
        comment.setContent(content);
        comment.setParentId(parentId);
        comment.setReplyToUserName(replyToUserName);
        comment.setPinned(0);
        comment.setFeatured(0);
        knowledgeCommentService.save(comment);
        return ResponseUtil.success("留言发布成功");
    }

    @PutMapping("/{knowledgeId}/comments/{commentId}")
    public ResponseUtil<?> updateComment(@PathVariable Long knowledgeId,
                                         @PathVariable Long commentId,
                                         @RequestBody Map<String, Object> payload,
                                         Authentication authentication) {
        ensureKnowledgeExists(knowledgeId);
        User user = requireLoginUser(authentication);
        KnowledgeComment comment = requireComment(knowledgeId, commentId);
        if (!canManageComment(user, comment)) {
            throw new BusinessException(403, "只能编辑自己的留言");
        }
        String content = trimText(payload.get("content"));
        validateContent(content);
        comment.setContent(content);
        if (knowledgeCommentService.updateById(comment)) {
            return ResponseUtil.success("留言更新成功");
        }
        throw new BusinessException(500, "留言更新失败");
    }

    @DeleteMapping("/{knowledgeId}/comments/{commentId}")
    public ResponseUtil<?> deleteComment(@PathVariable Long knowledgeId,
                                         @PathVariable Long commentId,
                                         Authentication authentication) {
        ensureKnowledgeExists(knowledgeId);
        User user = requireLoginUser(authentication);
        KnowledgeComment comment = requireComment(knowledgeId, commentId);
        if (!canManageComment(user, comment)) {
            throw new BusinessException(403, "只能删除自己的留言");
        }
        knowledgeCommentService.lambdaUpdate().eq(KnowledgeComment::getParentId, commentId).remove();
        if (knowledgeCommentService.removeById(commentId)) {
            return ResponseUtil.success("留言删除成功");
        }
        throw new BusinessException(500, "留言删除失败");
    }

    @PutMapping("/{knowledgeId}/comments/{commentId}/pin")
    public ResponseUtil<?> updatePin(@PathVariable Long knowledgeId,
                                     @PathVariable Long commentId,
                                     @RequestParam(defaultValue = "true") Boolean value,
                                     Authentication authentication) {
        ensureKnowledgeExists(knowledgeId);
        User user = requireLoginUser(authentication);
        if (!isAdmin(user)) {
            throw new BusinessException(403, "只有管理员可以置顶留言");
        }
        KnowledgeComment comment = requireComment(knowledgeId, commentId);
        comment.setPinned(Boolean.TRUE.equals(value) ? 1 : 0);
        if (knowledgeCommentService.updateById(comment)) {
            return ResponseUtil.success(Boolean.TRUE.equals(value) ? "评论已置顶" : "评论已取消置顶");
        }
        throw new BusinessException(500, "留言状态更新失败");
    }

    @PutMapping("/{knowledgeId}/comments/{commentId}/feature")
    public ResponseUtil<?> updateFeature(@PathVariable Long knowledgeId,
                                         @PathVariable Long commentId,
                                         @RequestParam(defaultValue = "true") Boolean value,
                                         Authentication authentication) {
        ensureKnowledgeExists(knowledgeId);
        User user = requireLoginUser(authentication);
        if (!isAdmin(user)) {
            throw new BusinessException(403, "只有管理员可以设置精选留言");
        }
        KnowledgeComment comment = requireComment(knowledgeId, commentId);
        comment.setFeatured(Boolean.TRUE.equals(value) ? 1 : 0);
        if (knowledgeCommentService.updateById(comment)) {
            return ResponseUtil.success(Boolean.TRUE.equals(value) ? "评论已置顶" : "评论已取消置顶");
        }
        throw new BusinessException(500, "留言状态更新失败");
    }

    private void ensureKnowledgeExists(Long knowledgeId) {
        Knowledge knowledge = knowledgeService.getById(knowledgeId);
        if (knowledge == null) {
            throw new BusinessException(404, "知识条目不存在");
        }
    }

    private KnowledgeComment requireComment(Long knowledgeId, Long commentId) {
        KnowledgeComment comment = knowledgeCommentService.getById(commentId);
        if (comment == null || !knowledgeId.equals(comment.getKnowledgeId())) {
            throw new BusinessException(404, "留言不存在");
        }
        return comment;
    }

    private User requireLoginUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new BusinessException(401, "请先登录后再操作");
        }
        User user = userService.getByUsername(authentication.getName());
        if (user == null) {
            throw new BusinessException(404, "当前登录用户不存在");
        }
        return user;
    }

    private boolean canManageComment(User user, KnowledgeComment comment) {
        return isAdmin(user) || (user != null && user.getId() != null && user.getId().equals(comment.getUserId()));
    }

    private boolean isAdmin(User user) {
        return user != null && "admin".equalsIgnoreCase(user.getRole());
    }

    private String displayName(User user) {
        return user.getFullName() != null && !user.getFullName().trim().isEmpty()
                ? user.getFullName().trim()
                : String.valueOf(user.getUsername());
    }

    private void validateContent(String content) {
        if (content == null || content.isEmpty()) {
            throw new BusinessException(400, "留言内容不能为空");
        }
        if (content.length() > 500) {
            throw new BusinessException(400, "留言内容不能超过 500 个字符");
        }
    }

    private String trimText(Object value) {
        return value == null ? null : String.valueOf(value).trim();
    }

    private Long parseLong(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        if (text.isEmpty() || "null".equalsIgnoreCase(text)) {
            return null;
        }
        return Long.valueOf(text);
    }
}
