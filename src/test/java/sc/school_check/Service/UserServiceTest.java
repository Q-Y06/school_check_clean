package sc.school_check.Service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import sc.school_check.Entity.User;
import sc.school_check.Mapper.UserMapper;
import sc.school_check.Service.impl.UserServiceImpl;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserMapper userMapper;

    private UserServiceImpl userService;

    @BeforeEach
    void setUp() {
        userService = new UserServiceImpl();
        ReflectionTestUtils.setField(userService, "baseMapper", userMapper);
    }

    @Test
    void testGetByUsername() {
        User expected = new User();
        expected.setId(1L);
        expected.setUsername("admin");

        when(userMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(expected);

        User actual = userService.getByUsername("admin");
        assertNotNull(actual);
        assertEquals("admin", actual.getUsername());
    }

    @Test
    void testGetUserPage() {
        when(userMapper.selectPage(any(Page.class), any(LambdaQueryWrapper.class))).thenAnswer(invocation -> {
            Page<User> page = invocation.getArgument(0);
            User u = new User();
            u.setId(1L);
            u.setUsername("u1");
            page.setRecords(Collections.singletonList(u));
            page.setTotal(1L);
            return page;
        });

        IPage<User> result = userService.getUserPage(1, 10);
        assertNotNull(result);
        assertEquals(1L, result.getTotal());
        assertTrue(result.getRecords().size() == 1);
    }
}
