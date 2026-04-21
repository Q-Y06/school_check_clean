package sc.school_check.application.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.IService;
import sc.school_check.domain.model.Room;

public interface RoomService extends IService<Room> {
    IPage<Room> getRoomPage(Integer pageNum, Integer pageSize, String status);

    boolean forceDeleteById(Long id);
}
