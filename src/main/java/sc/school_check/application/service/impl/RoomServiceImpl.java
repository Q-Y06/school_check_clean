package sc.school_check.application.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;
import sc.school_check.domain.model.Room;
import sc.school_check.infrastructure.persistence.mapper.RoomMapper;
import sc.school_check.application.service.RoomService;

@Service
public class RoomServiceImpl extends ServiceImpl<RoomMapper, Room> implements RoomService {

    @Override
    public IPage<Room> getRoomPage(Integer pageNum, Integer pageSize, String status) {
        Page<Room> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<Room> queryWrapper = new LambdaQueryWrapper<>();

        if (status != null && !status.trim().isEmpty()) {
            queryWrapper.eq(Room::getStatus, status);
        }

        queryWrapper.orderByDesc(Room::getUpdateTime);
        return this.page(page, queryWrapper);
    }

    @Override
    public boolean forceDeleteById(Long id) {
        return this.baseMapper.forceDeleteById(id) > 0;
    }
}
