---
layout: page
title: "Chính sách Bảo mật"
permalink: /privacy/
---

**Ngày cập nhật: 08/11/2026**

Chính sách này giải thích dữ liệu mà **Yunki_BOT** xử lý khi được sử dụng trong máy chủ Discord, mục đích xử lý và cách yêu cầu xem xét hoặc xóa dữ liệu.

Chính sách được soạn dựa trên mã nguồn của dự án tại thời điểm cập nhật. Bot hoạt động thông qua Discord; một số thông tin cũng được Discord và nhà cung cấp hạ tầng xử lý theo chính sách riêng của họ.

## 1. Dữ liệu Yunki_BOT lưu trong tệp dữ liệu

Theo mã nguồn hiện tại, bot sử dụng các tệp JSON trong thư mục dữ liệu. Thư mục này được xác định bởi biến môi trường `DATA_DIR`; nếu không cấu hình, mặc định là thư mục `data` của dự án.

| Tệp | Dữ liệu được lưu | Mục đích |
| --- | --- | --- |
| `warnings.json` | ID máy chủ, ID thành viên bị cảnh cáo, lý do cảnh cáo, ID người thực hiện và thời điểm cảnh cáo | Quản lý, xem và gỡ cảnh cáo bằng lệnh của bot |
| `giveaways.json` | ID tin nhắn, ID kênh và máy chủ, nội dung phần thưởng, số người thắng, thời gian kết thúc, ID người tổ chức, trạng thái, ID người thắng và thông tin reroll/kết thúc nếu có | Tiếp tục theo dõi Giveaway sau khi bot khởi động lại, kết thúc và reroll |
| `voice.json` | ID máy chủ và ID kênh voice đã chọn | Ghi nhớ kênh voice để bot có thể tự kết nối lại |
| `locks.json` | ID kênh và trạng thái quyền `SendMessages` của @everyone trước khi khóa kênh | Khôi phục quyền gửi tin khi dùng lệnh mở khóa |

### Dữ liệu người tham gia Giveaway

Khi kết thúc hoặc reroll Giveaway, bot đọc danh sách người reaction 🎉 từ Discord để chọn người thắng. Theo luồng lưu trữ hiện tại, bot lưu ID người thắng và người thắng reroll vào bản ghi Giveaway; bot không lưu toàn bộ danh sách người reaction thành một danh sách người tham gia riêng trong tệp JSON.

## 2. Dữ liệu được xử lý khi thực hiện lệnh

Để thực hiện lệnh, bot nhận dữ liệu tương ứng từ Discord, chẳng hạn ID người dùng, máy chủ, kênh, tin nhắn, tên người dùng, tùy chọn lệnh và nội dung lý do do người dùng nhập.

Một số ví dụ:

- `/userinfo` và `/serverinfo` lấy thông tin hiện có từ Discord để hiển thị phản hồi. Mã nguồn hiện tại không ghi các kết quả này vào các tệp JSON nêu trên.
- Lý do ban, kick, timeout hoặc unban được gửi tới Discord cùng thao tác tương ứng. Discord có thể ghi nhận chúng trong Audit Log theo cơ chế của Discord.
- Các thao tác khóa/mở khóa kênh và slowmode thay đổi cấu hình kênh trên Discord; dữ liệu khôi phục quyền khóa kênh được lưu trong `locks.json`.
- Bot ghi log vận hành gồm tên lệnh, thẻ tên người dùng và interaction ID khi xử lý lệnh. Log lỗi có thể chứa thông tin kỹ thuật do Discord/API trả về.

Mã nguồn hiện tại không yêu cầu quyền đọc nội dung tin nhắn thông thường bằng privileged Message Content intent. Bot cũng không triển khai chức năng ghi âm hoặc lưu trữ âm thanh voice; khi kết nối voice, bot tự mute và self-deafen.

## 3. Mục đích sử dụng

Dữ liệu được sử dụng để:

- Thực hiện và duy trì các chức năng mà người dùng yêu cầu.
- Lưu trạng thái cảnh cáo, Giveaway, kênh voice và khóa kênh qua các lần khởi động lại.
- Hiển thị kết quả lệnh, hỗ trợ quản trị máy chủ và xử lý lỗi kỹ thuật.
- Bảo vệ tính ổn định và an toàn của bot.

## 4. Thời gian lưu giữ

Thời gian lưu phụ thuộc loại dữ liệu và cách quản trị viên vận hành máy chủ:

- **Cảnh cáo:** được giữ trong `warnings.json` cho đến khi quản trị viên gỡ bằng lệnh `/unwarn` hoặc bản ghi được xóa thủ công.
- **Kênh voice:** cấu hình được giữ cho đến khi dùng `/leave` hoặc bản ghi bị xóa.
- **Trạng thái khóa kênh:** được giữ để khôi phục cho đến khi dùng `/unlock` hoặc bản ghi bị xóa.
- **Giveaway:** bản ghi có thể tiếp tục tồn tại sau khi kết thúc để phục vụ reroll và tra cứu trạng thái. Bản ghi được giữ cho đến khi người vận hành xóa khỏi vùng lưu trữ.
- **Log vận hành:** thời gian lưu phụ thuộc cấu hình và chính sách log của môi trường hosting; dự án không quy định một thời hạn log cố định trong mã nguồn đã rà soát.

