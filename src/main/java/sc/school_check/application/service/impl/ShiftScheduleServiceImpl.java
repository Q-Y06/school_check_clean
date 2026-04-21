package sc.school_check.application.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;
import sc.school_check.domain.model.ShiftSchedule;
import sc.school_check.infrastructure.persistence.mapper.ShiftScheduleMapper;
import sc.school_check.application.service.ShiftScheduleService;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Date;

@Service
public class ShiftScheduleServiceImpl extends ServiceImpl<ShiftScheduleMapper, ShiftSchedule> implements ShiftScheduleService {
    @Override
    public IPage<ShiftSchedule> getSchedulePage(Integer pageNum, Integer pageSize, LocalDate scheduleDate) {
        Page<ShiftSchedule> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<ShiftSchedule> wrapper = new LambdaQueryWrapper<ShiftSchedule>()
                .orderByDesc(ShiftSchedule::getId);
        if (scheduleDate != null) {
            ZoneId zoneId = ZoneId.of("Asia/Shanghai");
            Date start = Date.from(scheduleDate.atStartOfDay(zoneId).toInstant());
            Date end = Date.from(scheduleDate.plusDays(1).atStartOfDay(zoneId).toInstant());
            wrapper.ge(ShiftSchedule::getScheduleDate, start)
                    .lt(ShiftSchedule::getScheduleDate, end);
        }
        return this.baseMapper.selectPage(page, wrapper);
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
