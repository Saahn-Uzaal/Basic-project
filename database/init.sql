-- Khởi tạo database cho backend. Chạy bằng tài khoản root, có thể chạy lại nhiều lần:
--   mariadb -u root -p < database/init.sql
-- Tên DB / user / mật khẩu khớp với giá trị mặc định trong backend/src/main/resources/application.properties.

CREATE DATABASE IF NOT EXISTS basic_app
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'app_user'@'%' IDENTIFIED BY 'app_secret';
GRANT ALL PRIVILEGES ON basic_app.* TO 'app_user'@'%';
FLUSH PRIVILEGES;

USE basic_app;

CREATE TABLE IF NOT EXISTS tasks (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    title       VARCHAR(200)  NOT NULL,
    description VARCHAR(1000) NULL,
    completed   BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at  DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at  DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dữ liệu mẫu, chỉ thêm khi bảng còn trống.
INSERT INTO tasks (title, description, completed)
SELECT * FROM (
    SELECT 'Cài đặt môi trường', 'Node.js, JDK 17+, MariaDB', TRUE
    UNION ALL SELECT 'Viết API backend', 'Spring Boot + MariaDB', FALSE
    UNION ALL SELECT 'Làm giao diện frontend', 'Node.js + Express', FALSE
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM tasks);