Việc gỡ bot khỏi máy chủ không tự động xóa ngay các tệp JSON trên máy chủ hosting. Chủ sở hữu/vận hành bot cần xóa dữ liệu lưu trữ khi phù hợp.

## 5. Chia sẻ và bên thứ ba

Yunki_BOT tương tác với Discord để nhận lệnh, đọc dữ liệu cần thiết và thực hiện các thao tác được yêu cầu. Discord xử lý dữ liệu theo [Chính sách Bảo mật của Discord](https://discord.com/privacy) và các điều khoản của nền tảng.

Dự án được cấu hình để chạy trên môi trường hosting (README hiện tại hướng dẫn triển khai trên Replit). Nhà cung cấp hosting và ổ lưu trữ được cấu hình có thể xử lý dữ liệu kỹ thuật hoặc dữ liệu lưu trữ để vận hành dịch vụ, theo chính sách riêng của họ.

Mã nguồn được rà soát không cho thấy tính năng bán dữ liệu cá nhân, quảng cáo theo dõi hoặc dịch vụ phân tích hành vi riêng. Dữ liệu không được chủ đích bán cho bên thứ ba. Quản trị viên máy chủ vẫn có thể xem những thông tin mà các lệnh quản trị cho phép hoặc thông tin Discord hiển thị cho họ.

## 6. Lưu trữ và bảo mật

Dữ liệu JSON được lưu trên hệ thống chạy bot trong thư mục `DATA_DIR`. README của dự án khuyến nghị dùng vùng lưu trữ bền vững nếu cần giữ dữ liệu sau khi publish/khởi động lại. Tệp dữ liệu runtime được cấu hình để không đưa vào Git thông qua quy tắc loại trừ của dự án.

Token bot được cung cấp qua biến môi trường `DISCORD_TOKEN`, không phải là một trường dữ liệu trong các tệp JSON được mô tả ở trên. Người vận hành cần bảo vệ token, giới hạn quyền truy cập hosting và vùng lưu trữ, đồng thời không đăng thông tin bí mật lên GitHub hoặc Discord.

Không có phương thức truyền tải hay lưu trữ nào có thể được bảo đảm an toàn tuyệt đối. Nếu nghi ngờ token hoặc dữ liệu bị lộ, hãy báo cho chủ sở hữu bot và thực hiện các bước bảo vệ tài khoản/hệ thống liên quan.

## 7. Quyền và yêu cầu liên quan đến dữ liệu

Nếu bạn muốn hỏi về dữ liệu cảnh cáo hoặc yêu cầu xem xét/xóa dữ liệu liên quan đến mình:

1. Liên hệ riêng với quản trị viên máy chủ nơi bạn sử dụng bot hoặc chủ sở hữu Yunki_BOT.
2. Nêu tên máy chủ và loại dữ liệu cần xem xét. Chỉ cung cấp ID Discord khi thật sự cần thiết và qua kênh riêng tư.
3. Quản trị viên có thể sử dụng chức năng sẵn có như `/unwarn` để gỡ cảnh cáo, hoặc phối hợp với người vận hành để xử lý các bản ghi JSON khác.

Không gửi token, mật khẩu hoặc thông tin nhạy cảm qua GitHub Issues công khai. Việc đáp ứng yêu cầu có thể phụ thuộc quyền quản trị, khả năng xác minh yêu cầu, nghĩa vụ lưu giữ và pháp luật áp dụng.

## 8. Trẻ vị thành niên

Yunki_BOT không chủ đích yêu cầu người dùng cung cấp thông tin nhạy cảm như mật khẩu, email, số điện thoại hoặc thông tin thanh toán. Người dùng phải đáp ứng yêu cầu độ tuổi của Discord và các quy định pháp luật áp dụng tại nơi cư trú.

## 9. Thay đổi chính sách

Chính sách có thể được cập nhật khi mã nguồn, chức năng, cách lưu trữ hoặc yêu cầu pháp lý thay đổi. Bản mới sẽ được đăng tại trang này cùng ngày cập nhật.

## 10. Liên hệ

Đối với yêu cầu riêng tư hoặc yêu cầu xử lý dữ liệu, hãy liên hệ riêng với quản trị viên/chủ sở hữu Yunki_BOT qua kênh hỗ trợ của cộng đồng **Giáo Phái Phoebe** hoặc máy chủ đã thêm bot.

Để báo lỗi kỹ thuật không chứa dữ liệu cá nhân, bạn có thể dùng [GitHub Issues của dự án](https://github.com/YunkiNguyen/YunkiStickyBot/issues). Không đăng ID thành viên, nội dung cảnh cáo, token hoặc thông tin riêng tư trong issue công khai.

---

*Chính sách này phản ánh cách mã nguồn Yunki_BOT được rà soát tại ngày cập nhật. Việc sử dụng Discord và nhà cung cấp hosting còn chịu chính sách riêng của các bên đó.*
