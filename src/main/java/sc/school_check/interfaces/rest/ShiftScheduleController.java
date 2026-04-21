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
import sc.school_check.domain.model.Room;
import sc.school_check.domain.model.ShiftSchedule;
import sc.school_check.domain.model.User;
import sc.school_check.shared.exception.BusinessException;
import sc.school_check.application.service.RoomService;
import sc.school_check.application.service.ShiftScheduleService;
import sc.school_check.application.service.UserService;
import sc.school_check.shared.util.ResponseUtil;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Date;

@RequiredArgsConstructor
@RestController
@RequestMapping("/api/schedule")
public class ShiftScheduleController {
    private final ShiftScheduleService shiftScheduleService;
    private final UserService userService;
    private final RoomService roomService;

    @GetMapping("/list")
    public ResponseUtil<IPage<ShiftSchedule>> getScheduleList(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate scheduleDate) {
        return ResponseUtil.success(shiftScheduleService.getSchedulePage(pageNum, pageSize, scheduleDate));
    }

    @PostMapping
    public ResponseUtil<?> addSchedule(@RequestBody ShiftSchedule schedule) {
        validate(schedule);
        fillNames(schedule);
        if (schedule.getScheduleDate() == null) {
            schedule.setScheduleDate(Date.from(LocalDate.now(ZoneId.of("Asia/Shanghai"))
                    .atStartOfDay(ZoneId.of("Asia/Shanghai")).toInstant()));
        }
        if (shiftScheduleService.save(schedule)) {
            return ResponseUtil.success("排班新增成功");
        }
        throw new BusinessException(500, "排班新增失败");
    }

    @PutMapping
    public ResponseUtil<?> updateSchedule(@RequestBody ShiftSchedule schedule) {
        if (schedule.getId() == null) {
            throw new BusinessException(400, "排班ID不能为空");
        }
        ShiftSchedule existing = shiftScheduleService.getById(schedule.getId());
        if (existing == null) {
            throw new BusinessException(404, "排班记录不存在");
        }
        validate(schedule);
        fillNames(schedule);
        if (shiftScheduleService.updateById(schedule)) {
            return ResponseUtil.success("排班修改成功");
        }
        throw new BusinessException(500, "排班修改失败");
    }

    @DeleteMapping("/{id}")
    public ResponseUtil<?> deleteSchedule(@PathVariable Long id) {
        if (shiftScheduleService.forceDeleteById(id)) {
            return ResponseUtil.success("排班删除成功");
        }
        throw new BusinessException(500, "排班删除失败");
    }

    private void validate(ShiftSchedule schedule) {
        if (schedule.getUserId() == null) {
            throw new BusinessException(400, "排班人员不能为空");
        }
        if (schedule.getRoomId() == null) {
            throw new BusinessException(400, "排班机房不能为空");
        }
        if (schedule.getScheduleDate() == null) {
            throw new BusinessException(400, "排班日期不能为空");
        }
        if (schedule.getShiftType() == null || schedule.getShiftType().trim().isEmpty()) {
            throw new BusinessException(400, "班次不能为空");
        }
    }

    private void fillNames(ShiftSchedule schedule) {
        User user = schedule.getUserId() == null ? null : userService.getById(schedule.getUserId());
        if (user != null) {
            schedule.setUserName(user.getFullName() != null && !user.getFullName().isEmpty() ? user.getFullName() : user.getUsername());
        }
        Room room = schedule.getRoomId() == null ? null : roomService.getById(schedule.getRoomId());
        if (room != null) {
            schedule.setRoomName(room.getName());
        }
    }
}
