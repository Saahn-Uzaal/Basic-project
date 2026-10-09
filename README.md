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

Repository này được tạo ở chế độ riêng tư. Tài khoản GitHub dùng để clone phải có quyền truy cập repository. Với clone qua HTTPS, khi Git hỏi mật khẩu, dùng GitHub Personal Access Token có quyền đọc repository, thay cho mật khẩu tài khoản. Không viết token vào URL hoặc file cấu hình. Xem [hướng dẫn xác thực GitHub](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-authentication-to-github).

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

Nếu đã clone trước đó, không clone lại vào cùng thư mục. Để lấy bản mới khi không có thay đổi local xung đột, dùng `git pull --ff-only` trong thư mục project.

## Bước 2. Cài Ansible trên VM1

**Thực hiện trên VM1.** Nếu Ansible đã có, kiểm tra phiên bản và hai collection rồi bỏ qua phần cài.

~~~bash
sudo apt install -y python3-venv python3-pip rsync openssh-client curl
python3 -m venv ~/.venvs/ansible
source ~/.venvs/ansible/bin/activate
python -m pip install --upgrade pip
python -m pip install ansible
ansible-galaxy collection install ansible.posix community.docker
ansible --version
ansible-galaxy collection list
~~~

Nếu dùng môi trường ảo trên, mỗi lần mở terminal mới chạy:

~~~bash
source ~/.venvs/ansible/bin/activate
~~~

