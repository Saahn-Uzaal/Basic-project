# Hướng dẫn triển khai Basic Project từ VM1 sang VM2

Làm theo các bước dưới đây để lấy mã nguồn từ GitHub về Ubuntu trên VM1, cấu hình project và dùng Ansible triển khai ứng dụng trên VM2.

Ví dụ trong hướng dẫn dùng:

| Thông tin | Giá trị |
|---|---|
| VM1 | Ubuntu 24.04, user `hung134`; nơi lấy code và chạy Ansible |
| VM2 | Ubuntu 22.04/24.04, user `hung134`, có quyền sudo |
| IP VM2 | `192.168.88.69` |
| Thư mục code trên VM1 | `/home/hung134/Basic-project` |
| Thư mục triển khai trên VM2 | `/home/hung134/project` |
| URL ứng dụng | `http://192.168.88.69:81` |

**Thay IP và username bằng thông tin của bạn trong tất cả các lệnh và file cấu hình.** Hai máy cần kết nối được qua SSH; VM2 cần Internet để tải image và build ứng dụng. Các lệnh bên dưới dùng Bash trên Ubuntu.

## Bước 1. Lấy mã nguồn từ GitHub về VM1

**Thực hiện trên VM1.**

Cài Git:

~~~bash
sudo apt update
sudo apt install -y git
~~~

Lấy code:

~~~bash
cd /home/hung134
git clone https://github.com/Saahn-Uzaal/Basic-project.git Basic-project
cd Basic-project
ls -a
~~~

Cần thấy các file/thư mục sau:

~~~text
backend/
frontend/
database/
docker-compose.yml
deploy.yml
inventory.ini
README.md
~~~



## Bước 2. Cài Ansible trên VM1

**Thực hiện trên VM1.** Nếu Ansible đã có, kiểm tra phiên bản và hai collection rồi bỏ qua phần cài.

~~~bash
sudo apt update
sudo apt install software-properties-common
sudo apt-add-repository ppa:ansible/ansible
sudo apt install ansible
sudo apt install -y rsync openssh-client curl
~~~



## Bước 3. Chuẩn bị VM2

### 3.1. Đăng nhập VM2 từ VM1

**Chạy trên VM1:**

~~~bash
ssh hung134@192.168.88.69
~~~

Nhập mật khẩu đăng nhập user `hung134` trên VM2.

Nếu báo `Connection refused`, kiểm tra IP và SSH server tại console VM2. Có thể cài và bật SSH server trên VM2 bằng:

~~~bash
sudo apt update
sudo apt install -y openssh-server
sudo systemctl enable --now ssh
~~~

### 3.2. Kiểm tra sudo và cài công cụ

**Chạy trên VM2 trong phiên SSH:**

~~~bash
id -un
sudo id -un
sudo apt update
sudo apt install -y python3 rsync ca-certificates curl
~~~



### 3.3. Cài Docker và Compose plugin

**Chạy trên VM2.** 
Tạo file .sh để cài đặt docer
~~~
nano docker-install.sh
~~~
Rồi điền nội dung sau vào docker-install.sh

~~~bash
#!/bin/bash
sudo apt update
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common

curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

echo "deb [signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce
sudo systemctl start docker
sudo systemctl enable docker

sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

docker --version
docker-compose --version
~~~
rồi sau đó chạy file .sh
~~~
bash docker-install.sh
~~~
Thoát SSH để quay về VM1:

~~~bash
exit
~~~

## Bước 4. Thiết lập SSH key từ VM1 sang VM2

**Thực hiện trên VM1.** Bước đồng bộ source dùng rsync qua SSH, cần kết nối không hỏi mật khẩu SSH. 

Kiểm tra đã có key chưa:

~~~bash
ls ~/.ssh/id_ed25519.pub
~~~

Nếu chưa có, tạo key và giữ đường dẫn mặc định:

~~~bash
ssh-keygen -t ed25519
~~~

Nếu đã có key, dùng key hiện tại, tránh ghi đè. Chép public key sang VM2:

~~~bash
ssh-copy-id -i ~/.ssh/id_ed25519.pub hung134@192.168.88.69
~~~

Nhập mật khẩu SSH của VM2 khi được hỏi. Nếu key có passphrase, nạp key vào agent:

~~~bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
~~~

Kiểm tra:

~~~bash
ssh -o BatchMode=yes hung134@192.168.88.69 'id -un'
~~~

Chỉ tiếp tục khi lệnh trả về `hung134` và không yêu cầu mật khẩu SSH.

## Bước 5. Cấu hình file .env trên VM1

**Thực hiện trên VM1:**

~~~bash
cd /home/hung134/Basic-project
nano .env
~~~

Thêm hai biến dưới đây và thay giá trị mẫu bằng mật khẩu của bạn:

~~~dotenv
DB_ROOT_PASSWORD=THAY_BANG_MAT_KHAU_ROOT
DB_PASSWORD=THAY_BANG_MAT_KHAU_APP
~~~

Trong Nano, lưu bằng `Ctrl+O`, Enter, rồi thoát bằng `Ctrl+X`. Đặt quyền file:

~~~bash
chmod 600 .env
~~~

`DB_ROOT_PASSWORD` là mật khẩu root MariaDB. `DB_PASSWORD` là mật khẩu user `app_user`, được backend dùng để kết nối database.

