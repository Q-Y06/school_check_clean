package sc.school_check.infrastructure.config;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import sc.school_check.application.service.InspectionRecordService;
import sc.school_check.application.service.KnowledgeService;
import sc.school_check.application.service.RoomService;
import sc.school_check.application.service.ShiftScheduleService;
import sc.school_check.application.service.UserService;
import sc.school_check.domain.model.InspectionRecord;
import sc.school_check.domain.model.Knowledge;
import sc.school_check.domain.model.Room;
import sc.school_check.domain.model.ShiftSchedule;
import sc.school_check.domain.model.User;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Date;
import java.util.Optional;

@Component
@Order(99)
public class DemoDataInitializer implements ApplicationRunner {

    private static final ZoneId ZONE_ID = ZoneId.of("Asia/Shanghai");

    private final RoomService roomService;
    private final KnowledgeService knowledgeService;
    private final ShiftScheduleService shiftScheduleService;
    private final InspectionRecordService inspectionRecordService;
    private final UserService userService;

    public DemoDataInitializer(RoomService roomService,
                               KnowledgeService knowledgeService,
                               ShiftScheduleService shiftScheduleService,
                               InspectionRecordService inspectionRecordService,
                               UserService userService) {
        this.roomService = roomService;
        this.knowledgeService = knowledgeService;
        this.shiftScheduleService = shiftScheduleService;
        this.inspectionRecordService = inspectionRecordService;
        this.userService = userService;
    }

    @Override
    public void run(ApplicationArguments args) {
        User demoUser = resolveDemoUser();
        if (demoUser == null) {
            return;
        }
        Room roomA = ensureRoom("演示机房-网络中心A", "网络机房", "信息楼 4 层 401", "unchecked", demoUser);
        Room roomB = ensureRoom("演示机房-UPS中心B", "UPS机房", "信息楼 1 层 UPS-B", "unchecked", demoUser);
        ensureKnowledge("网络中心巡检指南", "网络机房,巡检", demoUser,
                "检查温湿度、门禁、核心交换机告警灯、链路状态和日志告警。", "网络设备");
        ensureKnowledge("UPS 告警处理步骤", "UPS,告警", demoUser,
                "确认 UPS 输入输出、电池组温度、旁路状态和负载率，必要时联系值班工程师。", "UPS");
        ensureSchedule(demoUser, roomA);
        ensureInspection(demoUser, roomB);
    }

    private User resolveDemoUser() {
        Optional<User> active = userService.lambdaQuery()
                .eq(User::getStatus, 1)
                .orderByAsc(User::getId)
                .list()
                .stream()
                .findFirst();
        return active.orElseGet(() -> userService.lambdaQuery().orderByAsc(User::getId).list().stream().findFirst().orElse(null));
    }

    private Room ensureRoom(String name, String type, String location, String status, User manager) {
        Room existing = roomService.lambdaQuery().eq(Room::getName, name).one();
        if (existing != null) {
            return existing;
        }
        Room room = new Room();
        room.setName(name);
        room.setType(type);
        room.setLocation(location);
        room.setStatus(status);
        room.setGuideContent("按规范完成设备状态、环境状态和告警信息核对。");
        room.setManagerId(manager.getId());
        room.setManagerName(displayName(manager));
        roomService.save(room);
        return room;
    }

    private void ensureKnowledge(String title, String tags, User creator, String content, String deviceType) {
        Knowledge existing = knowledgeService.lambdaQuery().eq(Knowledge::getTitle, title).one();
        if (existing != null) {
            return;
        }
        Knowledge knowledge = new Knowledge();
        knowledge.setTitle(title);
        knowledge.setTags(tags);
        knowledge.setContent(content);
        knowledge.setDeviceType(deviceType);
        knowledge.setType("故障处理");
        knowledge.setCreateUserId(creator.getId());
        knowledge.setCreateUserName(displayName(creator));
        knowledge.setCreatorId(creator.getId());
        knowledge.setCreatorName(displayName(creator));
        knowledge.setAttachmentPath("");
        knowledgeService.save(knowledge);
    }

    private void ensureSchedule(User user, Room room) {
        String notes = "演示值班排期";
        ShiftSchedule existing = shiftScheduleService.lambdaQuery().eq(ShiftSchedule::getNotes, notes).one();
        if (existing != null) {
            return;
        }
        ShiftSchedule schedule = new ShiftSchedule();
        schedule.setScheduleDate(Date.from(LocalDate.now(ZONE_ID).plusDays(1).atStartOfDay(ZONE_ID).toInstant()));
        schedule.setUserId(user.getId());
        schedule.setUserName(displayName(user));
        schedule.setRoomId(room.getId());
        schedule.setRoomName(room.getName());
        schedule.setShiftType("白班");
        schedule.setNotes(notes);
        shiftScheduleService.save(schedule);
    }

    private void ensureInspection(User user, Room room) {
        String notes = "演示巡检记录";
        InspectionRecord existing = inspectionRecordService.lambdaQuery().eq(InspectionRecord::getNotes, notes).one();
        if (existing != null) {
            return;
        }
        Date now = new Date();
        InspectionRecord record = new InspectionRecord();
        record.setRoomId(room.getId());
        record.setRoomName(room.getName());
        record.setUserId(user.getId());
        record.setUserName(displayName(user));
        record.setStatus("normal");
        record.setNotes(notes);
        record.setRichContent("演示记录：设备状态正常，环境状态正常。");
        record.setImages("");
        record.setInspectionTime(now);
        record.setInspectorId(user.getId());
        record.setInspectorName(displayName(user));
        record.setInspectTime(now);
        inspectionRecordService.save(record);
        inspectionRecordService.updateRoomStatus(room.getId(), "normal");
    }

    private String displayName(User user) {
        String fullName = user.getFullName();
        return fullName != null && !fullName.trim().isEmpty() ? fullName.trim() : String.valueOf(user.getUsername());
    }
}
