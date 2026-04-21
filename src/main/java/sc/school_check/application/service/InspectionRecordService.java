package sc.school_check.application.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.IService;
import sc.school_check.domain.model.InspectionRecord;

import java.time.LocalDate;

public interface InspectionRecordService extends IService<InspectionRecord> {
    IPage<InspectionRecord> getInspectionPage(Integer pageNum, Integer pageSize, Long roomId, LocalDate inspectionDate, Boolean today);

    void updateRoomStatus(Long roomId, String status);

    boolean forceDeleteById(Long id);

    void forceDeleteByRoomId(Long roomId);

    void forceDeleteByUserId(Long userId);
}
