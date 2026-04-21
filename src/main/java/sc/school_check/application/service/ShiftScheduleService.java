package sc.school_check.application.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.IService;
import sc.school_check.domain.model.ShiftSchedule;

import java.time.LocalDate;

public interface ShiftScheduleService extends IService<ShiftSchedule> {
    IPage<ShiftSchedule> getSchedulePage(Integer pageNum, Integer pageSize, LocalDate scheduleDate);

    boolean forceDeleteById(Long id);

    void forceDeleteByRoomId(Long roomId);

    void forceDeleteByUserId(Long userId);
}