## Bước 6. Kiểm tra file docker-compose.yml

**Thực hiện trên VM1:**

~~~bash
nano docker-compose.yml
~~~

File trong repository đã khai báo ba service. Kiểm tra nội dung tương ứng dưới đây:

~~~yaml
services:
  db1:
    image: mariadb:11.4
    container_name: mariadb
    restart: always
    environment:
      MARIADB_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
      MARIADB_DATABASE: basic_app
      MARIADB_USER: app_user
      MARIADB_PASSWORD: ${DB_PASSWORD}
      TZ: Asia/Ho_Chi_Minh
    volumes:
      - /db/mariadb-1:/var/lib/mysql
      - ./database/init.sql:/docker-entrypoint-initdb.d/01-init.sql:ro
    ports:
      - "127.0.0.1:3307:3306"
    healthcheck:
      test: ["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"]
      interval: 5s
      timeout: 5s
      retries: 20

  backend:
    build: ./backend
    image: backend:v1
    container_name: backend
    restart: always
    environment:
      DB_HOST: db1
      DB_PORT: 3306
      DB_NAME: basic_app
      DB_USER: app_user
      DB_PASSWORD: ${DB_PASSWORD}
      TZ: Asia/Ho_Chi_Minh
    ports:
      - "127.0.0.1:8888:8080"
    depends_on:
      db1:
        condition: service_healthy

  frontend:
    build: ./frontend
    image: frontend:v1
    container_name: frontend
    restart: always
    ports:
      - "81:80"
    depends_on:
      - backend
~~~



## Bước 7. Cấu hình file inventory.ini

**Thực hiện trên VM1:**

~~~bash
nano inventory.ini
~~~

Với VM2 dùng sudo thông thường, sửa thành:

~~~ini
[may_trien_khai]
hung134 ansible_host=192.168.88.69 ansible_user=hung134
~~~



Nếu VM2 dùng `sudo-rs` và Ansible gặp lỗi chờ prompt sudo, kiểm tra từ VM1:

~~~bash
ssh hung134@192.168.88.69 'sudo --version; command -v sudo.ws'
~~~

Nếu có `/usr/bin/sudo.ws`, dùng cấu hình sau để Ansible gọi binary đó:

~~~ini
[may_trien_khai]
hung134 ansible_host=192.168.88.69 ansible_user=hung134 ansible_become_exe=/usr/bin/sudo.ws
~~~



## Bước 8. Cấu hình file deploy.yml

**Thực hiện trên VM1:**

~~~bash
nano deploy.yml
~~~

Dùng nội dung:

~~~yaml
---
- name: Deploy Docker containers from VM1 to VM2
  hosts: hung134
  become: true

  tasks:
    - name: Create the project directory on VM2
      ansible.builtin.file:
        path: /home/hung134/project
        state: directory
        owner: hung134
        mode: "0755"

    - name: Synchronize source from VM1 to VM2
      ansible.posix.synchronize:
        src: /home/hung134/Basic-project/
        dest: /home/hung134/project/
        delete: true
        owner: false
        group: false
        rsync_opts:
          - --exclude=.git
          - --exclude=ansible
          - --exclude=node_modules
          - --exclude=target
          - --exclude=.idea
          - --exclude=.vscode
          - --exclude=deploy.yml
          - --exclude=inventory.ini
      become: false

    - name: Build images and start containers on VM2
      community.docker.docker_compose_v2:
        project_src: /home/hung134/project
        files:
          - docker-compose.yml
        build: always
        state: present
~~~

Nếu IP/user/thư mục khác ví dụ, chỉnh các vị trí:

| Cấu hình | Giá trị cần đặt |
|---|---|
| `hosts` | Alias máy trong inventory, hoặc tên nhóm cần triển khai |
| `path`, `dest`, `project_src` | Cùng thư mục triển khai trên VM2 |
| `owner` | User SSH VM2 |
| `src` | Thư mục chứa code trên VM1, giữ dấu `/` cuối đường dẫn |


## Bước 9. Kiểm tra cấu hình và chạy triển khai

**Thực hiện trên VM1:**

Chạy deploy:

~~~bash
ansible-playbook -i inventory.ini deploy.yml -k -K
~~~

Nhập **mật khẩu sudo của user trên VM2** khi thấy `BECOME password`. `-K` viết hoa hỏi mật khẩu sudo; `-k` viết thường hỏi mật khẩu SSH. 

Ansible tạo thư mục, đồng bộ source rồi build và chạy container trên VM2. Chờ lệnh hoàn tất; lần đầu có thể mất vài phút. `PLAY RECAP` cần có `failed=0` và `unreachable=0`.

## Bước 10. Kiểm tra ứng dụng

**Chạy từ VM1** để xem container trên VM2:

~~~bash
ssh -t hung134@192.168.88.69 'cd /home/hung134/project && sudo docker compose ps'
~~~

Cần thấy `frontend`, `backend`, `mariadb` đang chạy; MariaDB có trạng thái `healthy`.

Kiểm tra web và API:

~~~bash
curl -I http://192.168.88.69:81/
curl -fsS http://192.168.88.69:81/api/tasks
~~~

Trang chủ cần trả HTTP `200`; API trả mảng JSON. Mở **http://192.168.88.69:81** trong trình duyệt và thử thêm, sửa, đánh dấu hoàn thành, xóa một công việc thử nghiệm.