Phần cài này dành cho VM1 Ubuntu 24.04. Nếu dùng Ubuntu/Python khác, chọn bản Ansible tương thích theo [tài liệu cài Ansible](https://docs.ansible.com/projects/ansible/latest/installation_guide/intro_installation.html).

## Bước 3. Chuẩn bị VM2

### 3.1. Đăng nhập VM2 từ VM1

**Chạy trên VM1:**

~~~bash
ssh hung134@192.168.88.69
~~~

Nhập mật khẩu đăng nhập user `hung134` trên VM2. Sau khi đăng nhập, các lệnh trong terminal này chạy trên VM2.

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

Hai lệnh đầu cần trả về `hung134` và `root`. Nếu user không có quyền sudo, cần cấp quyền bằng tài khoản quản trị VM2 trước khi tiếp tục.

### 3.3. Cài Docker và Compose plugin

**Chạy trên VM2.** Nếu đã cài, kiểm tra trước:

~~~bash
sudo docker version
sudo docker compose version
~~~

Nếu cả hai lệnh chạy được thì bỏ qua phần cài. Với VM2 Ubuntu mới chưa có Docker:

~~~bash
sudo install -d -m 0755 /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod 0644 /etc/apt/keyrings/docker.asc
. /etc/os-release
ubuntu_suite="${UBUNTU_CODENAME:-$VERSION_CODENAME}"
docker_arch="$(dpkg --print-architecture)"
printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu %s stable\n' "$docker_arch" "$ubuntu_suite" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker run --rm hello-world
sudo docker compose version
~~~

Nếu máy đã có Docker từ nguồn khác và gặp xung đột package, xử lý theo [hướng dẫn Docker cho Ubuntu](https://docs.docker.com/engine/install/ubuntu/). Module Ansible cần Compose plugin từ phiên bản `2.18.0`; sử dụng lệnh `docker compose`.

Thoát SSH để quay về VM1:

~~~bash
exit
~~~

## Bước 4. Thiết lập SSH key từ VM1 sang VM2

**Thực hiện trên VM1.** Bước đồng bộ source dùng rsync qua SSH, cần kết nối không hỏi mật khẩu SSH. Xem [điều kiện của module synchronize](https://docs.ansible.com/projects/ansible/latest/collections/ansible/posix/synchronize_module.html).

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

File này không có trong GitHub nên phải tự tạo. Playbook sẽ đồng bộ nó sang VM2. Nếu triển khai lại trên database đã có dữ liệu, giữ mật khẩu đang dùng; sửa `.env` không tự đổi mật khẩu trong database.

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

Giữ các cấu hình trên nếu dùng đúng project này. Nếu cổng `81` trên VM2 đã được dùng, đổi phần bên trái của `81:80` thành cổng trống và dùng cổng mới khi truy cập web. Hai Dockerfile và cấu hình Nginx đã có sẵn, không cần sửa để triển khai theo hướng dẫn.

Database sẽ lưu tại `/db/mariadb-1` trên **VM2**. Không xóa thư mục này nếu cần giữ dữ liệu. Backend kết nối database bằng tên service `db1` và cổng nội bộ `3306`.

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

Thay `ansible_host` bằng IP VM2 và `ansible_user` bằng user SSH VM2. Tên `hung134` đầu dòng là alias của máy trong inventory; playbook ở bước 8 chọn alias này.

Nếu VM2 dùng `sudo-rs` và Ansible gặp lỗi chờ prompt sudo, kiểm tra từ VM1:

~~~bash
ssh hung134@192.168.88.69 'sudo --version; command -v sudo.ws'
~~~

Nếu có `/usr/bin/sudo.ws`, dùng cấu hình sau để Ansible gọi binary đó:

~~~ini
[may_trien_khai]
hung134 ansible_host=192.168.88.69 ansible_user=hung134 ansible_become_exe=/usr/bin/sudo.ws
~~~

Repository hiện có dòng `ansible_become_exe` này do cấu hình máy đích ban đầu. Bỏ tham số khi VM2 không có `sudo.ws`. Tham khảo [ghi chú Ubuntu về sudo-rs](https://ubuntu.com/server/docs/reference/other-tools/sudo-rs/).

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

`delete: true` có thể xóa file trong thư mục đích nếu file không còn trong nguồn, trừ các file bị exclude. Dùng thư mục đích riêng cho project. Database ở `/db/mariadb-1` nằm ngoài thư mục đồng bộ.

## Bước 9. Kiểm tra cấu hình và chạy triển khai

**Thực hiện trên VM1:**

~~~bash
cd /home/hung134/Basic-project
ansible-playbook -i inventory.ini deploy.yml --syntax-check
ansible-playbook -i inventory.ini deploy.yml --list-hosts
ansible hung134 -i inventory.ini -m ansible.builtin.ping
ansible hung134 -i inventory.ini -m ansible.builtin.command -a 'id -un' -b -K
~~~

Kết quả cần đạt: không lỗi cú pháp; danh sách host có `hung134`; ping trả `pong`; lệnh kiểm tra sudo trả `root`.

Chạy deploy:

~~~bash
ansible-playbook -i inventory.ini deploy.yml -K
~~~

Nhập **mật khẩu sudo của user trên VM2** khi thấy `BECOME password`. `-K` viết hoa hỏi mật khẩu sudo; `-k` viết thường hỏi mật khẩu SSH. Sau bước SSH key, dùng `-K`.

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

Kiểm tra backend qua localhost VM2:

~~~bash
ssh hung134@192.168.88.69 'curl -fsS http://127.0.0.1:8888/actuator/health'
~~~

Kết quả cần có `"status":"UP"`. Playbook không chờ HTTP; nếu API trả `502` ngay sau deploy, đợi backend khởi động rồi thử lại. Nếu lỗi kéo dài, xem log:

~~~bash
ssh -t hung134@192.168.88.69 'cd /home/hung134/project && sudo docker compose logs --tail=100 backend db1 frontend'
~~~

## Bước 11. Lấy code mới và triển khai lại

**Thực hiện trên VM1:**

~~~bash
cd /home/hung134/Basic-project
git pull --ff-only
source ~/.venvs/ansible/bin/activate
ansible-playbook -i inventory.ini deploy.yml -K
~~~

Chỉ chạy dòng kích hoạt venv nếu đã cài Ansible theo bước 2. Nếu đã sửa inventory/playbook/Compose trên VM1 và Git báo xung đột khi pull, giữ lại các cấu hình của mình, xử lý thay đổi Git trước rồi mới deploy.

Sau deploy, kiểm tra lại theo bước 10. Dữ liệu database được giữ trong `/db/mariadb-1` trên VM2. `init.sql` chỉ chạy khi khởi tạo database lần đầu; thay file này hoặc `.env` không tự cập nhật database đã tồn tại. Xem [cơ chế khởi tạo MariaDB](https://mariadb.com/docs/server/server-management/automated-mariadb-deployment-and-administration/docker-and-mariadb/mariadb-server-docker-official-image-environment-variables).

## Khi gặp lỗi

| Lỗi | Việc cần làm |
|---|---|
| Clone báo `Repository not found` hoặc xác thực thất bại | Kiểm tra tài khoản có quyền đọc repository riêng tư; dùng PAT khi clone HTTPS |
| `Could not match supplied host pattern` | Cho `hosts` khớp alias/nhóm trong inventory |
| `sudo: interactive authentication is required` | Chạy với `-K` viết hoa; kiểm tra quyền sudo trên VM2 |
| `Timeout ... privilege escalation prompt` | Kiểm tra sudo ở bước 7, chỉ dùng `sudo.ws` khi binary tồn tại |
| rsync báo `Permission denied (publickey,password)` | Làm lại bước 4; SSH BatchMode phải thành công |
| rsync không ghi được thư mục đích | Cho `owner` khớp user SSH VM2 |
| Không tìm thấy module | Cài `ansible.posix`, `community.docker` trong đúng môi trường Ansible |
| Không tìm thấy Docker/Compose | Kiểm tra cài đặt và dịch vụ Docker trên VM2 ở bước 3 |
| Biến mật khẩu chưa được đặt | Kiểm tra `.env` ở thư mục project trên VM1 |
| Backend báo `Access denied for user` | Kiểm tra mật khẩu khớp database đã khởi tạo; không chỉ đổi `.env` |
| Web không truy cập được cổng `81` | Kiểm tra IP, container, cổng publish và kết nối mạng |
