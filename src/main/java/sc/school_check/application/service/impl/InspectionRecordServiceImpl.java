package sc.school_check.application.service.impl;

import lombok.RequiredArgsConstructor;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;
import sc.school_check.domain.model.InspectionRecord;
import sc.school_check.domain.model.Room;
import sc.school_check.infrastructure.persistence.mapper.InspectionRecordMapper;
import sc.school_check.application.service.InspectionRecordService;
import sc.school_check.application.service.RoomService;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Date;

@RequiredArgsConstructor
@Service
public class InspectionRecordServiceImpl extends ServiceImpl<InspectionRecordMapper, InspectionRecord> implements InspectionRecordService {
    private final RoomService roomService;

    @Override
    public IPage<InspectionRecord> getInspectionPage(Integer pageNum, Integer pageSize, Long roomId, LocalDate inspectionDate, Boolean today) {
        Page<InspectionRecord> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<InspectionRecord> wrapper = new LambdaQueryWrapper<InspectionRecord>()
                .orderByDesc(InspectionRecord::getInspectionTime);

        if (roomId != null) {
            wrapper.eq(InspectionRecord::getRoomId, roomId);
        }

        LocalDate targetDate = inspectionDate;
        if (Boolean.TRUE.equals(today)) {
            targetDate = LocalDate.now(ZoneId.of("Asia/Shanghai"));
        }

        if (targetDate != null) {
            ZoneId zoneId = ZoneId.of("Asia/Shanghai");
            Date start = Date.from(targetDate.atStartOfDay(zoneId).toInstant());
            Date end = Date.from(targetDate.plusDays(1).atStartOfDay(zoneId).toInstant());
            wrapper.ge(InspectionRecord::getInspectionTime, start)
                    .lt(InspectionRecord::getInspectionTime, end);
        }

        return this.baseMapper.selectPage(page, wrapper);
    }

    @Override
    public void updateRoomStatus(Long roomId, String status) {
        Room room = new Room();
        room.setId(roomId);
        room.setStatus(status);
        roomService.updateById(room);
    }

    @Override
    public boolean forceDeleteById(Long id) {
        return this.baseMapper.forceDeleteById(id) > 0;
    }

    @Override
    public void forceDeleteByRoomId(Long roomId) {
        this.baseMapper.forceDeleteByRoomId(roomId);
    }

    @Override
    public void forceDeleteByUserId(Long userId) {
        this.baseMapper.forceDeleteByUserId(userId);
    }
}
