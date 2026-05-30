# 学校数据中心巡检管理系统

一个基于Spring Boot的现代化学校实验室设备巡检管理系统，提供设备状态监控、巡检记录管理、知识库共享等功能。

## 🚀 项目简介

本系统专为学校数据中心和实验室设计，旨在帮助管理人员：
- 记录设备日常运行状态
- 管理巡检计划和人员排班
- 共享设备维护知识
- 防止设备巡检遗漏
- 提供AI智能辅助功能

## 🛠️ 技术栈

### 后端技术
- **Java 17** - 核心开发语言
- **Spring Boot 3.2.3** - Web框架
- **Spring Security** - 安全框架
- **MyBatis Plus 3.5.5** - ORM框架
- **MySQL** - 数据库
- **Redis** - 缓存
- **RabbitMQ** - 消息队列
- **JWT** - 身份认证

### 工具库
- **Lombok** - 简化代码
- **JJWT** - JWT实现
- **Spring Actuator** - 监控

## ✨ 核心功能

### 1. 用户管理
- 用户注册/登录
- JWT认证
- 角色权限管理
- 会话控制
- 防重复登录

### 2. 巡检记录管理
- 设备巡检记录创建
- 图片上传功能
- 文字描述记录
- 巡检状态跟踪
- 巡检事件发布（RabbitMQ）
- 操作日志记录

### 3. 知识库系统
- 设备维护知识分享
- 知识评论功能
- 知识分类管理

### 4. 排班管理
- 巡检人员排班
- 班次管理
- 调度安排

### 5. 房间管理
- 数据中心房间信息
- 设备位置管理

### 6. AI智能助手
- 设备故障诊断建议
- 维护知识智能推荐
- 操作指导

### 7. 系统管理
- NCIC数据集成
- 系统监控
- 消息队列管理

## 📦 安装和运行

### 环境要求
- JDK 17+
- Maven 3.6+
- MySQL 8.0+
- Redis 6.0+
- RabbitMQ 3.9+

### 步骤1：克隆项目
```bash
git clone [项目地址]
cd school_check_clean
```

### 步骤2：配置数据库
1. 创建数据库：
```sql
CREATE DATABASE school_check DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. 修改配置文件 `src/main/resources/application.yml`：
```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/school_check?useUnicode=true&characterEncoding=utf8&useSSL=false&serverTimezone=GMT%2B8
    username: your_username
    password: your_password
  redis:
    host: localhost
    port: 6379
    password: your_redis_password
  rabbitmq:
    host: localhost
    port: 5672
    username: guest
    password: guest
```

### 步骤3：构建和运行
```bash
# 编译项目
mvn clean compile

# 运行测试
mvn test

# 打包
mvn package

# 运行应用
java -jar target/School_Check-0.0.1-SNAPSHOT.jar
```

或者直接运行：
```bash
mvn spring-boot:run
```

### 步骤4：访问系统
- 应用启动后访问：http://localhost:8080
- 默认管理员账号：admin / admin123

## 📖 API文档

### 认证相关
| 路径 | 方法 | 描述 |
|------|------|------|
| `/api/auth/login` | POST | 用户登录 |
| `/api/auth/logout` | POST | 用户登出 |
| `/api/auth/refresh` | POST | 刷新Token |

### 巡检记录
| 路径 | 方法 | 描述 |
|------|------|------|
| `/api/inspection-records` | GET | 获取巡检记录列表 |
| `/api/inspection-records` | POST | 创建巡检记录 |
| `/api/inspection-records/{id}` | PUT | 更新巡检记录 |
| `/api/inspection-records/{id}` | DELETE | 删除巡检记录 |

### 知识库
| 路径 | 方法 | 描述 |
|------|------|------|
| `/api/knowledge` | GET | 获取知识列表 |
| `/api/knowledge` | POST | 创建知识 |
| `/api/knowledge/{id}/comments` | POST | 添加评论 |

### 用户管理
| 路径 | 方法 | 描述 |
|------|------|------|
| `/api/users` | GET | 获取用户列表 |
| `/api/users/{id}` | GET | 获取用户详情 |
| `/api/users/{id}` | PUT | 更新用户信息 |

### AI助手
| 路径 | 方法 | 描述 |
|------|------|------|
| `/api/ai/assistant` | POST | AI咨询助手 |

## 🏗️ 项目结构

```
src/
├── main/java/sc/school_check/
│   ├── domain/          # 领域模型
│   │   ├── model/       # 实体类
│   │   └── repository/  # 仓储接口
│   ├── application/     # 应用服务
│   │   ├── service/     # 服务接口
│   │   └── service/impl/ # 服务实现
│   ├── infrastructure/ # 基础设施
│   │   ├── config/      # 配置类
│   │   ├── persistence/ # 数据访问
│   │   └── messaging/   # 消息队列
│   └── interfaces/     # 接口层
│       ├── rest/       # REST控制器
│       └── dto/        # 数据传输对象
└── test/java/          # 测试代码
```

## 🔧 配置说明

### 核心配置文件
- `application.yml` - 主配置文件
- `application-dev.yml` - 开发环境配置
- `application-prod.yml` - 生产环境配置

### 安全配置
- JWT过期时间：24小时
- Token刷新机制：支持无感刷新
- 密码加密：BCrypt

### 文件上传
- 最大文件大小：10MB
- 支持类型：jpg, png, pdf, doc, docx
- 存储路径：uploads/

## 🚀 部署指南

### Docker部署
```bash
# 构建镜像
docker build -t school-check .

# 运行容器
docker run -d -p 8080:8080 \
  -e SPRING_PROFILES_ACTIVE=prod \
  -e MYSQL_HOST=mysql \
  -e REDIS_HOST=redis \
  school-check
```

### 生产环境建议
1. 使用Nginx反向代理
2. 配置SSL证书
3. 设置数据库主从复制
4. 使用Redis集群
5. 配置RabbitMQ集群

## 📊 性能监控

### Spring Boot Actuator
- `/actuator/health` - 健康检查
- `/actuator/info` - 应用信息
- `/actuator/metrics` - 性能指标

### 监控指标
- HTTP请求响应时间
- 数据库连接池状态
- Redis缓存命中率
- RabbitMQ消息积压

## 🤝 贡献指南

1. Fork项目
2. 创建特性分支
3. 提交变更
4. 发起Pull Request

## 📄 许可证

本项目采用MIT许可证 - 查看 [LICENSE](LICENSE) 文件了解详情



## 🔄 版本历史

- v0.0.1-SNAPSHOT - 初始版本
  - 基础用户认证
  - 巡检记录管理
  - 知识库功能
  - RabbitMQ消息队列
  - AI助手集成
