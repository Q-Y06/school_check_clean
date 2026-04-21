package sc.school_check.interfaces.rest;

import com.baomidou.mybatisplus.core.metadata.IPage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.transaction.annotation.Transactional;
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
import sc.school_check.shared.exception.BusinessException;
import sc.school_check.application.service.InspectionRecordService;
import sc.school_check.application.service.RoomService;
import sc.school_check.application.service.ShiftScheduleService;
import sc.school_check.shared.util.ResponseUtil;

@RequiredArgsConstructor
@Slf4j
@RestController
@RequestMapping("/api/room")
public class RoomController {

    private final RoomService roomService;
    private final InspectionRecordService inspectionRecordService;
    private final ShiftScheduleService shiftScheduleService;

    @GetMapping("/list")
    public ResponseUtil<IPage<Room>> getRoomList(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String status) {
        log.info("开始查询机房列表，pageNum={}, pageSize={}, status={}", pageNum, pageSize, status);
        IPage<Room> roomPage = roomService.getRoomPage(pageNum, pageSize, status);
        log.info("机房列表查询成功，共 {} 条数据");
        return ResponseUtil.success(roomPage);
    }

    @PostMapping
    public ResponseUtil<?> addRoom(@RequestBody Room room) {
        if (room.getName() == null || room.getName().trim().isEmpty()) {
            throw new BusinessException(400, "机房名称不能为空");
        }
        if (room.getType() == null || room.getType().trim().isEmpty()) {
            throw new BusinessException(400, "机房类型不能为空");
        }
        if (room.getLocation() == null || room.getLocation().trim().isEmpty()) {
            throw new BusinessException(400, "机房位置不能为空");
        }
        if (room.getStatus() == null || room.getStatus().trim().isEmpty()) {
            room.setStatus("unchecked");
        }

        log.info("开始新增机房，名称={}", room.getName());
        if (roomService.save(room)) {
            log.info("机房新增成功，ID={}", room.getId());
            return ResponseUtil.success("机房新增成功");
        }
        throw new BusinessException(500, "机房新增失败");
    }

    @PutMapping
    public ResponseUtil<?> updateRoom(@RequestBody Room room) {
        if (room.getId() == null) {
            throw new BusinessException(400, "机房ID不能为空");
        }

        Room existRoom = roomService.getById(room.getId());
        if (existRoom == null) {
            log.warn("修改机房失败，ID={} 不存在");
            throw new BusinessException(404, "机房不存在，无法修改");
        }

        log.info("开始修改机房，ID={}", room.getId());
        if (roomService.updateById(room)) {
            log.info("机房修改成功，ID={}", room.getId());
            return ResponseUtil.success("机房修改成功");
        }
        throw new BusinessException(500, "机房修改失败");
    }

    @GetMapping("/{id}")
    public ResponseUtil<Room> getRoomById(@PathVariable Long id) {
        log.info("查询机房详情，ID={}", id);
        Room room = roomService.getById(id);
        if (room == null) {
            log.warn("机房详情查询失败，ID={} 不存在");
            throw new BusinessException(404, "机房不存在");
        }
        return ResponseUtil.success(room);
    }

    @DeleteMapping("/{id}")
    @Transactional(rollbackFor = Exception.class)
    public ResponseUtil<?> deleteRoom(@PathVariable Long id) {
        Room existRoom = roomService.getById(id);
        if (existRoom == null) {
            log.warn("删除机房失败，ID={} 不存在");
            throw new BusinessException(404, "机房不存在，无法删除");
        }

        inspectionRecordService.forceDeleteByRoomId(id);
        shiftScheduleService.forceDeleteByRoomId(id);
        log.info("开始删除机房，ID={}", id);
        if (roomService.forceDeleteById(id)) {
            log.info("机房删除成功，ID={}", id);
            return ResponseUtil.success("机房及关联数据删除成功");
        }
        throw new BusinessException(500, "机房删除失败");
    }
}
