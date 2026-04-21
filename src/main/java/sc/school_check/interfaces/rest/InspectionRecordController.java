package sc.school_check.interfaces.rest;

import lombok.RequiredArgsConstructor;
import com.baomidou.mybatisplus.core.metadata.IPage;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import sc.school_check.domain.model.InspectionRecord;
import sc.school_check.domain.model.User;
import sc.school_check.shared.exception.BusinessException;
import sc.school_check.application.service.InspectionRecordService;
import sc.school_check.application.service.UserService;
import sc.school_check.shared.util.FileUtil;
import sc.school_check.shared.util.ResponseUtil;

import java.time.LocalDate;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@RequiredArgsConstructor
@RestController
@RequestMapping("/api/inspection")
public class InspectionRecordController {
    private final InspectionRecordService inspectionRecordService;
    private final FileUtil fileUtil;
    private final UserService userService;

    @GetMapping("/list")
    public ResponseUtil<IPage<InspectionRecord>> getInspectionList(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) Long roomId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate inspectionDate,
            @RequestParam(required = false, defaultValue = "false") Boolean today) {
        IPage<InspectionRecord> inspectionPage = inspectionRecordService.getInspectionPage(pageNum, pageSize, roomId, inspectionDate, today);
        fillDisplayName(inspectionPage.getRecords());
        return ResponseUtil.success(inspectionPage);
    }

    @PostMapping
    public ResponseUtil<?> addInspection(
            @RequestPart("inspection") InspectionRecord inspection,
            @RequestPart(value = "images", required = false) List<MultipartFile> images) {
        if (inspection.getRoomId() == null) {
            throw new BusinessException(400, "机房 ID 不能为空");
        }
        if (inspection.getUserId() == null) {
            throw new BusinessException(400, "巡检人 ID 不能为空");
        }
        if (inspection.getStatus() == null || inspection.getStatus().isEmpty()) {
            throw new BusinessException(400, "巡检状态不能为空");
        }

        if (images != null && !images.isEmpty()) {
            String imageUrls = fileUtil.uploadFiles(images);
            inspection.setImages(imageUrls);
        }

        Date now = new Date();
        inspection.setInspectionTime(now);
        inspection.setInspectTime(now);

        User user = userService.getById(inspection.getUserId());
        String displayName = displayName(user, inspection.getUserName());
        inspection.setUserName(displayName);
        if (inspection.getInspectorId() == null) {
            inspection.setInspectorId(inspection.getUserId());
        }
        inspection.setInspectorName(displayName);

        if (inspectionRecordService.save(inspection)) {
            inspectionRecordService.updateRoomStatus(inspection.getRoomId(), inspection.getStatus());
            return ResponseUtil.success("巡检记录提交成功");
        }
        throw new BusinessException(500, "巡检记录提交失败");
    }

    @PutMapping
    public ResponseUtil<?> updateInspection(@RequestBody InspectionRecord inspection) {
        if (inspection.getId() == null) {
            throw new BusinessException(400, "巡检记录 ID 不能为空");
        }
        InspectionRecord existing = inspectionRecordService.getById(inspection.getId());
        if (existing == null) {
            throw new BusinessException(404, "巡检记录不存在");
        }
        if (inspection.getInspectionTime() != null) {
            existing.setInspectionTime(inspection.getInspectionTime());
            existing.setInspectTime(inspection.getInspectionTime());
        }
        if (inspection.getStatus() != null && !inspection.getStatus().isEmpty()) {
            existing.setStatus(inspection.getStatus());
        }
        if (inspection.getNotes() != null) {
            existing.setNotes(inspection.getNotes());
        }
        if (inspection.getRichContent() != null) {
            existing.setRichContent(inspection.getRichContent());
        }
        if (inspection.getRoomId() != null) {
            existing.setRoomId(inspection.getRoomId());
        }
        if (inspection.getRoomName() != null) {
            existing.setRoomName(inspection.getRoomName());
        }
        if (inspectionRecordService.updateById(existing)) {
            inspectionRecordService.updateRoomStatus(existing.getRoomId(), existing.getStatus());
            return ResponseUtil.success("巡检记录更新成功");
        }
        throw new BusinessException(500, "巡检记录更新失败");
    }

    @GetMapping("/{id}")
    public ResponseUtil<InspectionRecord> getInspectionById(@PathVariable Long id) {
        InspectionRecord inspection = inspectionRecordService.getById(id);
        if (inspection == null) {
            throw new BusinessException(404, "巡检记录不存在");
        }
        fillDisplayName(List.of(inspection));
        return ResponseUtil.success(inspection);
    }

    private void fillDisplayName(List<InspectionRecord> records) {
        if (records == null || records.isEmpty()) {
            return;
        }
        Set<Long> userIds = records.stream()
                .map(record -> record.getInspectorId() != null ? record.getInspectorId() : record.getUserId())
                .filter(id -> id != null)
                .collect(Collectors.toSet());
        if (userIds.isEmpty()) {
            return;
        }
        Map<Long, User> userMap = userService.listByIds(userIds).stream()
                .collect(Collectors.toMap(User::getId, Function.identity(), (a, b) -> a));
        records.forEach(record -> {
            Long targetUserId = record.getInspectorId() != null ? record.getInspectorId() : record.getUserId();
            User user = userMap.get(targetUserId);
            String fallback = record.getInspectorName() != null && !record.getInspectorName().isBlank()
                    ? record.getInspectorName()
                    : record.getUserName();
            String displayName = displayName(user, fallback);
            record.setUserName(displayName);
            record.setInspectorName(displayName);
        });
    }

    private String displayName(User user, String fallback) {
        if (user != null && user.getFullName() != null && !user.getFullName().trim().isEmpty()) {
            return user.getFullName().trim();
        }
        if (fallback != null && !fallback.trim().isEmpty()) {
            return fallback.trim();
        }
        return "未知巡检员";
    }
}
